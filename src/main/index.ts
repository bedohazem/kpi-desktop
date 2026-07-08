import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron'
import path from 'node:path'
import { getDb, initDb } from './database/db'
import { registerDepartmentsIpc } from './ipc/departments.ipc'
import { registerEmployeesIpc } from './ipc/employees.ipc'

type DbTestResult = {
  ok: boolean
  dbPath: string
  departmentsCount: number
}

let mainWindow: BrowserWindow | null = null

const appRoot = app.isPackaged ? app.getAppPath() : process.cwd()

Menu.setApplicationMenu(null)

function createWindow(): void {
  const preloadPath = path.join(appRoot, 'preload.cjs')

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 850,
    minWidth: 900,
    minHeight: 650,
    show: false,
    backgroundColor: '#f3f4f6',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath
    }
  })

  mainWindow.setMenu(null)
  mainWindow.setMenuBarVisibility(false)

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (!app.isPackaged) {
    void mainWindow.loadURL('http://localhost:3000')
  } else {
    void mainWindow.loadFile(path.join(appRoot, 'dist', 'renderer', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
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

  registerDepartmentsIpc()
  registerEmployeesIpc()

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