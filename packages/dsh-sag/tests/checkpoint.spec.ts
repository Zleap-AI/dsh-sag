import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

async function fixtureFile(root: string, relative: string, content: string): Promise<void> {
  const filename = join(root, relative)
  await mkdir(dirname(filename), { recursive: true })
  await writeFile(filename, content)
}

describe('final checkpoint', () => {
  it('reports changed files, required artifacts, and the latest verification summary without Git', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-sag-checkpoint-'))
    const run = '.superpowers/sdd/test-run'
    await fixtureFile(root, `${run}/baseline-task-10/src/modified.txt`, 'before\n')
    await fixtureFile(root, `${run}/baseline-task-10/src/deleted.txt`, 'before\n')
    await fixtureFile(root, 'src/modified.txt', 'after\n')
    await fixtureFile(root, 'src/added.txt', 'after\n')
    await fixtureFile(root, `${run}/task-10-verification-report.md`, '# Verification\n\n## 结论\n\n**FAIL**。\n')
    await fixtureFile(root, `${run}/task-10-reverification-report.md`, '# Reverification\n\n## 结论\n\n**PASS**。\n')
    for (const artifact of [
      'packages/dsh-sag/lib/index.js',
      'packages/dsh-sag/lib/index.d.ts',
      'packages/dsh-sag/lib/cli.js',
      'packages/dsh-sag/lib/dsh-sag-cli.js',
      'packages/dsh-sag/THIRD_PARTY_NOTICES',
      'packages/dsh-sag/runtime/pyproject.toml',
    ]) await fixtureFile(root, artifact, 'built\n')

    const script = new URL('../../../scripts/checkpoint.mjs', import.meta.url)
    const result = JSON.parse(execFileSync(process.execPath, [script.pathname, 'final', 'src'], {
      cwd: root,
      encoding: 'utf8',
    })) as {
      changedFiles: Array<{ path: string; status: string }>
      artifacts: Array<{ path: string; exists: boolean }>
      verification: { path: string; summary: string }
    }

    expect(result.changedFiles).toEqual(expect.arrayContaining([
      { path: 'src/added.txt', status: 'added' },
      { path: 'src/deleted.txt', status: 'deleted' },
      { path: 'src/modified.txt', status: 'modified' },
      { path: 'packages/dsh-sag/lib/cli.js', status: 'added' },
    ]))
    expect(result.artifacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'packages/dsh-sag/lib/dsh-sag-cli.js', exists: true }),
      expect.objectContaining({ path: 'packages/dsh-sag/THIRD_PARTY_NOTICES', exists: true }),
    ]))
    expect(result.verification).toEqual({
      path: `${run}/task-10-reverification-report.md`,
      summary: '**PASS**。',
    })
  })
})
