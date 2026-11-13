const { test } = require('node:test')
const assert = require('node:assert/strict')
const { mkdtemp, mkdir, readFile, writeFile, rm } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

const collector = () => import('../scripts/collect-licenses.mjs')

async function syntheticRoot(t) {
  const { sha256 } = await collector(), root = await mkdtemp(join(tmpdir(), 'files-launcher-licenses-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, 'js')); await mkdir(join(root, 'node_modules/example'), { recursive: true })
  const bundle = '/* Synthetic bundle for collector verification. */\n', notices = 'Copyright example contributor.\n'
  const lock = JSON.stringify({ packages: { 'node_modules/example': { version: '1.0.0', integrity: 'sha512-synthetic', resolved: 'https://registry.npmjs.org/example/-/example-1.0.0.tgz' } } })
  await writeFile(join(root, 'js/main.js'), bundle); await writeFile(join(root, 'js/main.js.LICENSE.txt'), notices); await writeFile(join(root, 'package-lock.json'), lock)
  await writeFile(join(root, 'node_modules/example/package.json'), JSON.stringify({ name: 'example', version: '1.0.0', license: 'MIT', author: 'Example contributor' }))
  await writeFile(join(root, 'js/main.licenses.json'), JSON.stringify({ bundle: 'js/main.js', bundleSha256: sha256(bundle), bundleNotices: 'js/main.js.LICENSE.txt', bundleNoticesSha256: sha256(notices), lockSha256: sha256(lock), packages: [{ path: 'node_modules/example', name: 'example', version: '1.0.0', integrity: 'sha512-synthetic' }] }))
  return root
}

test('full runtime licenses include escape-html permission and attribution, excluding unbundled and fixture packages', async () => {
  const { buildNotices } = await collector(), root = join(__dirname, '..'), text = await buildNotices(root)
  const manifest = JSON.parse(await readFile(join(root, 'js/main.licenses.json'), 'utf8'))
  assert.ok(manifest.packages.some(pkg => pkg.name === 'escape-html'))
  assert.equal(manifest.packages.some(pkg => ['byte-length', '@nodable/entities', 'jsdom', 'webpack'].includes(pkg.name)), false)
  const original = await readFile(join(root, 'node_modules/escape-html/LICENSE'), 'utf8')
  assert.ok(text.includes(original.replace(/\r\n/g, '\n')))
  assert.match(text, /Permission is hereby granted/)
  assert.match(text, /SPDX-FileCopyrightText: 2019 Nextcloud GmbH and Nextcloud contributors/)
  assert.match(text, /GENERAL PUBLIC LICENSE/)
  assert.equal(text, await buildNotices(root))
})

test('a package declaration without its full permission notice fails without replacing existing output', async t => {
  const root = await syntheticRoot(t), { collectLicenses } = await collector()
  await writeFile(join(root, 'node_modules/example/README.md'), 'License: MIT\n')
  await writeFile(join(root, 'THIRD_PARTY_LICENSES.txt'), 'Existing reviewed output.\n')
  await assert.rejects(collectLicenses({ root }), /Missing full license text/)
  assert.equal(await readFile(join(root, 'THIRD_PARTY_LICENSES.txt'), 'utf8'), 'Existing reviewed output.\n')
})

test('complete notices embedded in README remain intact and stale bundle metadata is rejected', async t => {
  const root = await syntheticRoot(t), { buildNotices } = await collector()
  const full = await readFile(join(__dirname, '../node_modules/escape-html/LICENSE'), 'utf8')
  const readme = `# Example package\n\n${full}\nOther upstream attribution remains here.\n`
  await writeFile(join(root, 'node_modules/example/README.md'), readme)
  assert.ok((await buildNotices(root)).includes(readme.replace(/\r\n/g, '\n')))
  await writeFile(join(root, 'js/main.js'), 'Changed bundle')
  await assert.rejects(buildNotices(root), /manifest is stale/)
})
