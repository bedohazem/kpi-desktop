import { getDb, getDbPath } from '../db';
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { MutationResult } from '../../types/common';
import type {
  CopyPreviousMonthInput,
  CopyPreviousMonthResult,
  EvaluationEmployeeRow,
  EvaluationFilters,
  SaveMonthlyEvaluationsInput,
  ResetMonthInput,
  ResetMonthResult,
} from '../../types/evaluations';

function validateMonthYear(month: number, year: number): void {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('الشهر غير صحيح');
  }

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error('السنة غير صحيحة');
  }
}

export function listEvaluationEmployees(
  filters: EvaluationFilters,
): EvaluationEmployeeRow[] {
  validateMonthYear(filters.month, filters.year);

  const db = getDb();

  return db
    .prepare(
      `
      SELECT
        e.id AS employee_id,
        e.active,
        e.name AS employee_name,
        e.qualification,
        CASE
          WHEN me.id IS NOT NULL
          THEN me.job_title_at_evaluation
          ELSE e.job_title
        END AS job_title,
        CASE
          WHEN me.id IS NOT NULL
          THEN me.department_id_at_evaluation
          ELSE e.department_id
        END AS department_id,
        e.sort_order,
        d.name AS department_name,
        me.id AS evaluation_id,
        me.evaluation_value,
        e.notes AS evaluation_notes

      FROM employees e

      LEFT JOIN monthly_evaluations me
        ON me.employee_id = e.id
       AND me.month = @month
       AND me.year = @year

      LEFT JOIN departments d
        ON d.id = CASE
          WHEN me.id IS NOT NULL
          THEN me.department_id_at_evaluation
          ELSE e.department_id
        END

      WHERE (e.active = 1 OR me.id IS NOT NULL)

        AND (
          @department_id IS NULL
          OR (
            CASE
              WHEN me.id IS NOT NULL
              THEN me.department_id_at_evaluation
              ELSE e.department_id
            END
          ) IN (
            WITH RECURSIVE selected_departments(id) AS (
              SELECT id
              FROM departments
              WHERE id = @department_id

              UNION

              SELECT d.id
              FROM departments d
              INNER JOIN selected_departments selected
                ON selected.id = d.parent_id
            )
            SELECT id FROM selected_departments
          )
        )

      ORDER BY
        CASE WHEN e.sort_order > 0 THEN 0 ELSE 1 END,
        e.sort_order ASC,
        e.name COLLATE NOCASE ASC,
        e.id ASC
      `,
    )
    .all({
      month: filters.month,
      year: filters.year,
      department_id: filters.department_id,
    }) as EvaluationEmployeeRow[];
}

export function saveMonthlyEvaluations(
  input: SaveMonthlyEvaluationsInput,
): MutationResult {
  validateMonthYear(input.month, input.year);

  if (input.items.length === 0) {
    throw new Error('لا توجد تقييمات للحفظ');
  }

  const db = getDb();

  const activeEmployeeStatement = db.prepare(
    'SELECT active FROM employees WHERE id = ?',
  );

  const saveStatement = db.prepare(`
    INSERT INTO monthly_evaluations (
      employee_id,
      month,
      year,
      evaluation_value,
      notes,
      department_id_at_evaluation,
      job_title_at_evaluation
    )
    VALUES (
      @employee_id,
      @month,
      @year,
      @evaluation_value,
      @notes,
      (
        SELECT department_id
        FROM employees
        WHERE id = @employee_id
      ),
      (
        SELECT job_title
        FROM employees
        WHERE id = @employee_id
      )
    )
    ON CONFLICT(employee_id, month, year)
    DO UPDATE SET
      evaluation_value = excluded.evaluation_value,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP
  `);

  const deleteStatement = db.prepare(`
    DELETE FROM monthly_evaluations
    WHERE employee_id = @employee_id
      AND month = @month
      AND year = @year
  `);

  const transaction = db.transaction(() => {
    for (const item of input.items) {
      const employee = activeEmployeeStatement.get(item.employee_id) as
        { active: number } | undefined;

      if (!employee || employee.active !== 1) {
        throw new Error('لا يمكن حفظ تقييم موظف معطّل');
      }

      if (item.evaluation_value === null) {
        deleteStatement.run({
          employee_id: item.employee_id,
          month: input.month,
          year: input.year,
        });

        continue;
      }

      const evaluationValue = Number(item.evaluation_value);

      if (!Number.isFinite(evaluationValue) || evaluationValue < 0) {
        throw new Error('قيمة التقييم غير صحيحة');
      }

      saveStatement.run({
        employee_id: item.employee_id,
        month: input.month,
        year: input.year,
        evaluation_value: evaluationValue,
        notes: item.notes.trim(),
      });
    }
  });

  transaction();

  return { success: true };
}

export function copyPreviousMonthEvaluations(
  input: CopyPreviousMonthInput,
): CopyPreviousMonthResult {
  validateMonthYear(input.month, input.year);

  const previousMonth = input.month === 1 ? 12 : input.month - 1;
  const previousYear = input.month === 1 ? input.year - 1 : input.year;

  const db = getDb();

  const result = db
    .prepare(
      `
      INSERT INTO monthly_evaluations (
        employee_id,
        month,
        year,
        evaluation_value,
        notes,
        department_id_at_evaluation,
        job_title_at_evaluation
      )
      SELECT
        previous.employee_id,
        @month,
        @year,
        previous.evaluation_value,
        previous.notes,
        e.department_id,
        e.job_title
      FROM monthly_evaluations previous
      INNER JOIN employees e ON e.id = previous.employee_id
      WHERE previous.month = @previousMonth
        AND previous.year = @previousYear
        AND e.active = 1
        AND (
          @department_id IS NULL
          OR e.department_id IN (
            WITH RECURSIVE selected_departments(id) AS (
              SELECT id
              FROM departments
              WHERE id = @department_id

              UNION

              SELECT d.id
              FROM departments d
              INNER JOIN selected_departments selected ON selected.id = d.parent_id
            )
            SELECT id FROM selected_departments
          )
        )
      ON CONFLICT(employee_id, month, year) DO NOTHING
    `,
    )
    .run({
      month: input.month,
      year: input.year,
      previousMonth,
      previousYear,
      department_id: input.department_id,
    });

  return {
    success: true,
    copied: result.changes,
  };
}

export async function resetMonthlyEvaluations(
  input: ResetMonthInput,
): Promise<ResetMonthResult> {
  validateMonthYear(input.month, input.year);

  const db = getDb();
  const departmentId = input.department_id;

  // التأكد من صحة الإدارة المختارة
  if (departmentId !== null) {
    if (!Number.isInteger(departmentId) || departmentId <= 0) {
      throw new Error('الإدارة المختارة غير صحيحة');
    }

    const department = db
      .prepare('SELECT id FROM departments WHERE id = ?')
      .get(departmentId);

    if (!department) {
      throw new Error('الإدارة المختارة غير موجودة');
    }
  }

  const params = {
    month: input.month,
    year: input.year,
    department_id: departmentId,
  };

  // نفس الشرط يُستخدم للعد والحذف
  const scopeWhere = `
    WHERE month = @month
      AND year = @year
      AND (
        @department_id IS NULL
        OR department_id_at_evaluation IN (
          WITH RECURSIVE selected_departments(id) AS (
            SELECT id
            FROM departments
            WHERE id = @department_id

            UNION

            SELECT d.id
            FROM departments d
            INNER JOIN selected_departments sd
              ON sd.id = d.parent_id
          )
          SELECT id FROM selected_departments
        )
      )
  `;

  const existing = db
    .prepare(
      `
      SELECT COUNT(*) AS count
      FROM monthly_evaluations
      ${scopeWhere}
    `,
    )
    .get(params) as { count: number };

  if (existing.count === 0) {
    return {
      deleted: 0,
      backupPath: null,
    };
  }

  // نسخة أمان من قاعدة البيانات كاملة قبل الحذف
  const backupDirectory = path.join(path.dirname(getDbPath()), 'reset-backups');

  fs.mkdirSync(backupDirectory, { recursive: true });

  const backupPath = path.join(
    backupDirectory,
    `KPI_Before_Reset_${input.year}_${String(input.month).padStart(2, '0')}_${departmentId ?? 'ALL'}_${Date.now()}.sqlite`,
  );

  await db.backup(backupPath);

  // حذف التقييمات داخل النطاق المختار فقط
  const result = db
    .prepare(
      `
      DELETE FROM monthly_evaluations
      ${scopeWhere}
    `,
    )
    .run(params);

  return {
    deleted: result.changes,
    backupPath,
  };
}
