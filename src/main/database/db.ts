import Database from 'better-sqlite3'
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

let db: Database.Database | null = null

export function getDbPath(): string {
  const dataDir = path.join(app.getPath('userData'), 'data')

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  return path.join(dataDir, 'kpi.sqlite')
}

function migrateDb(database: Database.Database): void {
  database.pragma('foreign_keys = ON')

  database.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      parent_id INTEGER,
      notes TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(parent_id) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_number TEXT UNIQUE,
      name TEXT NOT NULL,
      national_id TEXT,
      qualification TEXT,
      job_title TEXT,
      department_id INTEGER,
      notes TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(department_id) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS monthly_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      evaluation_value REAL DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(employee_id) REFERENCES employees(id),
      UNIQUE(employee_id, month, year)
    );
  `)
}

export function initDb(): string {
  const dbPath = getDbPath()

  if (!db) {
    db = new Database(dbPath)
    migrateDb(db)
  }

  return dbPath
}

export function getDb(): Database.Database {
  if (!db) {
    initDb()
  }

  if (!db) {
    throw new Error('Database is not initialized')
  }

  return db
}