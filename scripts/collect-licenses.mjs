import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifestFile = 'js/main.licenses.json'
export const sha256 = value => createHash('sha256').update(value).digest('hex')
const decode = value => value.toString('utf8').replace(/\r\n/g, '\n')
const licenseName = /^(?:licen[cs]e|copying|copyright|notice|authors|patents)(?:[._-].*)?$/i

function safePath(root, path) {
  const absolute = resolve(root, path), child = relative(root, absolute)
  if (isAbsolute(path) || child.startsWith('..') || !child) throw new Error(`Invalid relative license path: ${path}`)
  return absolute
}

function fullText(text, declaration) {
  if (text.length < 200 || text.split('\n').length < 4) return false
  if (/\bMIT\b/.test(declaration)) return /permission is hereby granted/i.test(text) && /THE SOFTWARE IS PROVIDED/i.test(text)
  if (/\b(?:A?GPL)-/.test(declaration)) return /GENERAL PUBLIC LICENSE/.test(text) && /TERMS AND CONDITIONS/.test(text) && /END OF TERMS AND CONDITIONS/.test(text)
  return true
}

export async function buildNotices(root = appRoot) {
  const lockBytes = await readFile(join(root, 'package-lock.json'))
  const lock = JSON.parse(lockBytes), manifest = JSON.parse(await readFile(join(root, manifestFile), 'utf8'))
  const bundle = await readFile(safePath(root, manifest.bundle))
  if (manifest.lockSha256 !== sha256(lockBytes) || manifest.bundleSha256 !== sha256(bundle)) throw new Error('Bundle license manifest is stale; run npm run build.')
  const bundledNotices = await readFile(safePath(root, manifest.bundleNotices))
  if (manifest.bundleNoticesSha256 !== sha256(bundledNotices)) throw new Error('Bundled attribution notices are stale; run npm run build.')
  if (!Array.isArray(manifest.packages) || !manifest.packages.length) throw new Error('Main bundle has no recorded third-party package resources.')
  let overrides = []
  try { overrides = JSON.parse(await readFile(join(root, 'scripts/license-overrides/manifest.json'), 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
  const sections = [], failures = [], seen = new Set()
  for (const item of [...manifest.packages].sort((a, b) => a.path.localeCompare(b.path, 'en'))) {
    if (seen.has(item.path)) throw new Error(`Duplicate bundled package: ${item.path}`)
    seen.add(item.path)
    const locked = lock.packages[item.path]
    if (!locked || locked.version !== item.version || locked.integrity !== item.integrity) throw new Error(`Lock mismatch for bundled package: ${item.path}`)
    const packageRoot = safePath(root, item.path), pkg = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
    if (pkg.name !== item.name || pkg.version !== item.version) throw new Error(`Installed package mismatch: ${item.path}`)
    const declaration = typeof pkg.license === 'string' ? pkg.license : JSON.stringify(pkg.license ?? pkg.licenses ?? 'unspecified')
    const texts = []
    for (const file of (await readdir(packageRoot, { withFileTypes: true })).filter(file => file.isFile() && licenseName.test(file.name)).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      texts.push({ source: `${item.path}/${file.name}`, text: decode(await readFile(join(packageRoot, file.name))) })
    }
    if (!texts.some(file => fullText(file.text, declaration))) {
      // Several npm packages publish their complete permission notice in README.
      // Keep the entire file, including attribution, rather than extracting lines.
      for (const file of (await readdir(packageRoot)).filter(file => /^readme(?:\..*)?$/i.test(file)).sort()) {
        const text = decode(await readFile(join(packageRoot, file)))
        if (fullText(text, declaration)) texts.push({ source: `${item.path}/${file}`, text })
      }
    }
    if (!texts.some(file => fullText(file.text, declaration))) {
      for (const override of overrides.filter(value => value.name === item.name && value.version === item.version && value.integrity === item.integrity)) {
        const bytes = await readFile(safePath(root, override.file))
        if (sha256(bytes) !== override.sha256) throw new Error(`Pinned upstream license hash mismatch: ${override.file}`)
        texts.push({ source: override.source, text: decode(bytes) })
      }
    }
    if (!texts.some(file => fullText(file.text, declaration))) { failures.push(`${item.name}@${item.version} (${declaration})`); continue }
    const author = pkg.author ? (typeof pkg.author === 'string' ? pkg.author : JSON.stringify(pkg.author)) : 'See notices below.'
    sections.push([
      '='.repeat(78), `${pkg.name}@${pkg.version}`, `Declared license: ${declaration}`, `Package author: ${author}`,
      `Locked source: ${locked.resolved ?? 'See package-lock.json.'}`, `Integrity: ${item.integrity}`,
      ...texts.flatMap(file => [`\n--- ${file.source} ---\n`, file.text]),
    ].join('\n'))
  }
  if (failures.length) throw new Error(`Missing full license text for bundled packages:\n${failures.join('\n')}`)
  return [
    'Files Launcher - third-party runtime licenses',
    'Generated from the actual webpack main bundle module graph and package-lock.json.',
    'The fixture and development-only dependencies are excluded.',
    `Bundled packages: ${sections.length}`,
    'Upstream license and attribution files are reproduced in full below.',
    '', '--- Bundled source attribution notices ---', decode(bundledNotices), '', ...sections, '',
  ].join('\n').replace(/[ \t]+$/gm, '').replace(/\n+$/, '\n')
}

export async function collectLicenses({ root = appRoot, check = false } = {}) {
  const text = await buildNotices(root), output = join(root, 'THIRD_PARTY_LICENSES.txt')
  if (check) {
    if (await readFile(output, 'utf8') !== text) throw new Error('THIRD_PARTY_LICENSES.txt is stale; run npm run licenses.')
  } else await writeFile(output, text, 'utf8')
  console.log(`Runtime licenses ${check ? 'verified' : 'generated'} (${text.length} characters).`)
  return text
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.slice(2).some(arg => arg !== '--check')) throw new Error('Usage: node scripts/collect-licenses.mjs [--check]')
  await collectLicenses({ check: process.argv.includes('--check') })
}
