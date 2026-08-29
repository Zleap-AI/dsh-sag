import { createHash } from 'node:crypto'
import { readFile, readdir, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

const REQUIRED_ARTIFACTS = [
  'packages/dsh-sag/lib/index.js',
  'packages/dsh-sag/lib/index.d.ts',
  'packages/dsh-sag/lib/cli.js',
  'packages/dsh-sag/lib/dsh-sag-cli.js',
  'packages/dsh-sag/THIRD_PARTY_NOTICES',
  'packages/dsh-sag/runtime/pyproject.toml',
]

const [label, ...targets] = process.argv.slice(2)

function portable(path) {
  return path.split(sep).join('/')
}

function excluded(path) {
  return portable(path).split('/').some(part => part === 'node_modules' || part === '.superpowers' || part === '.venv')
}

async function fileHash(filename) {
  return createHash('sha256').update(await readFile(filename)).digest('hex')
}

async function collectFiles(root, target, files) {
  const filename = join(root, target)
  let info
  try {
    info = await stat(filename)
  } catch (error) {
    if (error?.code === 'ENOENT') return
    throw error
  }
  if (info.isFile()) {
    files.set(portable(target), await fileHash(filename))
    return
  }
  if (!info.isDirectory()) return
  for (const entry of await readdir(filename, { withFileTypes: true })) {
    const child = join(target, entry.name)
    if (excluded(child)) continue
    await collectFiles(root, child, files)
  }
}

async function locateFinalRun(root) {
  const sdd = join(root, '.superpowers', 'sdd')
  const candidates = []
  for (const entry of await readdir(sdd, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const baseline = join(sdd, entry.name, 'baseline-task-10')
    try {
      if ((await stat(baseline)).isDirectory()) candidates.push(join(sdd, entry.name))
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }
  if (candidates.length !== 1) throw new Error(`checkpoint: expected one baseline-task-10, found ${candidates.length}`)
  return candidates[0]
}

async function artifactStatus(root, path) {
  try {
    const info = await stat(join(root, path))
    return { path, exists: info.isFile(), size: info.size }
  } catch (error) {
    if (error?.code === 'ENOENT') return { path, exists: false, size: 0 }
    throw error
  }
}

function verificationSummary(text) {
  const lines = text.split(/\r?\n/u)
  const conclusion = lines.findIndex(line => /^##\s+(?:结论|Conclusion)\s*$/iu.test(line.trim()))
  const tail = conclusion < 0 ? lines : lines.slice(conclusion + 1)
  return tail.find(line => line.trim().length > 0)?.trim() ?? 'No verification summary found.'
}

async function finalCheckpoint(root) {
  const run = await locateFinalRun(root)
  const baseline = join(run, 'baseline-task-10')
  const currentFiles = new Map()
  const baselineFiles = new Map()
  await collectFiles(root, '.', currentFiles)
  await collectFiles(baseline, '.', baselineFiles)
  const changedFiles = [...new Set([...currentFiles.keys(), ...baselineFiles.keys()])].sort().flatMap(path => {
    const current = currentFiles.get(path)
    const before = baselineFiles.get(path)
    if (before === undefined) return [{ path, status: 'added' }]
    if (current === undefined) return [{ path, status: 'deleted' }]
    return current === before ? [] : [{ path, status: 'modified' }]
  })
  let report = join(run, 'task-10-reverification-report.md')
  try {
    await stat(report)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
    report = join(run, 'task-10-verification-report.md')
  }
  const reportText = await readFile(report, 'utf8')
  return {
    checkpoint: label,
    baseline: portable(relative(root, baseline)),
    requestedTargets: targets,
    changedFiles,
    artifacts: await Promise.all(REQUIRED_ARTIFACTS.map(path => artifactStatus(root, path))),
    verification: {
      path: portable(relative(root, report)),
      summary: verificationSummary(reportText),
    },
  }
}

if (!label || targets.length === 0) process.exitCode = 2
else if (label === 'final') {
  process.stdout.write(`${JSON.stringify(await finalCheckpoint(process.cwd()), null, 2)}\n`)
} else {
  const rows = []
  for (const target of targets) {
    const info = await stat(target)
    rows.push({ target, kind: info.isDirectory() ? 'directory' : 'file', size: info.size })
  }
  process.stdout.write(`${JSON.stringify({ checkpoint: label, targets: rows }, null, 2)}\n`)
}
