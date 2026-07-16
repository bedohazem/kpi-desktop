import { getDb } from '../db'
import type {
  DepartmentSummaryRow,
  EmployeeReportRow,
  ReportFilters,
  ReportsResult
} from '../../types/reports'

type EmployeeBaseRow = {
  employee_id: number
  employee_name: string
  qualification: string | null
  job_title: string | null
  department_id: number | null
  department_name: string | null
}

type EvaluationValueRow = {
  employee_id: number
  month: number
  evaluation_value: number
  notes: string | null
}

type DepartmentAggregateRow = {
  department_id: number | null
  department_name: string | null
  employees_count: number
  evaluations_count: number
  total: number | null
  average: number | null
}

function validateReportFilters(filters: ReportFilters): void {
  if (!Number.isInteger(filters.year) || filters.year < 2000 || filters.year > 2100) {
    throw new Error('السنة غير صحيحة')
  }

  if (!Number.isInteger(filters.from_month) || filters.from_month < 1 || filters.from_month > 12) {
    throw new Error('شهر البداية غير صحيح')
  }

  if (!Number.isInteger(filters.to_month) || filters.to_month < 1 || filters.to_month > 12) {
    throw new Error('شهر النهاية غير صحيح')
  }

  if (filters.from_month > filters.to_month) {
    throw new Error('شهر البداية لازم يكون قبل شهر النهاية')
  }
}

export function generateReports(filters: ReportFilters): ReportsResult {
  validateReportFilters(filters)

  const db = getDb()
  const months = Array.from(
    { length: filters.to_month - filters.from_month + 1 },
    (_, index) => filters.from_month + index
  )

  const employees = db
    .prepare(
      `
      SELECT
        e.id AS employee_id,
        e.name AS employee_name,
        e.qualification,
        e.job_title,
        e.department_id,
        COALESCE(d.name, 'بدون إدارة') AS department_name
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
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
        AND (@employee_id IS NULL OR e.id = @employee_id)
      ORDER BY e.id ASC
    `
    )
    .all({
      department_id: filters.department_id,
      employee_id: filters.employee_id
    }) as EmployeeBaseRow[]

  const evaluations = db
    .prepare(
      `
      SELECT
        me.employee_id,
        me.month,
        me.evaluation_value,
        me.notes
      FROM monthly_evaluations me
      INNER JOIN employees e ON e.id = me.employee_id
      WHERE me.year = @year
        AND me.month BETWEEN @from_month AND @to_month
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
        AND (@employee_id IS NULL OR e.id = @employee_id)
      ORDER BY me.employee_id, me.month
    `
    )
    .all({
      year: filters.year,
      from_month: filters.from_month,
      to_month: filters.to_month,
      department_id: filters.department_id,
      employee_id: filters.employee_id
    }) as EvaluationValueRow[]

  const valuesByEmployee = new Map<number, EvaluationValueRow[]>()

  for (const evaluation of evaluations) {
    const current = valuesByEmployee.get(evaluation.employee_id) || []
    current.push(evaluation)
    valuesByEmployee.set(evaluation.employee_id, current)
  }

  const employeeRows: EmployeeReportRow[] = employees.map((employee) => {
    const employeeEvaluations = valuesByEmployee.get(employee.employee_id) || []
    const monthValues: Record<string, number | null> = {}

    for (const month of months) {
      const found = employeeEvaluations.find((evaluation) => evaluation.month === month)
      monthValues[String(month)] = found ? Number(found.evaluation_value) : null
    }

    const numericValues = Object.values(monthValues).filter(
      (value): value is number => typeof value === 'number'
    )

    const total = numericValues.reduce((sum, value) => sum + value, 0)
    const average = numericValues.length > 0 ? total / numericValues.length : 0

    const notes = employeeEvaluations
      .map((evaluation) => evaluation.notes?.trim())
      .filter((note): note is string => Boolean(note))
      .join(' | ')

    return {
      ...employee,
      month_values: monthValues,
      total,
      average,
      notes
    }
  })

  const summaryRows = db
    .prepare(
      `
      SELECT
        e.department_id,
        COALESCE(d.name, 'بدون إدارة') AS department_name,
        COUNT(DISTINCT e.id) AS employees_count,
        COUNT(me.id) AS evaluations_count,
        IFNULL(SUM(me.evaluation_value), 0) AS total,
        IFNULL(AVG(me.evaluation_value), 0) AS average
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN monthly_evaluations me
        ON me.employee_id = e.id
       AND me.year = @year
       AND me.month BETWEEN @from_month AND @to_month
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
        AND (@employee_id IS NULL OR e.id = @employee_id)
      GROUP BY e.department_id, d.name
      ORDER BY d.name
    `
    )
    .all({
      year: filters.year,
      from_month: filters.from_month,
      to_month: filters.to_month,
      department_id: filters.department_id,
      employee_id: filters.employee_id
    }) as DepartmentAggregateRow[]

  const departmentSummary: DepartmentSummaryRow[] = summaryRows.map((row) => ({
    department_id: row.department_id,
    department_name: row.department_name || 'بدون إدارة',
    employees_count: Number(row.employees_count || 0),
    evaluations_count: Number(row.evaluations_count || 0),
    total: Number(row.total || 0),
    average: Number(row.average || 0)
  }))

  return {
    months,
    employees: employeeRows,
    departmentSummary
  }
}