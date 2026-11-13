import { subscribe, unsubscribe } from '@nextcloud/event-bus'
import { getNewFileMenuEntries } from '@nextcloud/files'
import { t } from '@nextcloud/l10n'
import { isPublicShare } from '@nextcloud/sharing/public'
import { createFilesLauncher } from './launcher.cjs'

// Init scripts run before Files mounts. A missed initial context deliberately leaves
// the standard UploadPicker visible instead of guessing a destination.
if (!window.__filesLauncher) {
  window.__filesLauncher = createFilesLauncher({
    window,
    document,
    getEntries: getNewFileMenuEntries,
    subscribe,
    unsubscribe,
    isPublic: isPublicShare,
    translate: message => t('files_launcher', message),
  })
}
