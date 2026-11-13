import { addNewFileMenuEntry } from '@nextcloud/files'
import { emit } from '@nextcloud/event-bus'
import { register, setLanguage } from '@nextcloud/l10n'
import japanese from '../l10n/ja.json'
import '../js/src/main'

const language = new URLSearchParams(window.location.search).get('lang') === 'ja' ? 'ja' : 'en'
const local = (english, japanese) => language === 'ja' ? japanese : english
setLanguage(language)
if (language === 'ja') register('files_launcher', japanese.translations)
const folder = { source: '/remote.php/dav/files/demo/', path: '/', permissions: 31 }
const status = document.getElementById('fixture-status')
status.textContent = local('Local fixture using the production controller and Nextcloud APIs. All data is synthetic.', '実装コードとNextcloud公開APIを使用するローカル確認用画面。データはすべて合成です。')
document.getElementById('fixture-title').textContent = local('Nextcloud / Files Launcher fixture', 'Nextcloud / Files Launcher 実装fixture')
document.querySelector('.standard').textContent = local('New (standard entry)', '新規作成（標準入口）')
const languagePicker = document.getElementById('fixture-language')
languagePicker.value = language
languagePicker.addEventListener('change', () => { const url = new URL(window.location.href); url.searchParams.set('lang', languagePicker.value); window.location.href = url.toString() })
document.getElementById('fixture-theme').textContent = local('Light theme', 'ライト表示')
document.getElementById('fixture-theme').addEventListener('click', event => {
  const light = document.body.dataset.theme !== 'light'
  document.body.dataset.theme = light ? 'light' : 'dark'
  event.currentTarget.textContent = light ? local('Dark theme', 'ダーク表示') : local('Light theme', 'ライト表示')
})
function nameDialog(label, next) {
  return new Promise(resolve => {
    const backdrop = document.createElement('div'); backdrop.className = 'fixture-backdrop'
    const modal = document.createElement('form'); modal.className = 'fixture-modal'; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true')
    const title = document.createElement('h2'); title.textContent = label
    const input = document.createElement('input'); input.value = local('New ', '新しい') + label; input.setAttribute('aria-label', local('Name', '名前'))
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = local('Cancel', 'キャンセル')
    const create = document.createElement('button'); create.type = 'submit'; create.textContent = next ? local('Next', '次へ') : local('Create', '作成')
    function finish(value) { backdrop.remove(); resolve(value) }
    cancel.onclick = () => finish(null)
    modal.onsubmit = event => { event.preventDefault(); finish(input.value) }
    modal.onkeydown = event => { if (event.key === 'Escape') { event.stopPropagation(); finish(null) } }
    modal.append(title, input, cancel, create); backdrop.append(modal); document.body.append(backdrop); input.focus(); input.select()
  })
}
const colors = ['#219be7', '#438dd3', '#3b9c68', '#d89435', '#8c99a7', '#d65d6b']
for (const [index, [id, english, japanese]] of [['folder', 'Folder', 'フォルダー'], ['doc', 'Document', 'ドキュメント'], ['sheet', 'Spreadsheet', 'スプレッドシート'], ['slides', 'Presentation', 'プレゼンテーション'], ['text', 'Text file', 'テキストファイル'], ['pdf', 'PDF form', 'PDFフォーム']].entries()) {
  const name = local(english, japanese)
  addNewFileMenuEntry({ id, displayName: name, order: index, iconSvgInline: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 36"><path fill="${colors[index]}" d="M5 1h15l7 7v27H5z"/><path fill="#fff" opacity=".7" d="M20 1v7h7M10 16h12v2H10zm0 6h12v2H10zm0 6h8v2h-8z"/></svg>`, handler: async () => {
    const chosenName = await nameDialog(name, id === 'doc')
    if (chosenName === null) return
    if (id === 'doc') { nameDialog(local('Choose a template', 'テンプレートを選択'), false).then(result => { if (result !== null) created(result) }); return }
    created(chosenName)
  } })
}
function created(name) { status.textContent = local('Created (synthetic data): ', '作成（合成データ）: ') + name; emit('files:node:created', { node: { basename: name } }) }
document.querySelector('input[data-cy-upload-picker-input]').addEventListener('click', event => {
  event.preventDefault(); status.textContent = event.currentTarget.hasAttribute('webkitdirectory') ? local('Native folder picker connected (fixture)', '標準フォルダー選択へ接続（fixture）') : local('Native file picker connected (fixture)', '標準ファイル選択へ接続（fixture）')
})
emit('files:list:updated', { view: { id: 'files' }, folder, contents: [] })
