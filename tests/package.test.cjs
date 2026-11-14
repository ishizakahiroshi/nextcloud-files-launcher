const { test } = require('node:test')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const path = require('node:path')

test('the install archive contains runtime licenses and the App Store changelog only', () => {
  const root = path.resolve(__dirname, '..')
  const version = require('../package.json').version
  execFileSync(process.execPath, [path.join(root, 'scripts/package.mjs')], { cwd: root, stdio: 'pipe' })
  const archive = path.join(root, 'build', `files_launcher-${version}.tar.gz`)
  const names = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split(/\r?\n/)
  for (const required of ['files_launcher/CHANGELOG.md', 'files_launcher/LICENSE', 'files_launcher/NOTICE', 'files_launcher/THIRD_PARTY_LICENSES.txt', 'files_launcher/SHA256SUMS']) {
    assert.ok(names.includes(required), `Missing ${required}`)
  }
  assert.ok(names.every(name => name.startsWith('files_launcher/') && !name.includes('..')))
  assert.ok(names.every(name => !/^files_launcher\/(?:tests|node_modules|js\/src)\//.test(name)))
})
