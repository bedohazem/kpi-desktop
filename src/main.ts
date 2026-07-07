import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { initDb, getDb } from "./db";

function createWindow() {
  const win = new BrowserWindow({
    width: 1300,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, "../index.html"));

  // مؤقتًا أثناء التطوير: يفتح Console عشان نعرف أي خطأ في الواجهة فورًا
  win.webContents.openDevTools({ mode: "detach" });
}

app.whenReady().then(async () => {
  await initDb();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

/* =========================
   الإدارات
========================= */

ipcMain.handle("departments:list", () => {
  const db = getDb();
  return db.prepare(`
    SELECT 
      d.*,
      p.name AS parent_name
    FROM departments d
    LEFT JOIN departments p ON p.id = d.parent_id
    ORDER BY d.name
  `).all();
});

ipcMain.handle("departments:create", (_event, data) => {
  const db = getDb();

  const stmt = db.prepare(`
    INSERT INTO departments (name, parent_id, notes, active)
    VALUES (@name, @parent_id, @notes, @active)
  `);

  return stmt.run({
    name: data.name,
    parent_id: data.parent_id || null,
    notes: data.notes || "",
    active: data.active ? 1 : 0
  });
});

ipcMain.handle("departments:update", (_event, data) => {
  const db = getDb();

  const stmt = db.prepare(`
    UPDATE departments
    SET name = @name,
        parent_id = @parent_id,
        notes = @notes,
        active = @active,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `);

  return stmt.run({
    id: data.id,
    name: data.name,
    parent_id: data.parent_id || null,
    notes: data.notes || "",
    active: data.active ? 1 : 0
  });
});

ipcMain.handle("departments:delete", (_event, id) => {
  const db = getDb();

  const used = db.prepare(`
    SELECT COUNT(*) AS count 
    FROM employees 
    WHERE department_id = ?
  `).get(id) as any;

  if (used.count > 0) {
    throw new Error("لا يمكن حذف الإدارة لأنها مرتبطة بموظفين");
  }

  return db.prepare(`DELETE FROM departments WHERE id = ?`).run(id);
});

/* =========================
   الموظفين
========================= */

ipcMain.handle("employees:list", (_event, filters: any = {}) => {
  const db = getDb();

  let sql = `
    SELECT 
      e.*,
      d.name AS department_name
    FROM employees e
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE 1 = 1
  `;

  const params: any = {};

  if (filters.search) {
    sql += `
      AND (
        e.name LIKE @search OR
        e.employee_number LIKE @search OR
        e.national_id LIKE @search
      )
    `;
    params.search = `%${filters.search}%`;
  }

  if (filters.department_id) {
    sql += ` AND e.department_id = @department_id`;
    params.department_id = filters.department_id;
  }

  sql += ` ORDER BY e.name`;

  return db.prepare(sql).all(params);
});

ipcMain.handle("employees:create", (_event, data) => {
  const db = getDb();

  const stmt = db.prepare(`
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
  `);

  return stmt.run({
    employee_number: data.employee_number || null,
    name: data.name,
    national_id: data.national_id || "",
    qualification: data.qualification || "",
    job_title: data.job_title || "",
    department_id: data.department_id || null,
    notes: data.notes || "",
    active: data.active ? 1 : 0
  });
});

ipcMain.handle("employees:update", (_event, data) => {
  const db = getDb();

  const stmt = db.prepare(`
    UPDATE employees
    SET employee_number = @employee_number,
        name = @name,
        national_id = @national_id,
        qualification = @qualification,
        job_title = @job_title,
        department_id = @department_id,
        notes = @notes,
        active = @active,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `);

  return stmt.run({
    id: data.id,
    employee_number: data.employee_number || null,
    name: data.name,
    national_id: data.national_id || "",
    qualification: data.qualification || "",
    job_title: data.job_title || "",
    department_id: data.department_id || null,
    notes: data.notes || "",
    active: data.active ? 1 : 0
  });
});

ipcMain.handle("employees:delete", (_event, id) => {
  const db = getDb();

  const used = db.prepare(`
    SELECT COUNT(*) AS count 
    FROM monthly_evaluations 
    WHERE employee_id = ?
  `).get(id) as any;

  if (used.count > 0) {
    throw new Error("لا يمكن حذف الموظف لأنه له تقييمات محفوظة");
  }

  return db.prepare(`DELETE FROM employees WHERE id = ?`).run(id);
});

/* =========================
   التقييمات الشهرية
========================= */

ipcMain.handle("evaluations:load-month", (_event, data) => {
  const db = getDb();

  return db.prepare(`
    SELECT 
      e.id AS employee_id,
      e.employee_number,
      e.name,
      e.job_title,
      d.name AS department_name,
      ev.evaluation_value,
      ev.notes AS evaluation_notes
    FROM employees e
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN monthly_evaluations ev
      ON ev.employee_id = e.id
      AND ev.month = @month
      AND ev.year = @year
    WHERE e.active = 1
      AND (@department_id IS NULL OR e.department_id = @department_id)
    ORDER BY e.name
  `).all({
    month: data.month,
    year: data.year,
    department_id: data.department_id || null
  });
});

ipcMain.handle("evaluations:save-bulk", (_event, data) => {
  const db = getDb();

  const save = db.prepare(`
    INSERT INTO monthly_evaluations (
      employee_id,
      month,
      year,
      evaluation_value,
      notes
    )
    VALUES (
      @employee_id,
      @month,
      @year,
      @evaluation_value,
      @notes
    )
    ON CONFLICT(employee_id, month, year)
    DO UPDATE SET
      evaluation_value = excluded.evaluation_value,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP
  `);

  const trx = db.transaction((rows: any[]) => {
    for (const row of rows) {
      save.run({
        employee_id: row.employee_id,
        month: data.month,
        year: data.year,
        evaluation_value: Number(row.evaluation_value || 0),
        notes: row.notes || ""
      });
    }
  });

  trx(data.rows);

  return { success: true };
});

ipcMain.handle("evaluations:copy-month", (_event, data) => {
  const db = getDb();

  const sourceRows = db.prepare(`
    SELECT employee_id, evaluation_value, notes
    FROM monthly_evaluations
    WHERE month = @from_month
      AND year = @from_year
  `).all({
    from_month: data.from_month,
    from_year: data.from_year
  });

  const save = db.prepare(`
    INSERT INTO monthly_evaluations (
      employee_id,
      month,
      year,
      evaluation_value,
      notes
    )
    VALUES (
      @employee_id,
      @to_month,
      @to_year,
      @evaluation_value,
      @notes
    )
    ON CONFLICT(employee_id, month, year)
    DO UPDATE SET
      evaluation_value = excluded.evaluation_value,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP
  `);

  const trx = db.transaction((rows: any[]) => {
    for (const row of rows) {
      save.run({
        employee_id: row.employee_id,
        to_month: data.to_month,
        to_year: data.to_year,
        evaluation_value: row.evaluation_value,
        notes: row.notes
      });
    }
  });

  trx(sourceRows);

  return { copied: sourceRows.length };
});

/* =========================
   التقارير
========================= */

ipcMain.handle("reports:employee-period", (_event, data) => {
  const db = getDb();

  const rows = db.prepare(`
    SELECT 
      e.id AS employee_id,
      e.employee_number,
      e.name,
      e.job_title,
      d.name AS department_name,
      ev.month,
      ev.year,
      ev.evaluation_value,
      ev.notes
    FROM employees e
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN monthly_evaluations ev 
      ON ev.employee_id = e.id
      AND ev.year = @year
      AND ev.month BETWEEN @from_month AND @to_month
    WHERE 1 = 1
      AND (@department_id IS NULL OR e.department_id = @department_id)
      AND (@employee_id IS NULL OR e.id = @employee_id)
    ORDER BY d.name, e.name, ev.month
  `).all({
    year: data.year,
    from_month: data.from_month,
    to_month: data.to_month,
    department_id: data.department_id || null,
    employee_id: data.employee_id || null
  });

  return rows;
});
