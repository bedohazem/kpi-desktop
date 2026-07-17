import { getDb } from '../db'
import type { MutationResult } from '../../types/common'
import type {
  CopyPreviousMonthInput,
  CopyPreviousMonthResult,
  EvaluationEmployeeRow,
  EvaluationFilters,
  SaveMonthlyEvaluationsInput
} from '../../types/evaluations'

function validateMonthYear(month: number, year: number): void {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('الشهر غير صحيح')
  }

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error('السنة غير صحيحة')
  }
}

export function listEvaluationEmployees(filters: EvaluationFilters): EvaluationEmployeeRow[] {
  validateMonthYear(filters.month, filters.year)

  const db = getDb()

  return db
    .prepare(
      `
      SELECT
        e.id AS employee_id,
        e.name AS employee_name,
        e.qualification,
        e.job_title,
        e.department_id,
        e.sort_order,
        d.name AS department_name,
        me.id AS evaluation_id,
        me.evaluation_value,
        me.notes AS evaluation_notes
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN monthly_evaluations me
        ON me.employee_id = e.id
       AND me.month = @month
       AND me.year = @year
      WHERE e.active = 1
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
      ORDER BY
        CASE WHEN e.sort_order > 0 THEN 0 ELSE 1 END,
        e.sort_order ASC,
        e.name COLLATE NOCASE ASC,
        e.id ASC
    `
    )
    .all({
      month: filters.month,
      year: filters.year,
      department_id: filters.department_id
    }) as EvaluationEmployeeRow[]
}

export function saveMonthlyEvaluations(input: SaveMonthlyEvaluationsInput): MutationResult {
  validateMonthYear(input.month, input.year)

  if (input.items.length === 0) {
    throw new Error('لا توجد تقييمات للحفظ')
  }

  const db = getDb()

  const saveStatement = db.prepare(
    `
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
  `
  )

  const transaction = db.transaction(() => {
    for (const item of input.items) {
      const evaluationValue = Number(item.evaluation_value)

      if (!Number.isFinite(evaluationValue) || evaluationValue < 0) {
        throw new Error('قيمة التقييم غير صحيحة')
      }

      saveStatement.run({
        employee_id: item.employee_id,
        month: input.month,
        year: input.year,
        evaluation_value: evaluationValue,
        notes: item.notes.trim()
      })
    }
  })

  transaction()

  return { success: true }
}

export function copyPreviousMonthEvaluations(input: CopyPreviousMonthInput): CopyPreviousMonthResult {
  validateMonthYear(input.month, input.year)

  const previousMonth = input.month === 1 ? 12 : input.month - 1
  const previousYear = input.month === 1 ? input.year - 1 : input.year

  const db = getDb()

  const result = db
    .prepare(
      `
      INSERT INTO monthly_evaluations (
        employee_id,
        month,
        year,
        evaluation_value,
        notes
      )
      SELECT
        previous.employee_id,
        @month,
        @year,
        previous.evaluation_value,
        previous.notes
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
    `
    )
    .run({
      month: input.month,
      year: input.year,
      previousMonth,
      previousYear,
      department_id: input.department_id
    })

  return {
    success: true,
    copied: result.changes
  }
}