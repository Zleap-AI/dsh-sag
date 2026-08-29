import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

execFileSync('pnpm', ['run', 'build'], { stdio: 'inherit' })
const destination = await mkdtemp(join(tmpdir(), 'dsh-sag-pack-'))
execFileSync('pnpm', ['--filter', '@zleap-ai/dsh-sag', 'pack', '--pack-destination', destination], { stdio: 'inherit' })
const archive = (await readdir(destination)).find(file => file.endsWith('.tgz'))
if (!archive) throw new Error('package archive was not created')
const entries = execFileSync('tar', ['-tzf', join(destination, archive)], { encoding: 'utf8' }).trim().split('\n')
const required = [
  'package/package.json', 'package/lib/index.js', 'package/lib/index.d.ts', 'package/lib/cli.js',
  'package/lib/dsh-sag-cli.js', 'package/cordis.patch.yml',
  'package/runtime/pyproject.toml', 'package/runtime/uv.lock',
  'package/runtime/src/dsh_sag_runtime/__main__.py', 'package/scripts/setup-runtime.mjs',
  'package/docs/embedded.md', 'package/THIRD_PARTY_NOTICES',
  'package/CHANGELOG.md',
  'package/README.md', 'package/README.zh.md', 'package/LICENSE',
]
for (const path of required) {
  if (!entries.includes(path)) throw new Error(`package is missing ${path}`)
}
const forbidden = [/\.env(?:\.|$)/, /\.zleap/, /\.sqlite(?:3)?$/, /lancedb/i, /__pycache__/, /\/\.venv(?:\/|$)/, /\/tests?\//, /\.map$/, /\/src\/.*\.ts$/]
for (const entry of entries) {
  if (forbidden.some(pattern => pattern.test(entry))) throw new Error(`forbidden package entry: ${entry}`)
}

const archivePath = join(destination, archive)
const manifest = JSON.parse(execFileSync('tar', ['-xOf', archivePath, 'package/package.json'], { encoding: 'utf8' }))
if (manifest.bin?.['dsh-sag'] !== './lib/dsh-sag-cli.js') {
  throw new Error('package bin dsh-sag must point to the standalone CLI bundle')
}
const duplicatedPeers = Object.keys(manifest.dependencies ?? {}).filter(name => name in (manifest.peerDependencies ?? {}))
if (duplicatedPeers.length > 0) throw new Error(`package dependencies duplicate host peers: ${duplicatedPeers.join(', ')}`)
const packedCli = execFileSync('tar', ['-xOf', archivePath, 'package/lib/dsh-sag-cli.js'], {
  encoding: 'utf8',
  maxBuffer: 8 * 1024 * 1024,
})
if (/(?:from\s+|import\()["']@deepseek-ai\//u.test(packedCli)) {
  throw new Error('standalone CLI bundle still imports a host service package')
}
if (!packedCli.includes('/*! Bundled license information:')) {
  throw new Error('standalone CLI bundle does not preserve esbuild legal comments')
}
const packedNotices = execFileSync('tar', ['-xOf', archivePath, 'package/THIRD_PARTY_NOTICES'], {
  encoding: 'utf8',
  maxBuffer: 8 * 1024 * 1024,
})
for (const packageName of ['@deepseek-ai/cordis', '@deepseek-ai/schemastery', '@modelcontextprotocol/sdk', 'ajv']) {
  if (!new RegExp(`^## ${packageName.replaceAll('/', '\\/')}@[^\\n]+$`, 'mu').test(packedNotices)) {
    throw new Error(`THIRD_PARTY_NOTICES does not cover ${packageName}`)
  }
}
if (!/^Source: .+$/mu.test(packedNotices) || !/^License: .+$/mu.test(packedNotices) || !/^License file: .+$/mu.test(packedNotices)) {
  throw new Error('THIRD_PARTY_NOTICES is missing source, license, or license-file evidence')
}

execFileSync('pnpm', ['run', 'build'], { stdio: 'inherit' })
if (packedCli !== await readFile('packages/dsh-sag/lib/dsh-sag-cli.js', 'utf8')) {
  throw new Error('standalone CLI build is not reproducible')
}
if (packedNotices !== await readFile('packages/dsh-sag/THIRD_PARTY_NOTICES', 'utf8')) {
  throw new Error('generated THIRD_PARTY_NOTICES is not reproducible')
}

const readmePaths = ['README.md', 'README.zh.md']
const forbiddenReadme = /实施计划|迭代计划|路线图|第一阶段|第二阶段|origin\/main|implementation plan|iteration history|roadmap|test matrix|DSH_SAG_ENV_FILE/iu
for (const filename of readmePaths) {
  const contents = execFileSync('tar', ['-xOf', archivePath, `package/${filename}`], { encoding: 'utf8' })
  if (!contents.includes('dsh plugin --profile web exec dsh-sag setup')
    || !contents.includes('dsh plugin --profile web exec dsh-sag doctor')) {
    throw new Error(`${filename} is missing the quick setup or doctor command`)
  }
  if (!contents.includes('dsh plugin --profile web exec dsh-sag setup ./sag-dsh.json')) {
    throw new Error(`${filename} does not anchor the exported connection file to the invoking directory`)
  }
  if (/^dsh-sag (?:setup|doctor)/gmu.test(contents)) throw new Error(`${filename} contains an unreachable bare dsh-sag command`)
  if (forbiddenReadme.test(contents)) throw new Error(`${filename} contains advanced or planning content`)
}

for (const filename of ['README.md', 'README.zh.md', 'docs/embedded.md']) {
  const source = await readFile(join('packages/dsh-sag', filename), 'utf8')
  const packed = execFileSync('tar', ['-xOf', archivePath, `package/${filename}`], { encoding: 'utf8' })
  if (packed !== source) throw new Error(`packed ${filename} differs from the source file`)
}

const installation = await mkdtemp(join(tmpdir(), 'dsh-sag-profile-smoke-'))
const isolatedHome = join(installation, 'home')
const isolatedDshHome = join(installation, 'dsh-home')
await mkdir(isolatedHome)
await mkdir(isolatedDshHome)
const connectionFile = join(installation, 'isolated-sag-connection.json')
await writeFile(connectionFile, `${JSON.stringify({
  schemaVersion: 1,
  name: 'Pack smoke SAG',
  apiUrl: 'http://127.0.0.1:65534/api/v1',
  mcpUrl: 'http://127.0.0.1:65534/mcp/',
  accessToken: 'sag_local_pack_smoke',
  defaultSourceId: null,
}, null, 2)}\n`)
const profileEnvironment = {
  ...process.env,
  HOME: isolatedHome,
  DSH_HOME: isolatedDshHome,
  XDG_CACHE_HOME: join(isolatedHome, '.cache'),
  XDG_CONFIG_HOME: join(isolatedHome, '.config'),
  XDG_DATA_HOME: join(isolatedHome, '.local', 'share'),
  SAG_DSH_CONNECTION_FILE: connectionFile,
}
const dsh = process.env.DSH_BIN ?? 'dsh'
const expectedDshVersion = '0.1.1-rc.2'
const dshVersion = spawnSync(dsh, ['--version'], { encoding: 'utf8', env: profileEnvironment })
if (dshVersion.error !== undefined) throw dshVersion.error
const actualDshVersion = `${dshVersion.stdout ?? ''}${dshVersion.stderr ?? ''}`.trim()
if (dshVersion.status !== 0 || actualDshVersion !== expectedDshVersion) {
  throw new Error(
    `check:pack requires dsh ${expectedDshVersion}, got ${actualDshVersion || `exit ${dshVersion.status}`}; `
    + 'set DSH_BIN to the current deepseek-harness rc.2 CLI',
  )
}
execFileSync(dsh, ['plugin', '--profile', 'web', 'add', archivePath], {
  cwd: installation,
  env: profileEnvironment,
  stdio: 'inherit',
})

function profileExec(args) {
  return spawnSync(dsh, ['plugin', '--profile', 'web', 'exec', 'dsh-sag', ...args], {
    cwd: installation,
    encoding: 'utf8',
    env: profileEnvironment,
    shell: process.platform === 'win32',
  })
}

function assertModuleResolution(command, result) {
  if (result.error !== undefined) throw result.error
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  if (/ERR_MODULE_NOT_FOUND|Cannot find package|MODULE_NOT_FOUND/iu.test(output)) {
    throw new Error(`installed dsh-sag ${command} has an unresolved runtime dependency:\n${output}`)
  }
  return output
}

const help = profileExec(['--help'])
const helpOutput = assertModuleResolution('--help', help)
if (help.status !== 0) throw new Error(`installed dsh-sag --help exited ${help.status}: ${helpOutput}`)
if (!helpOutput.includes('dsh-sag setup') || !helpOutput.includes('dsh-sag doctor')) {
  throw new Error('installed dsh-sag --help returned no command help')
}
const setup = profileExec(['setup', '--url', 'http://127.0.0.1:65534'])
const setupOutput = assertModuleResolution('setup', setup)
if (!setupOutput.includes('SAG 未就绪') && !setupOutput.includes('连接 SAG 失败')) {
  throw new Error(`installed dsh-sag setup did not reach connection handling:\n${setupOutput}`)
}
const doctor = profileExec(['doctor'])
const doctorOutput = assertModuleResolution('doctor', doctor)
if (!doctorOutput.includes('SAG 未就绪') && !doctorOutput.includes('SAG 检查失败')) {
  throw new Error(`installed dsh-sag doctor did not reach connection handling:\n${doctorOutput}`)
}
const setupRuntime = spawnSync(dsh, [
  'plugin', '--profile', 'web', 'exec', 'node',
  'node_modules/@zleap-ai/dsh-sag/scripts/setup-runtime.mjs', '--help',
], {
  cwd: installation,
  encoding: 'utf8',
  env: profileEnvironment,
  shell: process.platform === 'win32',
})
if (setupRuntime.stderr.includes('MODULE_NOT_FOUND')) throw new Error('profile-relative setup-runtime path is not resolvable')
if (setupRuntime.status === 0 || !setupRuntime.stderr.includes('--python is required')) {
  throw new Error('installed setup-runtime did not start from the profile-relative package path')
}

const webArgs = ['--profile', 'web', '--no-open', '--port', '0']

function boundedOutput(current, next) {
  const combined = current + next
  return combined.length <= 2 * 1024 * 1024 ? combined : combined.slice(-2 * 1024 * 1024)
}

async function startWebAndStopAtReady() {
  await new Promise((resolve, reject) => {
    const child = spawn(dsh, webArgs, { cwd: installation, env: profileEnvironment, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    let ready = false
    let stopRequested = false
    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`installed web profile did not become ready:\n${output}`))
    }, 30_000)
    const record = (chunk) => {
      output = boundedOutput(output, chunk.toString())
      if (!ready && /^dsh web: http:\/\/127\.0\.0\.1:\d+/mu.test(output)) {
        ready = true
        stopRequested = true
        child.kill('SIGTERM')
      }
    }
    child.stdout.on('data', record)
    child.stderr.on('data', record)
    child.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.once('close', (code, signal) => {
      clearTimeout(timeout)
      if (!ready) reject(new Error(`installed web profile exited before readiness (${String(code)}, ${String(signal)}):\n${output}`))
      else if (!stopRequested || code !== 0) reject(new Error(`installed web profile did not stop gracefully (${String(code)}, ${String(signal)}):\n${output}`))
      else resolve()
    })
  })
}

async function rejectInvalidMode() {
  await writeFile(join(isolatedDshHome, 'profiles', 'web', 'cordis.patch.yml'), `- id: dsh-sag\n  config:\n    mode: invalid\n`)
  await new Promise((resolve, reject) => {
    const child = spawn(dsh, webArgs, { cwd: installation, env: profileEnvironment, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`invalid dsh-sag mode did not fail startup:\n${output}`))
    }, 20_000)
    const record = (chunk) => { output = boundedOutput(output, chunk.toString()) }
    child.stdout.on('data', record)
    child.stderr.on('data', record)
    child.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.once('close', (code, signal) => {
      clearTimeout(timeout)
      if (code === 0) reject(new Error(`invalid dsh-sag mode unexpectedly started:\n${output}`))
      else if (!/dsh-sag/iu.test(output) || !/mode|invalid|schema/iu.test(output)) {
        reject(new Error(`invalid dsh-sag mode failed without a plugin diagnostic (${String(code)}, ${String(signal)}):\n${output}`))
      } else resolve()
    })
  })
}

await startWebAndStopAtReady()
await rejectInvalidMode()

async function collectCordisTargets(directory, targets) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.name === 'cordis' && path.includes(`${join('node_modules', '@deepseek-ai')}`)) {
      targets.add(await realpath(path))
      continue
    }
    if (entry.isDirectory() && !entry.isSymbolicLink()) await collectCordisTargets(path, targets)
  }
}

const cordisTargets = new Set()
await collectCordisTargets(join(isolatedDshHome, 'profiles'), cordisTargets)
if (cordisTargets.size !== 1) {
  throw new Error(`installed profile resolved ${cordisTargets.size} Cordis service identities: ${[...cordisTargets].join(', ')}`)
}
const [cordisTarget] = cordisTargets
if (cordisTarget.includes(join(isolatedDshHome, 'profiles', 'web', 'node_modules', '.pnpm'))) {
  throw new Error(`installed dsh-sag brought a private Cordis runtime into the profile: ${cordisTarget}`)
}
process.stdout.write(`verified ${archive}: ${entries.length} entries\n`)
