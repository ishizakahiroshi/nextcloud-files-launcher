import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { collectLicenses } from './collect-licenses.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const info = await readFile(join(root, 'appinfo/info.xml'), 'utf8')
if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(pkg.version)
  || !info.includes('<id>files_launcher</id>')
  || !info.includes(`<version>${pkg.version}</version>`)) throw new Error('App metadata/version mismatch')
// Refuse to package a bundle whose full third-party notices are stale or absent.
await collectLicenses({ root, check: true })
const files = ['appinfo/info.xml', 'lib/AppInfo/Application.php', 'js/main.js', 'js/main.js.LICENSE.txt', 'css/launcher.css', 'img/app.svg', 'LICENSE', 'NOTICE', 'THIRD_PARTY_LICENSES.txt']
for (const entry of await readdir(join(root, 'l10n'), { withFileTypes: true })) {
  if (entry.isFile() && /^[a-zA-Z_@-]+\.(js|json)$/.test(entry.name)) files.push(`l10n/${entry.name}`)
}
files.sort()
await mkdir(join(root, 'build'), { recursive: true })
const stage = await mkdtemp(join(tmpdir(), 'files-launcher-package-'))
const stagePath = resolve(stage)
if (!stagePath.startsWith(resolve(tmpdir()) + sep) || !stagePath.includes('files-launcher-package-')) throw new Error('Unsafe staging path')
const archive = join(root, 'build', `files_launcher-${pkg.version}.tar.gz`)
try {
  const hashes = []
  for (const relative of files) {
    const bytes = await readFile(join(root, relative))
    const target = join(stage, 'files_launcher', relative)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, bytes)
    hashes.push(`${createHash('sha256').update(bytes).digest('hex')}  ${relative}`)
  }
  await writeFile(join(stage, 'files_launcher/SHA256SUMS'), hashes.join('\n') + '\n')
  execFileSync('tar', ['-czf', archive, '-C', stage, 'files_launcher'])
  const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split(/\r?\n/)
  const allowed = new Set(files.map(f => `files_launcher/${f}`).concat('files_launcher/SHA256SUMS'))
  for (const entry of entries) {
    if (entry.includes('..') || entry.startsWith('/') || !entry.startsWith('files_launcher/')) throw new Error('Unsafe archive entry')
    if (!entry.endsWith('/') && !allowed.has(entry)) throw new Error(`Unexpected archive entry: ${entry}`)
  }
  const hash = createHash('sha256').update(await readFile(archive)).digest('hex')
  await writeFile(join(root, 'build/SHA256SUMS.txt'), `${hash}  files_launcher-${pkg.version}.tar.gz\n`)
  console.log(`Unsigned candidate: build/files_launcher-${pkg.version}.tar.gz (${files.length} runtime files + manifest)`)
  console.log(`SHA256: ${hash}`)
} finally {
  await rm(stagePath, { recursive: true, force: true })
}
