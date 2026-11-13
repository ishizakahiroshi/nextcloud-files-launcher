const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { execFileSync, spawnSync } = require('node:child_process')

test('verified public attribution emails are allowed only in the license file', () => {
  const scanner = path.resolve(__dirname, '../scripts/secrets-scan.mjs')
  const source = fs.readFileSync(scanner, 'utf8')
  const block = source.match(/const VERIFIED_UPSTREAM_LICENSE_EMAILS = new Set\(\[([\s\S]*?)\]\)/)
  assert.ok(block, 'Scoped license allowlist exists')
  const email = JSON.parse(block[1].split('\n').map(line => line.trim()).find(line => line.startsWith('"')).replace(/,$/, ''))
  const temp = path.resolve(fs.mkdtempSync(path.join(os.tmpdir(), 'files-launcher-scan-test-')))
  assert.ok(temp.startsWith(path.resolve(os.tmpdir()) + path.sep))
  const env = { ...process.env, KB_ROOT: '', FAMILY_ROOT: '' }
  const run = () => spawnSync(process.execPath, [scanner, '--staged', '--block', '--format=json'], { cwd: temp, env, encoding: 'utf8' })
  const write = (name, contents) => fs.writeFileSync(path.join(temp, name), contents)
  try {
    execFileSync('git', ['init', '-q', '-b', 'main', temp])
    write('THIRD_PARTY_LICENSES.txt', email + '\n')
    execFileSync('git', ['-C', temp, 'add', 'THIRD_PARTY_LICENSES.txt'])
    assert.equal(run().status, 0)
    const unreviewedEmail = 'contact' + '@' + 'sample.invalid'
    write('THIRD_PARTY_LICENSES.txt', email + '\n' + unreviewedEmail + '\n')
    assert.equal(run().status, 1, 'Unreviewed license email is blocked')
    write('THIRD_PARTY_LICENSES.txt', email + '\n')
    write('other.txt', email + '\n')
    execFileSync('git', ['-C', temp, 'add', 'other.txt'])
    assert.equal(run().status, 1, 'The same email is blocked outside the license file')
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }
})
