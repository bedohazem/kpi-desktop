import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import Database from 'better-sqlite3'
import {
  getDb,
  getDbPath
} from '../database/db'

const BACKUP_FILE_PREFIX = 'KPI_Backup_'
const BACKUPS_TO_KEEP = 7

const PENDING_RESTORE_FILE =
  'pending-restore.sqlite'

const RESTORE_SAFETY_PREFIX =
  'KPI_Before_Restore_'

export type PrepareRestoreResult = {
  success: boolean
  fileName: string
}

type BackupSettings = {
  directory: string
  enabled: boolean
  lastBackupAt: string | null
  lastBackupPath: string | null
  lastError: string | null
}

export type BackupStatus = BackupSettings & {
  configured: boolean
}

function getBackupSettingsPath(): string {
  return path.join(
    app.getPath('userData'),
    'backup-settings.json'
  )
}

function getDefaultSettings(): BackupSettings {
  return {
    directory: '',
    enabled: false,
    lastBackupAt: null,
    lastBackupPath: null,
    lastError: null
  }
}

function readBackupSettings(): BackupSettings {
  const settingsPath = getBackupSettingsPath()

  if (!fs.existsSync(settingsPath)) {
    return getDefaultSettings()
  }

  try {
    const fileContent = fs.readFileSync(settingsPath, 'utf8')

    const parsed = JSON.parse(
      fileContent
    ) as Partial<BackupSettings>

    return {
      directory:
        typeof parsed.directory === 'string'
          ? parsed.directory
          : '',

      enabled: Boolean(parsed.enabled),

      lastBackupAt:
        typeof parsed.lastBackupAt === 'string'
          ? parsed.lastBackupAt
          : null,

      lastBackupPath:
        typeof parsed.lastBackupPath === 'string'
          ? parsed.lastBackupPath
          : null,

      lastError:
        typeof parsed.lastError === 'string'
          ? parsed.lastError
          : null
    }
  } catch {
    return getDefaultSettings()
  }
}

function writeBackupSettings(
  settings: BackupSettings
): void {
  const settingsPath = getBackupSettingsPath()

  fs.mkdirSync(
    path.dirname(settingsPath),
    { recursive: true }
  )

  fs.writeFileSync(
    settingsPath,
    JSON.stringify(settings, null, 2),
    'utf8'
  )
}

function formatBackupDate(date: Date): string {
  const pad = (value: number): string =>
    String(value).padStart(2, '0')

  const datePart = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-')

  const timePart = [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('-')

  return `${datePart}_${timePart}`
}

function deleteOldBackups(directory: string): void {
  if (!fs.existsSync(directory)) {
    return
  }

  const backupFiles = fs
    .readdirSync(directory, {
      withFileTypes: true
    })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.startsWith(BACKUP_FILE_PREFIX) &&
        entry.name.toLowerCase().endsWith('.sqlite')
    )
    .map((entry) => {
      const filePath = path.join(
        directory,
        entry.name
      )

      return {
        filePath,
        modifiedAt: fs.statSync(filePath).mtimeMs
      }
    })
    .sort(
      (first, second) =>
        second.modifiedAt - first.modifiedAt
    )

  const oldBackups = backupFiles.slice(
    BACKUPS_TO_KEEP
  )

  for (const backup of oldBackups) {
    fs.unlinkSync(backup.filePath)
  }
}

export function getBackupStatus(): BackupStatus {
  const settings = readBackupSettings()

  return {
    ...settings,
    configured: Boolean(settings.directory)
  }
}

export function setBackupDirectory(
  directory: string
): BackupStatus {
  const cleanDirectory = directory.trim()

  if (!cleanDirectory) {
    throw new Error(
      'مكان النسخ الاحتياطي غير صحيح'
    )
  }

  fs.mkdirSync(cleanDirectory, {
    recursive: true
  })

  const currentSettings =
    readBackupSettings()

  writeBackupSettings({
    ...currentSettings,
    directory: cleanDirectory,
    enabled: true,
    lastError: null
  })

  return getBackupStatus()
}

export function setBackupEnabled(
  enabled: boolean
): BackupStatus {
  const settings = readBackupSettings()

  if (enabled && !settings.directory) {
    throw new Error(
      'اختار مكان النسخ الاحتياطي الأول'
    )
  }

  writeBackupSettings({
    ...settings,
    enabled,
    lastError: null
  })

  return getBackupStatus()
}

export async function createBackup(): Promise<BackupStatus> {
  const settings = readBackupSettings()

  if (!settings.directory) {
    throw new Error(
      'اختار مكان النسخ الاحتياطي الأول'
    )
  }

  try {
    fs.mkdirSync(settings.directory, {
      recursive: true
    })

    const backupFileName =
      `${BACKUP_FILE_PREFIX}` +
      `${formatBackupDate(new Date())}.sqlite`

    const backupPath = path.join(
      settings.directory,
      backupFileName
    )

    await getDb().backup(backupPath)

    deleteOldBackups(settings.directory)

    writeBackupSettings({
      ...settings,
      lastBackupAt: new Date().toISOString(),
      lastBackupPath: backupPath,
      lastError: null
    })

    return getBackupStatus()
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'فشل إنشاء النسخة الاحتياطية'

    writeBackupSettings({
      ...settings,
      lastError: errorMessage
    })

    throw new Error(errorMessage)
  }
}

export async function runAutomaticBackup(): Promise<BackupStatus> {
  const settings = readBackupSettings()

  if (!settings.enabled || !settings.directory) {
    return getBackupStatus()
  }

  return createBackup()
}

function getPendingRestorePath(): string {
  return path.join(
    app.getPath('userData'),
    PENDING_RESTORE_FILE
  )
}

function validateRestoreFile(
  filePath: string
): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      'ملف النسخة الاحتياطية غير موجود'
    )
  }

  let restoreDb: Database.Database | null = null

  try {
    restoreDb = new Database(filePath, {
      readonly: true,
      fileMustExist: true
    })

    const integrityResult = restoreDb
      .prepare('PRAGMA integrity_check')
      .get() as {
        integrity_check?: string
      }

    if (
      integrityResult.integrity_check !== 'ok'
    ) {
      throw new Error(
        'ملف النسخة الاحتياطية تالف'
      )
    }

    const tables = restoreDb
      .prepare(
        `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name IN (
            'departments',
            'employees',
            'monthly_evaluations'
          )
      `
      )
      .all() as Array<{
        name: string
      }>

    const tableNames = new Set(
      tables.map((table) => table.name)
    )

    const requiredTables = [
      'departments',
      'employees',
      'monthly_evaluations'
    ]

    const hasAllTables =
      requiredTables.every((tableName) =>
        tableNames.has(tableName)
      )

    if (!hasAllTables) {
      throw new Error(
        'الملف ليس نسخة صحيحة من بيانات البرنامج'
      )
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (
        error.message.includes('تالف') ||
        error.message.includes('ليس نسخة')
      )
    ) {
      throw error
    }

    throw new Error(
      'تعذر قراءة ملف النسخة الاحتياطية'
    )
  } finally {
    restoreDb?.close()
  }
}

export function prepareRestore(
  filePath: string
): PrepareRestoreResult {
  validateRestoreFile(filePath)

  const pendingRestorePath =
    getPendingRestorePath()

  fs.copyFileSync(
    filePath,
    pendingRestorePath
  )

  return {
    success: true,
    fileName: path.basename(filePath)
  }
}

export function applyPendingRestore(): boolean {
  const pendingRestorePath =
    getPendingRestorePath()

  if (!fs.existsSync(pendingRestorePath)) {
    return false
  }

  const databasePath = getDbPath()
  const databaseDirectory =
    path.dirname(databasePath)

  fs.mkdirSync(databaseDirectory, {
    recursive: true
  })

  if (fs.existsSync(databasePath)) {
    const safetyBackupPath = path.join(
      app.getPath('userData'),
      `${RESTORE_SAFETY_PREFIX}` +
        `${formatBackupDate(new Date())}.sqlite`
    )

    fs.copyFileSync(
      databasePath,
      safetyBackupPath
    )
  }

  const walPath = `${databasePath}-wal`
  const shmPath = `${databasePath}-shm`

  if (fs.existsSync(walPath)) {
    fs.unlinkSync(walPath)
  }

  if (fs.existsSync(shmPath)) {
    fs.unlinkSync(shmPath)
  }

  fs.copyFileSync(
    pendingRestorePath,
    databasePath
  )

  fs.unlinkSync(pendingRestorePath)

  return true
}