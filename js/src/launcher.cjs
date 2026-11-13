/* SPDX-License-Identifier: AGPL-3.0-or-later */
'use strict'

const PICKER = '.files-list__header-upload-button[data-cy-upload-picker]'
const INPUT = 'input[data-cy-upload-picker-input]'
const STORAGE_KEY = 'files_launcher:view:v1'
const SVG_NS = 'http://www.w3.org/2000/svg'
const MODAL = 'dialog[open], [role="dialog"], [aria-modal="true"], .modal-container, .oc-dialog'

function createFilesLauncher({ window, document, getEntries, subscribe, unsubscribe = () => {}, isPublic = () => false, translate = message => message }) {
  let context = null, opener = null, busy = false, destroyed = false, mode = 'grid'
  let refreshQueued = false, popover = null, entryArea = null, message = null
  const controls = new Map(), listeners = [], busListeners = [], uploadCleanups = new Map()
  const listen = (target, name, handler, options) => {
    target.addEventListener(name, handler, options)
    listeners.push(() => target.removeEventListener(name, handler, options))
  }
  const bus = (name, handler) => { subscribe(name, handler); busListeners.push(() => unsubscribe(name, handler)) }
  try { mode = window.localStorage.getItem(STORAGE_KEY) === 'list' ? 'list' : 'grid' } catch (_) {}
  function route() {
    const router = window.OCP?.Files?.Router
    return JSON.stringify([window.location.pathname, window.location.search, window.location.hash, router?.name, router?.query, router?.params])
  }
  function usable() {
    try { return !isPublic() && context && context.route === route() && context.folder && Array.isArray(context.contents) }
    catch (_) { return false }
  }
  function contextKey(value) {
    return value && JSON.stringify([value.route, value.folder?.source, value.folder?.path, value.folder?.fileid, value.folder?.id])
  }
  function element(tag, className, text) {
    const node = document.createElement(tag)
    if (className) node.className = className
    if (text !== undefined) node.textContent = text
    return node
  }
  function button(className, text, handler) {
    const node = element('button', className, text)
    node.type = 'button'
    if (handler) node.addEventListener('click', handler)
    return node
  }
  function icon(kind) {
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true')
    if (kind === 'launcher') {
      for (const x of [5, 12, 19]) for (const y of [5, 12, 19]) {
        const circle = document.createElementNS(SVG_NS, 'circle')
        circle.setAttribute('cx', x); circle.setAttribute('cy', y); circle.setAttribute('r', '1.8'); circle.setAttribute('fill', 'currentColor'); svg.append(circle)
      }
    } else {
      const path = document.createElementNS(SVG_NS, 'path')
      const paths = { close: 'M6 6 18 18M6 18 18 6', upload: 'M12 16V3M7 8l5-5 5 5M4 15v6h16v-6', folder: 'M3 6h7l2 3h9v11H3z', file: 'M5 2h9l5 5v15H5zM14 2v6h5M8 12h8M8 16h8', list: 'M8 5h13M8 12h13M8 19h13M3 5h1M3 12h1M3 19h1', grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' }
      path.setAttribute('d', paths[kind] || paths.file); path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '1.8'); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round'); svg.append(path)
    }
    return svg
  }
  // Entry icons come from app registrations. Rebuild only drawing primitives and
  // attributes; never inject the supplied XML, event handlers, URLs or foreignObject.
  function entryIcon(xml) {
    if (typeof xml !== 'string' || xml.length > 50000) return icon('file')
    try {
      const parsed = new window.DOMParser().parseFromString(xml, 'image/svg+xml')
      if (parsed.querySelector('parsererror') || parsed.documentElement.localName !== 'svg') return icon('file')
      const tags = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'title'])
      const attrs = new Set(['viewBox', 'd', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'points', 'fill', 'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'transform'])
      let count = 0
      function copy(source, depth) {
        if (depth > 20 || ++count > 300 || !tags.has(source.localName)) return null
        const target = document.createElementNS(SVG_NS, source.localName)
        for (const attribute of source.attributes) {
          if (attrs.has(attribute.name) && !/url\s*\(|[<>]|javascript:|data:|https?:/i.test(attribute.value)) target.setAttribute(attribute.name, attribute.value)
        }
        // Standard folder icons carry their colour on the SVG root. Copy only
        // the parsed colour declaration, never arbitrary styles or URL values.
        const style = document.createElement('span').style
        style.cssText = source.getAttribute('style') || ''
        if (style.color && !/url\s*\(|[<>]|javascript:|data:|https?:/i.test(style.color)) target.style.color = style.color
        if (source.localName === 'title') target.textContent = source.textContent
        else for (const child of source.children) { const next = copy(child, depth + 1); if (next) target.append(next) }
        return target
      }
      const svg = copy(parsed.documentElement, 0)
      svg.setAttribute('aria-hidden', 'true'); svg.removeAttribute('width'); svg.removeAttribute('height')
      return svg
    } catch (_) { return icon('file') }
  }
  function currentEntries() {
    if (!usable()) return []
    return getEntries(context.folder).filter(entry => entry && typeof entry.id === 'string' && typeof entry.handler === 'function' && typeof entry.displayName === 'string')
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => (a.entry.order !== undefined && b.entry.order !== undefined ? a.entry.order - b.entry.order : 0) || a.index - b.index)
      .map(item => item.entry)
  }
  function modalOpen() {
    return [...document.querySelectorAll(MODAL)].some(node => {
      for (let current = node; current; current = current.parentElement) {
        const style = window.getComputedStyle(current)
        if (current.hidden || current.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false
      }
      return true
    })
  }
  function close(focus = false) {
    if (popover) popover.hidden = true
    for (const control of controls.values()) control.trigger.setAttribute('aria-expanded', 'false')
    if (focus && opener?.trigger.isConnected) opener.trigger.focus()
    opener = null
  }
  function position() {
    if (!popover || popover.hidden || !opener) return
    const bounds = opener.trigger.getBoundingClientRect(), width = popover.getBoundingClientRect().width || 420
    popover.style.left = `${Math.max(8, Math.min(bounds.left, window.innerWidth - width - 8))}px`
    popover.style.top = `${Math.max(8, Math.min(bounds.bottom + 8, window.innerHeight - Math.min(popover.scrollHeight, window.innerHeight - 16) - 8))}px`
    popover.style.maxHeight = `${Math.max(120, window.innerHeight - 16)}px`
  }
  function chooseMode(next) {
    mode = next
    popover.dataset.view = mode
    for (const control of popover.querySelectorAll('[data-view-choice]')) control.setAttribute('aria-pressed', String(control.dataset.viewChoice === mode))
    try { window.localStorage.setItem(STORAGE_KEY, mode) } catch (_) {}
    position()
  }
  function buildPopover() {
    popover = element('section', 'files-launcher-popover'); popover.hidden = true; popover.dataset.view = mode
    popover.id = 'files-launcher-popover'; popover.setAttribute('aria-label', translate('Create and upload'))
    const header = element('div', 'files-launcher-header'), heading = element('h2', '', translate('Create and upload'))
    const dismiss = button('files-launcher-close', '', () => close(true)); dismiss.setAttribute('aria-label', translate('Close launcher')); dismiss.append(icon('close')); header.append(heading, dismiss)
    const toolbar = element('div', 'files-launcher-viewbar'), label = element('span', '', translate('View')), switches = element('div', 'files-launcher-switch')
    switches.setAttribute('role', 'group'); switches.setAttribute('aria-label', translate('Display mode'))
    for (const [value, name] of [['grid', translate('Icons')], ['list', translate('List')]]) {
      const control = button('', '', () => chooseMode(value)); control.dataset.viewChoice = value; control.setAttribute('aria-pressed', String(mode === value)); control.append(icon(value), element('span', '', name)); switches.append(control)
    }
    toolbar.append(label, switches); entryArea = element('div', 'files-launcher-entries')
    message = element('div', 'files-launcher-status'); message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite')
    popover.append(header, toolbar, entryArea, message); document.body.append(popover)
    listen(popover, 'keydown', event => {
      if (busy || modalOpen()) return
      const items = [...popover.querySelectorAll('button:not(:disabled)')], at = items.indexOf(document.activeElement)
      if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); const delta = ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1
        items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (at + delta + items.length) % items.length]?.focus()
      }
    })
  }
  function section(label, className) {
    const group = element('div', className)
    if (label) group.append(element('h3', 'files-launcher-section-label', label))
    const items = element('div', 'files-launcher-items'); group.append(items); entryArea.append(group)
    return items
  }
  async function runEntry(id, control) {
    if (busy || !usable() || !opener?.form.isConnected) return
    const entry = currentEntries().find(item => item.id === id)
    if (!entry) { refreshPopover(); return }
    const captured = context
    busy = true; setDisabled(true); message.textContent = ''
    try { await entry.handler(captured.folder, captured.contents) }
    catch (_) { message.textContent = translate('Unable to complete the action. Please try again.') }
    finally {
      busy = false; setDisabled(false)
      if (!usable() || contextKey(context) !== contextKey(captured)) close()
      // Template handlers may return before their picker closes. Do not steal
      // focus from that second standard modal, or close the launcher on cancel.
      else if (!popover.hidden && !modalOpen()) control.focus()
    }
  }
  function setDisabled(disabled) { for (const action of entryArea.querySelectorAll('button')) action.disabled = disabled }
  function upload(directory) {
    if (busy || !usable() || !opener?.form.isConnected) { close(); scheduleRefresh(); return }
    const input = opener.form.querySelector(INPUT)
    if (!input || input.disabled) { close(); return }
    uploadCleanups.get(input)?.()
    const foldersSupported = 'webkitdirectory' in document.createElement('input')
    if (directory && !foldersSupported) return
    const directoryBefore = input.webkitdirectory
    if (foldersSupported) input.webkitdirectory = directory
    let cleaned = false
    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      if (foldersSupported) input.webkitdirectory = directoryBefore
      input.removeEventListener('change', cleanup); input.removeEventListener('cancel', cleanup)
      uploadCleanups.delete(input)
    }
    uploadCleanups.set(input, cleanup)
    input.addEventListener('change', cleanup, { once: true }); input.addEventListener('cancel', cleanup, { once: true })
    try { input.click() } catch (_) { cleanup(); message.textContent = translate('Unable to open the file picker.') }
  }
  function refreshPopover() {
    if (!popover || popover.hidden) return
    if (!usable() || !opener?.form.isConnected) { close(); return }
    let entries
    try { entries = currentEntries() } catch (_) { close(); restoreControls(); return }
    entryArea.replaceChildren()
    const createEntries = entries.filter(entry => (entry.category ?? 1) === 1)
    const uploadEntries = entries.filter(entry => entry.category === 0)
    const otherEntries = entries.filter(entry => ![0, 1].includes(entry.category ?? 1))
    function appendEntry(group, entry) {
      const action = button('files-launcher-entry', '', () => runEntry(entry.id, action)); action.dataset.entryId = entry.id
      const image = element('span', 'files-launcher-entry-icon'); image.append(entryIcon(entry.iconSvgInline)); action.append(image, element('span', '', entry.displayName)); action.disabled = busy; group.append(action)
    }
    if (createEntries.length) { const group = section('', 'files-launcher-create'); createEntries.forEach(entry => appendEntry(group, entry)) }
    const uploads = section(translate('Upload from device'), 'files-launcher-upload')
    for (const [directory, text, glyph] of [[false, translate('Files'), 'upload'], [true, translate('Folders'), 'folder']]) {
      if (directory && !('webkitdirectory' in document.createElement('input'))) continue
      const action = button('files-launcher-upload-button', '', () => upload(directory)); action.append(icon(glyph), element('span', '', text)); action.disabled = busy; uploads.append(action)
    }
    uploadEntries.forEach(entry => appendEntry(uploads, entry))
    if (otherEntries.length) {
      const details = element('details', 'files-launcher-other'), summary = element('summary', '', translate('Other actions')), items = element('div', 'files-launcher-items')
      otherEntries.forEach(entry => appendEntry(items, entry)); details.append(summary, items); entryArea.append(details)
    }
    position()
  }
  function open(control) {
    if (!usable()) { scheduleRefresh(); return }
    if (!popover) buildPopover()
    if (!popover.hidden && opener === control) { close(true); return }
    close(); opener = control; popover.hidden = false; control.trigger.setAttribute('aria-expanded', 'true'); message.textContent = ''; refreshPopover(); position()
    if (!popover.hidden) popover.querySelector('.files-launcher-entry, .files-launcher-upload-button')?.focus()
  }
  function restore(control) {
    control.trigger.remove(); control.form.classList.remove('files-launcher-ready'); controls.delete(control.form)
    if (opener === control) close()
  }
  function restoreControls() { for (const control of [...controls.values()]) restore(control) }
  function refreshControls() {
    refreshQueued = false
    if (destroyed) return
    if (!usable()) { close(); restoreControls(); return }
    const forms = new Set(document.querySelectorAll(PICKER))
    for (const control of [...controls.values()]) if (!forms.has(control.form) || !control.form.isConnected || !control.form.querySelector(INPUT) || control.form.querySelector(INPUT).disabled) restore(control)
    for (const form of forms) {
      if (controls.has(form) || !form.querySelector(INPUT) || form.querySelector(INPUT).disabled || !form.querySelector('button')) continue
      // Fail open if the registry is not ready. Nothing in the original picker is
      // hidden until a complete replacement control exists.
      try { if (!currentEntries().length) continue } catch (_) { continue }
      const trigger = button('files-launcher-trigger', '', () => open(control))
      trigger.setAttribute('aria-label', translate('Create and upload')); trigger.title = translate('Create and upload'); trigger.setAttribute('aria-expanded', 'false'); trigger.setAttribute('aria-controls', 'files-launcher-popover'); trigger.append(icon('launcher'))
      const control = { form, trigger }
      form.append(trigger); controls.set(form, control); form.classList.add('files-launcher-ready')
    }
  }
  function scheduleRefresh() {
    if (refreshQueued || destroyed) return
    refreshQueued = true; window.queueMicrotask(refreshControls)
  }
  function update(payload) {
    if (!payload?.folder || !Array.isArray(payload.contents)) { context = null; scheduleRefresh(); return }
    const previous = context
    context = { ...payload, route: route() }
    if (previous && contextKey(previous) !== contextKey(context)) close()
    scheduleRefresh()
    if (!busy) refreshPopover()
  }
  function invalidate() { if (context?.route !== route()) { context = null; close(); restoreControls() } }
  // Capture sees the modal before its cancel handler removes it. A bubbling
  // outside-click listener would also close the launcher on the same click.
  listen(document, 'click', event => {
    if (!popover || popover.hidden || busy || modalOpen() || event.target.closest?.(MODAL)) return
    if (!popover.contains(event.target) && ![...controls.values()].some(control => control.trigger.contains(event.target))) close()
  }, true)
  listen(document, 'keydown', event => {
    invalidate()
    if (event.key === 'Escape' && popover && !popover.hidden && !busy && !modalOpen() && !event.target.closest?.(MODAL)) { event.preventDefault(); close(true) }
  }, true)
  listen(window, 'popstate', invalidate); listen(window, 'hashchange', invalidate)
  listen(window, 'resize', position); listen(window, 'scroll', position, true)
  // Vue route transitions also replace DOM without popstate. The route snapshot
  // is checked before every action, so pending route data can never be reused.
  const observer = new window.MutationObserver(records => {
    invalidate()
    if (records.some(record => !popover?.contains(record.target) && ![...controls.values()].some(control => control.trigger.contains(record.target)))) scheduleRefresh()
  })
  function start() { if (destroyed) return; observer.observe(document.body, { childList: true, subtree: true }); scheduleRefresh() }
  bus('files:list:updated', update)
  bus('files:node:created', () => { if (popover && !popover.hidden) close() })
  if (document.body) start(); else listen(document, 'DOMContentLoaded', start, { once: true })
  return {
    destroy() { destroyed = true; observer.disconnect(); close(); restoreControls(); popover?.remove(); [...uploadCleanups.values()].forEach(cleanup => cleanup()); listeners.forEach(remove => remove()); busListeners.forEach(remove => remove()) },
  }
}

module.exports = { createFilesLauncher, STORAGE_KEY }
