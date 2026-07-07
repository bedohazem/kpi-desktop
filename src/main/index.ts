import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initDb, getDb } from './db'

type DbTestResult = {
  ok: boolean
  dbPath: string
  departmentsCount: number
}

type DepartmentRow = {
  id: number
  name: string
  parent_id: number | null
  parent_name: string | null
  notes: string | null
  active: number
  created_at: string
  updated_at: string
}

type CreateDepartmentInput = {
  name: string
  parent_id: number | null
  notes: string
  active: boolean
}

type MutationResult = {
  success: boolean
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  const dbPath = initDb()

  ipcMain.handle('db:test', (): DbTestResult => {
    const db = getDb()
    const row = db.prepare('SELECT COUNT(*) as count FROM departments').get() as {
      count: number
    }

    return {
      ok: true,
      dbPath,
      departmentsCount: row.count
    }
  })

  ipcMain.handle('departments:list', (): DepartmentRow[] => {
    const db = getDb()

    return db
      .prepare(
        `
        SELECT
          d.id,
          d.name,
          d.parent_id,
          p.name AS parent_name,
          d.notes,
          d.active,
          d.created_at,
          d.updated_at
        FROM departments d
        LEFT JOIN departments p ON p.id = d.parent_id
        ORDER BY d.name
      `
      )
      .all() as DepartmentRow[]
  })

  ipcMain.handle('departments:create', (_event, data: CreateDepartmentInput): MutationResult => {
    const name = data.name.trim()

    if (!name) {
      throw new Error('اسم الإدارة مطلوب')
    }

    const db = getDb()

    db.prepare(
      `
      INSERT INTO departments (name, parent_id, notes, active)
      VALUES (@name, @parent_id, @notes, @active)
    `
    ).run({
      name,
      parent_id: data.parent_id,
      notes: data.notes.trim(),
      active: data.active ? 1 : 0
    })

    return { success: true }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
