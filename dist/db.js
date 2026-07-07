"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDb = initDb;
exports.getDb = getDb;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
const initSqlJs = require("sql.js");
let db;
let dbPath = "";
function normalizeParams(params) {
    if (params === undefined || params === null)
        return [];
    if (Array.isArray(params))
        return params;
    if (typeof params !== "object") {
        return [params];
    }
    const mapped = {};
    for (const [key, value] of Object.entries(params)) {
        const cleanKey = key.replace(/^[@:$]/, "");
        mapped[key] = value;
        mapped[`@${cleanKey}`] = value;
        mapped[`:${cleanKey}`] = value;
        mapped[`$${cleanKey}`] = value;
    }
    return mapped;
}
function saveDb() {
    if (!db || !dbPath)
        return;
    const data = db.export();
    fs_1.default.writeFileSync(dbPath, Buffer.from(data));
}
async function initDb() {
    dbPath = path_1.default.join(electron_1.app.getPath("userData"), "kpi.sqlite");
    const SQL = await initSqlJs({
        locateFile: (file) => {
            return path_1.default.join(__dirname, "../node_modules/sql.js/dist", file);
        }
    });
    if (fs_1.default.existsSync(dbPath)) {
        const fileBuffer = fs_1.default.readFileSync(dbPath);
        db = new SQL.Database(fileBuffer);
    }
    else {
        db = new SQL.Database();
    }
    db.run("PRAGMA foreign_keys = ON;");
    db.run(`
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
  `);
    saveDb();
}
function selectAll(sql, params) {
    const stmt = db.prepare(sql);
    const result = [];
    try {
        stmt.bind(normalizeParams(params));
        while (stmt.step()) {
            result.push(stmt.getAsObject());
        }
        return result;
    }
    finally {
        stmt.free();
    }
}
function selectOne(sql, params) {
    const rows = selectAll(sql, params);
    return rows[0] || undefined;
}
function runWrite(sql, params) {
    db.run(sql, normalizeParams(params));
    saveDb();
    return {
        changes: db.getRowsModified()
    };
}
function getDb() {
    if (!db) {
        throw new Error("Database not initialized");
    }
    return {
        exec(sql) {
            db.run(sql);
            saveDb();
        },
        prepare(sql) {
            return {
                all(params) {
                    return selectAll(sql, params);
                },
                get(params) {
                    return selectOne(sql, params);
                },
                run(params) {
                    return runWrite(sql, params);
                }
            };
        },
        transaction(fn) {
            return function (...args) {
                try {
                    db.run("BEGIN TRANSACTION;");
                    const result = fn(...args);
                    db.run("COMMIT;");
                    saveDb();
                    return result;
                }
                catch (error) {
                    db.run("ROLLBACK;");
                    throw error;
                }
            };
        }
    };
}
