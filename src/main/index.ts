import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
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

type EmployeeRow = {
  id: number
  employee_number: string | null
  name: string
  national_id: string | null
  qualification: string | null
  job_title: string | null
  department_id: number | null
  department_name: string | null
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

type CreateEmployeeInput = {
  employee_number: string
  name: string
  national_id: string
  qualification: string
  job_title: string
  department_id: number | null
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

  ipcMain.handle('employees:list', (): EmployeeRow[] => {
    const db = getDb()

    return db
      .prepare(
        `
        SELECT
          e.id,
          e.employee_number,
          e.name,
          e.national_id,
          e.qualification,
          e.job_title,
          e.department_id,
          d.name AS department_name,
          e.notes,
          e.active,
          e.created_at,
          e.updated_at
        FROM employees e
        LEFT JOIN departments d ON d.id = e.department_id
        ORDER BY e.name
      `
      )
      .all() as EmployeeRow[]
  })

  ipcMain.handle('employees:create', (_event, data: CreateEmployeeInput): MutationResult => {
    const employeeNumber = data.employee_number.trim()
    const name = data.name.trim()

    if (!employeeNumber) {
      throw new Error('رقم الموظف مطلوب')
    }

    if (!name) {
      throw new Error('اسم الموظف مطلوب')
    }

    const nationalId = data.national_id.trim()

    if (!/^\d{14}$/.test(nationalId)) {
      throw new Error('الرقم القومي لازم يكون 14 رقم بالظبط')
    }

    const db = getDb()

    try {
      db.prepare(
        `
        INSERT INTO employees (
          employee_number,
          name,
          national_id,
          qualification,
          job_title,
          department_id,
          notes,
          active
        )
        VALUES (
          @employee_number,
          @name,
          @national_id,
          @qualification,
          @job_title,
          @department_id,
          @notes,
          @active
        )
      `
      ).run({
        employee_number: employeeNumber,
        name,
        national_id: nationalId,
        qualification: data.qualification.trim(),
        job_title: data.job_title.trim(),
        department_id: data.department_id,
        notes: data.notes.trim(),
        active: data.active ? 1 : 0
      })
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE')) {
        throw new Error('رقم الموظف موجود قبل كده')
      }

      throw error
    }

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
