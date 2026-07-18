import {
  app,
  dialog,
  ipcMain,
  shell
} from 'electron'
import {
  createBackup,
  getBackupStatus,
  prepareRestore,
  setBackupDirectory,
  setBackupEnabled
} from '../services/backup.service'

export function registerBackupIpc(): void {
  ipcMain.handle(
    'backup:get-status',
    () => getBackupStatus()
  )

  ipcMain.handle(
    'backup:choose-directory',
    async () => {
      const result = await dialog.showOpenDialog({
        title: 'اختيار مكان النسخ الاحتياطي',
        properties: [
          'openDirectory',
          'createDirectory'
        ]
      })

      if (
        result.canceled ||
        result.filePaths.length === 0
      ) {
        return {
          canceled: true,
          status: getBackupStatus()
        }
      }

      const directory = result.filePaths[0]

      return {
        canceled: false,
        status: setBackupDirectory(directory)
      }
    }
  )

  ipcMain.handle(
    'backup:create-now',
    async () => createBackup()
  )

  ipcMain.handle(
    'backup:set-enabled',
    (_event, enabled: boolean) =>
      setBackupEnabled(Boolean(enabled))
  )

  ipcMain.handle(
    'backup:open-directory',
    async () => {
      const status = getBackupStatus()

      if (!status.directory) {
        throw new Error(
          'اختار مكان النسخ الاحتياطي الأول'
        )
      }

      const errorMessage = await shell.openPath(
        status.directory
      )

      if (errorMessage) {
        throw new Error(errorMessage)
      }

      return {
        success: true
      }
    }
  )

  ipcMain.handle(
    'backup:choose-restore-file',
    async () => {
      const result = await dialog.showOpenDialog({
        title: 'اختيار نسخة احتياطية للاستعادة',
        properties: ['openFile'],
        filters: [
          {
            name: 'نسخ قاعدة البيانات',
            extensions: ['sqlite', 'db']
          }
        ]
      })

      if (
        result.canceled ||
        result.filePaths.length === 0
      ) {
        return {
          canceled: true,
          result: null
        }
      }

      const restoreResult = prepareRestore(
        result.filePaths[0]
      )

      return {
        canceled: false,
        result: restoreResult
      }
    }
  )

  ipcMain.handle(
    'backup:restart-after-restore',
    () => {
      app.relaunch()
      app.exit(0)

      return {
        success: true
      }
    }
  )

}