const { test } = require('node:test')
const assert = require('node:assert/strict')
const { JSDOM } = require('jsdom')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { runInNewContext } = require('node:vm')
const { createFilesLauncher, STORAGE_KEY } = require('../js/src/launcher.cjs')

const flush = () => new Promise(resolve => setImmediate(resolve))
const drawing = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#168bd4" d="M4 3h16v18H4z"/></svg>'

function setup(options = {}) {
  const dom = new JSDOM('<!doctype html><body><main><form class="files-list__header-upload-button" data-cy-upload-picker><div class="action-item action-item--default-popover"><button type="button" class="standard">New</button></div><input type="file" data-cy-upload-picker-input hidden multiple></form></main></body>', { url: 'https://cloud.example.test/apps/files/files?dir=/' })
  const { window } = dom, { document } = window, handlers = new Map(), calls = []
  if (options.folderSupported !== false) Object.defineProperty(window.HTMLInputElement.prototype, 'webkitdirectory', { configurable: true, get() { return this.hasAttribute('webkitdirectory') }, set(value) { this.toggleAttribute('webkitdirectory', Boolean(value)) } })
  let entries = options.entries || [{ id: 'folder', displayName: 'Folder', iconSvgInline: drawing, handler: (...args) => calls.push(args) }]
  const folder = { source: '/remote.php/dav/files/demo/', path: '/', permissions: 31 }
  if (options.storage) window.localStorage.setItem(STORAGE_KEY, options.storage)
  if (options.storageBlocked) Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked') } })
  const launcher = createFilesLauncher({ window, document, getEntries: context => entries.filter(entry => !entry.enabled || entry.enabled(context)), subscribe: (name, fn) => handlers.set(name, fn), unsubscribe: name => handlers.delete(name), isPublic: () => options.public || false, translate: options.translate })
  const update = (nextFolder = folder) => handlers.get('files:list:updated')({ view: { id: 'files' }, folder: nextFolder, contents: [{ basename: 'existing.txt' }] })
  const open = () => document.querySelector('.files-launcher-trigger').click()
  return { dom, window, document, calls, folder, launcher, handlers, update, open, setEntries: next => { entries = next } }
}

test('unknown context and public shares preserve the standard upload picker', async () => {
  for (const options of [{}, { public: true }]) {
    const app = setup(options)
    if (options.public) app.update()
    await flush()
    assert.equal(app.document.querySelector('.files-launcher-trigger'), null)
    assert.equal(app.document.querySelector('form').classList.contains('files-launcher-ready'), false)
    app.launcher.destroy(); app.dom.window.close()
  }
})

test('renders filtered entries in order and executes a single current handler', async () => {
  const calls = [], app = setup({ entries: [
    { id: 'late', displayName: 'Late', order: 20, handler: () => calls.push('late') },
    { id: 'hidden', displayName: 'Hidden', enabled: () => false, handler: () => calls.push('hidden') },
    { id: 'first', displayName: 'First', order: 1, handler: (folder, contents) => calls.push([folder, contents]) },
    { id: 'other', displayName: 'Other action', category: 2, handler() {} },
  ] })
  app.update(); await flush(); app.open()
  assert.deepEqual([...app.document.querySelectorAll('[data-entry-id]')].map(node => node.dataset.entryId), ['first', 'late', 'other'])
  app.document.querySelector('[data-entry-id="first"]').click(); await flush()
  assert.equal(calls.length, 1); assert.equal(calls[0][0], app.folder); assert.equal(calls[0][1][0].basename, 'existing.txt')
  app.launcher.destroy(); app.dom.window.close()
})

test('revalidates enabled entries immediately before invoking an old tile', async () => {
  const app = setup(); app.update(); await flush(); app.open()
  const stale = app.document.querySelector('[data-entry-id="folder"]')
  app.setEntries([]); stale.click(); await flush()
  assert.equal(app.calls.length, 0)
  app.launcher.destroy(); app.dom.window.close()
})

test('cancel from a modal leaves the launcher available for another action', async () => {
  const app = setup()
  app.setEntries([{ id: 'folder', displayName: 'Folder', handler: () => new Promise(resolve => {
    const dialog = app.document.createElement('div'); dialog.setAttribute('role', 'dialog')
    const cancel = app.document.createElement('button'); cancel.textContent = 'Cancel'; cancel.addEventListener('click', () => { dialog.remove(); resolve() })
    dialog.append(cancel); app.document.body.append(dialog)
  }) }])
  app.update(); await flush(); app.open(); app.document.querySelector('[data-entry-id]').click()
  app.document.querySelector('[role="dialog"] button').click(); await flush()
  assert.equal(app.document.querySelector('.files-launcher-popover').hidden, false)
  assert.equal(app.document.querySelector('[data-entry-id]').disabled, false)
  app.document.querySelector('[data-entry-id]').click()
  assert.ok(app.document.querySelector('[role="dialog"]'))
  app.launcher.destroy(); app.dom.window.close()
})

test('second-stage non-awaited modal cancel click and Escape do not close popover', async () => {
  const app = setup()
  app.setEntries([{ id: 'template', displayName: 'Template', handler: async () => {
    const dialog = app.document.createElement('div'); dialog.setAttribute('role', 'dialog')
    const cancel = app.document.createElement('button'); cancel.textContent = 'Cancel'; cancel.addEventListener('click', () => dialog.remove()); dialog.append(cancel)
    dialog.addEventListener('keydown', event => { if (event.key === 'Escape') dialog.remove() }); app.document.body.append(dialog)
  } }])
  app.update(); await flush(); app.open(); app.document.querySelector('[data-entry-id]').click(); await flush()
  app.document.querySelector('[role="dialog"] button').click(); await flush()
  assert.equal(app.document.querySelector('.files-launcher-popover').hidden, false)
  app.document.querySelector('[data-entry-id]').click(); await flush()
  app.document.querySelector('[role="dialog"]').dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  assert.equal(app.document.querySelector('.files-launcher-popover').hidden, false)
  assert.equal(app.document.querySelector('[role="dialog"]'), null)
  app.launcher.destroy(); app.dom.window.close()
})

test('mode choice survives reinitialization; unavailable storage does not block controls', async () => {
  const app = setup({ storage: 'list' }); app.update(); await flush(); app.open()
  assert.equal(app.document.querySelector('.files-launcher-popover').dataset.view, 'list')
  app.document.querySelector('[data-view-choice="grid"]').click()
  assert.equal(app.window.localStorage.getItem(STORAGE_KEY), 'grid')
  app.launcher.destroy(); app.dom.window.close()
  const blocked = setup({ storageBlocked: true }); blocked.update(); await flush(); blocked.open(); blocked.document.querySelector('[data-view-choice="list"]').click()
  assert.equal(blocked.document.querySelector('.files-launcher-popover').dataset.view, 'list')
  blocked.launcher.destroy(); blocked.dom.window.close()
})

test('route navigation invalidates stale folder immediately and restores standard control', async () => {
  const app = setup(); app.update(); await flush(); app.open()
  const old = app.document.querySelector('[data-entry-id]')
  app.window.history.pushState({}, '', '?dir=/different')
  old.click(); await flush()
  assert.equal(app.calls.length, 0); assert.equal(app.document.querySelector('.files-launcher-trigger'), null)
  app.launcher.destroy(); app.dom.window.close()
})

test('multiple pickers replace independently and removal closes their active popover', async () => {
  const app = setup(), first = app.document.querySelector('form'), second = first.cloneNode(true)
  app.document.body.append(second); app.update(); await flush()
  assert.equal(app.document.querySelectorAll('.files-launcher-trigger').length, 2)
  second.querySelector('.files-launcher-trigger').click(); second.remove(); await flush()
  assert.equal(app.document.querySelector('.files-launcher-popover').hidden, true)
  assert.equal(app.document.querySelectorAll('.files-launcher-trigger').length, 1)
  app.launcher.destroy(); app.dom.window.close()
})

test('upload delegates to native input and restores directory flags after cancel/change', async () => {
  const app = setup(); app.update(); await flush(); app.open()
  const input = app.document.querySelector('input'), observed = []
  input.click = () => observed.push([input.hasAttribute('webkitdirectory'), input.multiple])
  app.document.querySelectorAll('.files-launcher-upload-button')[1].click()
  assert.deepEqual(observed, [[true, true]])
  input.dispatchEvent(new app.window.Event('cancel')); assert.equal(input.hasAttribute('webkitdirectory'), false)
  app.document.querySelectorAll('.files-launcher-upload-button')[0].click()
  input.dispatchEvent(new app.window.Event('change')); assert.deepEqual(observed[1], [false, true])
  assert.equal(input.hasAttribute('webkitdirectory'), false)
  app.launcher.destroy(); app.dom.window.close()
})

test('unsafe icon XML and untrusted labels cannot inject event handlers or HTML', async () => {
  const app = setup({ entries: [{ id: 'bad', displayName: '<img src=x onerror=alert(1)>', iconSvgInline: '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><foreignObject><iframe/></foreignObject><path fill="url(https://invalid.test/x)" d="M1 1h5v5H1z"/></svg>', handler() {} }] })
  app.update(); await flush(); app.open()
  const entry = app.document.querySelector('[data-entry-id]')
  assert.match(entry.textContent, /<img src=x/)
  assert.equal(entry.querySelector('img,script,foreignObject,iframe,[onload],[fill^="url"]'), null)
  app.launcher.destroy(); app.dom.window.close()
})

test('standard upload progress and cancel remain visible while the menu trigger is hidden', async () => {
  const app = setup(), style = app.document.createElement('style')
  style.textContent = readFileSync(join(__dirname, '../css/launcher.css'), 'utf8'); app.document.head.append(style)
  const form = app.document.querySelector('form'), progress = app.document.createElement('div'), cancel = app.document.createElement('button')
  progress.className = 'upload-picker__progress'; cancel.className = 'upload-picker__cancel'; cancel.setAttribute('data-cy-upload-picker-cancel', ''); form.append(progress, cancel)
  app.update(); await flush()
  assert.equal(app.window.getComputedStyle(form.querySelector('.action-item')).display, 'none')
  assert.notEqual(app.window.getComputedStyle(progress).display, 'none')
  assert.notEqual(app.window.getComputedStyle(cancel).display, 'none')
  app.launcher.destroy(); app.dom.window.close()
})

test('a retained modal inside a hidden ancestor does not suppress outside click or Escape', async () => {
  const app = setup(), wrapper = app.document.createElement('div'), modal = app.document.createElement('div')
  wrapper.style.display = 'none'; modal.className = 'modal-container'; wrapper.append(modal); app.document.body.append(wrapper)
  app.update(); await flush(); app.open(); app.document.querySelector('main').click()
  assert.equal(app.document.querySelector('.files-launcher-popover').hidden, true)
  app.open(); app.document.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  assert.equal(app.document.querySelector('.files-launcher-popover').hidden, true)
  app.launcher.destroy(); app.dom.window.close()
})

test('browsers without directory capability show only native file upload and preserve input attributes', async () => {
  const app = setup({ folderSupported: false }), input = app.document.querySelector('input')
  input.multiple = false; input.accept = '.png'
  app.update(); await flush(); app.open()
  assert.equal(app.document.querySelectorAll('.files-launcher-upload-button').length, 1)
  input.click = () => { assert.equal(input.multiple, false); assert.equal(input.accept, '.png') }
  app.document.querySelector('.files-launcher-upload-button').click()
  app.launcher.destroy(); app.dom.window.close()
})

test('same folder contents refresh while the dialog is open does not close launcher on cancel', async () => {
  const app = setup(); let cancel
  app.setEntries([{ id: 'folder', displayName: 'Folder', handler: () => new Promise(resolve => { cancel = resolve }) }])
  app.update(); await flush(); app.open(); app.document.querySelector('[data-entry-id]').click()
  app.update({ ...app.folder }); cancel(null); await flush()
  assert.equal(app.document.querySelector('.files-launcher-popover').hidden, false)
  app.launcher.destroy(); app.dom.window.close()
})

test('success closes popover and destroy removes subscriptions and restores native picker', async () => {
  const app = setup(); app.update(); await flush(); app.open()
  app.handlers.get('files:node:created')({ node: { basename: 'created.txt' } })
  assert.equal(app.document.querySelector('.files-launcher-popover').hidden, true)
  app.launcher.destroy(); assert.equal(app.document.querySelector('.files-launcher-trigger'), null); assert.equal(app.document.querySelector('.files-launcher-popover'), null); assert.equal(app.handlers.size, 0)
  app.dom.window.close()
})

test('English is the default and registered entry labels keep their original language', async () => {
  const app = setup({ entries: [{ id: 'custom', displayName: 'Original entry', handler() {} }] })
  app.update(); await flush(); app.open()
  assert.equal(app.document.querySelector('.files-launcher-header h2').textContent, 'Create and upload')
  assert.equal(app.document.querySelector('[data-view-choice="list"]').textContent, 'List')
  assert.equal(app.document.querySelector('[data-entry-id]').textContent, 'Original entry')
  app.launcher.destroy(); app.dom.window.close()
})

test('Japanese catalog translates all owned labels, accessible names and failure messages', async () => {
  const catalog = JSON.parse(readFileSync(join(__dirname, '../l10n/ja.json'), 'utf8')).translations
  const keys = new Set(), app = setup({ translate: message => { keys.add(message); return catalog[message] || message }, entries: [
    { id: 'custom', displayName: 'Original entry', handler() { throw new Error('synthetic failure') } },
    { id: 'other', displayName: 'Registered action', category: 2, handler() {} },
  ] })
  app.update(); await flush(); app.open()
  assert.equal(app.document.querySelector('.files-launcher-trigger').getAttribute('aria-label'), '作成・アップロード')
  assert.equal(app.document.querySelector('.files-launcher-popover').getAttribute('aria-label'), '作成・アップロード')
  assert.equal(app.document.querySelector('.files-launcher-header h2').textContent, '作成・アップロード')
  assert.equal(app.document.querySelector('.files-launcher-close').getAttribute('aria-label'), 'ランチャーを閉じる')
  assert.equal(app.document.querySelector('.files-launcher-switch').getAttribute('aria-label'), '表示形式')
  assert.equal(app.document.querySelector('[data-view-choice="list"]').textContent, 'リスト')
  assert.equal(app.document.querySelector('.files-launcher-other summary').textContent, 'その他の操作')
  assert.equal(app.document.querySelector('[data-entry-id="custom"]').textContent, 'Original entry')
  app.document.querySelector('[data-entry-id="custom"]').click(); await flush()
  assert.equal(app.document.querySelector('.files-launcher-status').textContent, catalog['Unable to complete the action. Please try again.'])
  app.document.querySelector('input').click = () => { throw new Error('synthetic picker failure') }
  app.document.querySelector('.files-launcher-upload-button').click()
  assert.equal(app.document.querySelector('.files-launcher-status').textContent, catalog['Unable to open the file picker.'])
  assert.deepEqual([...keys].sort(), Object.keys(catalog).sort())
  app.launcher.destroy(); app.dom.window.close()
})

test('Nextcloud Japanese JS and JSON catalogs register the same translations and plural rule', () => {
  const json = JSON.parse(readFileSync(join(__dirname, '../l10n/ja.json'), 'utf8')); let registration
  runInNewContext(readFileSync(join(__dirname, '../l10n/ja.js'), 'utf8'), { OC: { L10N: { register(...args) { registration = JSON.parse(JSON.stringify(args)) } } } })
  assert.equal(registration[0], 'files_launcher')
  assert.deepEqual(registration[1], json.translations)
  assert.equal(registration[2], json.pluralForm)
})

test('built fixture uses main integration and Nextcloud l10n for English and Japanese without changing cancel semantics', async () => {
  const html = readFileSync(join(__dirname, 'fixture.html'), 'utf8'), bundle = readFileSync(join(__dirname, 'fixture.js'), 'utf8')
  for (const language of ['en', 'ja']) {
    const dom = new JSDOM(html, { url: `https://cloud.example.test/tests/fixture.html?lang=${language}`, runScripts: 'outside-only' })
    dom.window.eval(bundle); await flush()
    const document = dom.window.document
    assert.ok(dom.window.__filesLauncher)
    document.querySelector('.files-launcher-trigger').click()
    assert.equal(document.querySelector('.files-launcher-header h2').textContent, language === 'ja' ? '作成・アップロード' : 'Create and upload')
    document.querySelector('[data-entry-id="doc"]').click()
    assert.equal(document.querySelector('[role="dialog"] h2').textContent, language === 'ja' ? 'ドキュメント' : 'Document')
    const cancel = [...document.querySelectorAll('[role="dialog"] button')].find(button => button.textContent === (language === 'ja' ? 'キャンセル' : 'Cancel'))
    cancel.click(); await flush()
    assert.equal(document.querySelector('[role="dialog"]'), null)
    assert.equal(document.querySelector('.files-launcher-popover').hidden, false)
    dom.window.__filesLauncher.destroy(); dom.window.close()
  }
})
