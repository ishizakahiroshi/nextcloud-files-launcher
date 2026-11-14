const { test, expect } = require('@playwright/test')

const base = new URL(process.env.NEXTCLOUD_E2E_URL || 'http://127.0.0.1:18080')
if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1' || base.port !== '18080') {
  throw new Error('The end-to-end test only runs against its disposable loopback instance')
}
const username = process.env.NEXTCLOUD_E2E_USER
const password = process.env.NEXTCLOUD_E2E_PASSWORD
if (!username || !password) throw new Error('Disposable test credentials are required')

// Only fixed labels are emitted: browser state, URLs and credentials stay private.
let stage = 'test setup'
test.afterEach(async ({}, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    console.log(`::error title=Nextcloud UI test failed::Stage: ${stage}`)
  }
})

test('real Files launcher keeps the menu after cancel and uses native actions', async ({ page }, testInfo) => {
  // Block all external HTTP(S) requests from the disposable instance.
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== base.origin) await route.abort()
    else await route.continue()
  })
  stage = 'login page'
  await page.goto('/index.php/login')
  expect(new URL(page.url()).origin).toBe(base.origin)
  await page.locator('input[name="user"]').fill(username)
  try {
    await page.locator('input[name="password"]').fill(password)
  } catch {
    // Do not include even the temporary password in an error message or trace.
    throw new Error('The disposable login password input was unavailable')
  }
  stage = 'login submission'
  await page.locator('[data-login-form-submit]').click()
  await expect(page.locator('input[name="password"]')).toHaveCount(0)
  stage = 'open Files'
  await page.goto('/index.php/apps/files/files')

  const trigger = page.locator('.files-launcher-trigger').first()
  const menu = page.locator('.files-launcher-popover')
  stage = 'open launcher'
  await expect(trigger).toBeVisible({ timeout: 60_000 })
  await trigger.click()
  await expect(menu).toBeVisible()
  stage = 'change views'
  await menu.locator('[data-view-choice="grid"]').click()
  await expect(menu).toHaveAttribute('data-view', 'grid')
  await menu.locator('[data-view-choice="list"]').click()
  await expect(menu).toHaveAttribute('data-view', 'list')
  stage = 'restore view after reload'
  await page.reload()
  await expect(trigger).toBeVisible({ timeout: 60_000 })
  await trigger.click()
  await expect(menu).toHaveAttribute('data-view', 'list')
  await page.screenshot({ path: testInfo.outputPath('launcher-list.png'), animations: 'disabled' })

  stage = 'open folder dialog'
  const folder = menu.locator('[data-entry-id="newFolder"]')
  await expect(folder).toBeEnabled()
  await folder.click()
  const dialog = page.locator('[data-cy-files-new-node-dialog]:visible').first()
  await expect(dialog).toBeVisible()
  stage = 'cancel folder dialog'
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(menu).toBeVisible()

  // Choosing a different action after cancel must use the native picker.
  stage = 'upload synthetic file'
  const upload = menu.locator('.files-launcher-upload-button').first()
  await expect(upload).toBeEnabled()
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), upload.click()])
  const fileName = 'launcher-e2e-synthetic.txt'
  await chooser.setFiles({ name: fileName, mimeType: 'text/plain', buffer: Buffer.from('Synthetic launcher test.\n') })
  await expect(page.locator(`[data-cy-files-list-row-name="${fileName}"]`)).toBeVisible({ timeout: 60_000 })

  // Create only a synthetic folder in this disposable server.
  stage = 'create synthetic folder'
  await expect(trigger).toBeVisible()
  if (!(await menu.isVisible())) await trigger.click()
  await folder.click()
  await expect(dialog).toBeVisible()
  const folderName = 'launcher-e2e-synthetic-folder'
  await dialog.locator('[data-cy-files-new-node-dialog-input] input, input[data-cy-files-new-node-dialog-input]').fill(folderName)
  const created = page.waitForResponse(response => response.request().method() === 'MKCOL' && response.url().includes(folderName))
  await dialog.locator('[data-cy-files-new-node-dialog-submit]').click()
  expect((await created).status()).toBe(201)
  await expect(menu).toBeHidden()
})
