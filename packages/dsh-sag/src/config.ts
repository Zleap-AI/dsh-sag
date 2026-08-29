import z from '@deepseek-ai/schemastery'
import { sagNamespaceId, type SagNamespaceId } from './brand.js'
import type { SupervisorConfig } from './runtime/supervisor.js'

const DEFAULT_DISCOVERY_URLS = ['http://127.0.0.1:8000', 'http://localhost:8000'] as const
const DEFAULT_MAX_UPLOAD_BYTES = 100 * 1024 * 1024

export interface NamespaceConfig {
  readonly id: string
  readonly label: string
}

interface ExistingSidecarConfig {
  readonly pythonCommand: string
  readonly envFile: string
  readonly cwd?: string
  readonly namespaces: readonly NamespaceConfig[]
  readonly defaultMode?: 'fast' | 'precise'
  readonly maxResults?: number
  readonly maxSnippetChars?: number
  readonly maxReadChars?: number
  readonly maxReadEngines?: number
  readonly requestTimeoutMs?: number
  readonly shutdownGraceMs?: number
  readonly allowDegraded?: boolean
}

/** Connect to an already-running local SAG server. */
export interface LocalConfig {
  readonly mode?: 'local'
  readonly discoveryUrls?: readonly string[]
  readonly requestTimeoutMs?: number
  readonly maxUploadBytes?: number
  readonly maxReadChars?: number
  readonly connectionCacheTtlMs?: number
}

/** Run the legacy Python sidecar directly. */
export interface EmbeddedConfig extends ExistingSidecarConfig {
  readonly mode: 'embedded'
}

/** Loader-facing plugin configuration. Local mode is the default. */
export type Config = LocalConfig | EmbeddedConfig

const localConfigSchema = z.object({
  mode: z.const('local').default('local'),
  discoveryUrls: z.array(z.string()).default(null as never),
  requestTimeoutMs: z.number().default(30_000),
  maxUploadBytes: z.number().default(DEFAULT_MAX_UPLOAD_BYTES),
  maxReadChars: z.number().default(40_000),
  connectionCacheTtlMs: z.number().default(5_000),
})

const embeddedConfigSchema = z.object({
  mode: z.const('embedded').required(),
  pythonCommand: z.string().required(),
  envFile: z.string().required(),
  cwd: z.string(),
  namespaces: z.array(z.object({ id: z.string().required(), label: z.string().required() })).required(),
  defaultMode: z.union(['fast', 'precise']).default('fast'),
  maxResults: z.number().default(20),
  maxSnippetChars: z.number().default(1200),
  maxReadChars: z.number().default(40_000),
  maxReadEngines: z.number().default(4),
  requestTimeoutMs: z.number().default(30_000),
  shutdownGraceMs: z.number().default(5_000),
  allowDegraded: z.boolean().default(false),
})

export const Config = z.union([localConfigSchema, embeddedConfigSchema]) as unknown as z<Config>

export interface ResolvedNamespaceConfig {
  readonly id: SagNamespaceId
  readonly label: string
}

export interface ResolvedLocalConfig {
  readonly mode: 'local'
  readonly discoveryUrls: readonly string[]
  readonly requestTimeoutMs: number
  readonly maxUploadBytes: number
  readonly maxReadChars: number
  readonly connectionCacheTtlMs: number
}

export interface ResolvedEmbeddedConfig extends SupervisorConfig {
  readonly mode: 'embedded'
  readonly namespaces: readonly ResolvedNamespaceConfig[]
  readonly defaultMode: 'fast' | 'precise'
  readonly requestTimeoutMs: number
}

export type ResolvedConfig = ResolvedLocalConfig | ResolvedEmbeddedConfig

function integer(name: string, value: number, maximum: number): number {
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`dsh-sag: ${name} must be an integer from 1 to ${maximum}`)
  }
  return value
}

function nonEmpty(name: string, value: unknown): string {
  if (typeof value !== 'string') throw new Error(`dsh-sag: ${name} must not be empty`)
  const normalized = value.trim()
  if (!normalized) throw new Error(`dsh-sag: ${name} must not be empty`)
  return normalized
}

function normalizeHttpUrl(name: string, value: string): string {
  const normalized = nonEmpty(name, value)
  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    throw new Error(`dsh-sag: ${name} must be an http or https URL`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`dsh-sag: ${name} must be an http or https URL`)
  }
  if (parsed.username || parsed.password) {
    throw new Error(`dsh-sag: ${name} must not contain a username or password`)
  }
  return parsed.toString().replace(/\/$/, '')
}

function resolveLocalConfig(config: LocalConfig): ResolvedLocalConfig {
  const discoveryUrls = config.discoveryUrls ?? DEFAULT_DISCOVERY_URLS
  if (!Array.isArray(discoveryUrls) || discoveryUrls.length === 0) {
    throw new Error('dsh-sag: discoveryUrls must contain at least one URL')
  }
  return {
    mode: 'local',
    discoveryUrls: discoveryUrls.map((url, index) => normalizeHttpUrl(`discoveryUrls[${index}]`, url)),
    requestTimeoutMs: integer('requestTimeoutMs', config.requestTimeoutMs ?? 30_000, 2_147_483_647),
    maxUploadBytes: integer('maxUploadBytes', config.maxUploadBytes ?? DEFAULT_MAX_UPLOAD_BYTES, 2_147_483_647),
    maxReadChars: integer('maxReadChars', config.maxReadChars ?? 40_000, 200_000),
    connectionCacheTtlMs: integer('connectionCacheTtlMs', config.connectionCacheTtlMs ?? 5_000, 2_147_483_647),
  }
}

function resolveEmbeddedConfig(config: EmbeddedConfig): ResolvedEmbeddedConfig {
  const pythonCommand = nonEmpty('pythonCommand', config.pythonCommand)
  const envFile = nonEmpty('envFile', config.envFile)
  if (!Array.isArray(config.namespaces) || config.namespaces.length === 0) {
    throw new Error('dsh-sag: at least one namespace is required')
  }
  const seen = new Set<string>()
  const namespaces = config.namespaces.map((namespace): ResolvedNamespaceConfig => {
    let id: SagNamespaceId
    try {
      id = sagNamespaceId(namespace.id.trim())
    } catch {
      throw new Error('dsh-sag: namespace id must be 1-36 URL-safe characters')
    }
    if (seen.has(id)) throw new Error(`dsh-sag: duplicate namespace ${JSON.stringify(id)}`)
    seen.add(id)
    return { id, label: nonEmpty('namespace label', namespace.label) }
  })
  const defaultMode = config.defaultMode ?? 'fast'
  if (defaultMode !== 'fast' && defaultMode !== 'precise') {
    throw new Error('dsh-sag: defaultMode must be fast or precise')
  }
  return {
    mode: 'embedded',
    pythonCommand,
    envFile,
    cwd: config.cwd === undefined ? process.cwd() : nonEmpty('cwd', config.cwd),
    namespaces,
    defaultMode,
    maxResults: integer('maxResults', config.maxResults ?? 20, 50),
    maxSnippetChars: integer('maxSnippetChars', config.maxSnippetChars ?? 1200, 20_000),
    maxReadChars: integer('maxReadChars', config.maxReadChars ?? 40_000, 200_000),
    maxReadEngines: integer('maxReadEngines', config.maxReadEngines ?? 4, 32),
    requestTimeoutMs: integer('requestTimeoutMs', config.requestTimeoutMs ?? 30_000, 2_147_483_647),
    shutdownGraceMs: integer('shutdownGraceMs', config.shutdownGraceMs ?? 5_000, 2_147_483_647),
    allowDegraded: config.allowDegraded ?? false,
  }
}

/** Apply and validate every default before a local client or sidecar observes config. */
export function resolveConfig(config: Config): ResolvedConfig {
  if (config.mode === 'embedded') return resolveEmbeddedConfig(config)
  return resolveLocalConfig(config)
}
