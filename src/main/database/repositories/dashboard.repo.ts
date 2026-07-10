import { getDb } from '../db'
import type { DashboardStats } from '../../types/dashboard'

type CountRow = {
  count: number
}

type EvaluationAggregateRow = {
  count: number
  total: number | null
  average: number | null
}

function getCount(sql: string): number {
  const db = getDb()
  const row = db.prepare(sql).get() as CountRow
  return Number(row.count || 0)
}

export function getDashboardStats(): DashboardStats {
  const db = getDb()
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const activeDepartmentsCount = getCount(`
    SELECT COUNT(*) AS count
    FROM departments
    WHERE active = 1
  `)

  const inactiveDepartmentsCount = getCount(`
    SELECT COUNT(*) AS count
    FROM departments
    WHERE active = 0
  `)

  const activeEmployeesCount = getCount(`
    SELECT COUNT(*) AS count
    FROM employees
    WHERE active = 1
  `)

  const inactiveEmployeesCount = getCount(`
    SELECT COUNT(*) AS count
    FROM employees
    WHERE active = 0
  `)

  const evaluationAggregate = db
    .prepare(
      `
      SELECT
        COUNT(me.id) AS count,
        IFNULL(SUM(me.evaluation_value), 0) AS total,
        IFNULL(AVG(me.evaluation_value), 0) AS average
      FROM monthly_evaluations me
      INNER JOIN employees e ON e.id = me.employee_id
      WHERE e.active = 1
        AND me.month = @month
        AND me.year = @year
    `
    )
    .get({
      month: currentMonth,
      year: currentYear
    }) as EvaluationAggregateRow

  const missingEvaluations = db
    .prepare(
      `
      SELECT COUNT(*) AS count
      FROM employees e
      WHERE e.active = 1
        AND NOT EXISTS (
          SELECT 1
          FROM monthly_evaluations me
          WHERE me.employee_id = e.id
            AND me.month = @month
            AND me.year = @year
        )
    `
    )
    .get({
      month: currentMonth,
      year: currentYear
    }) as CountRow

  return {
    currentMonth,
    currentYear,
    activeDepartmentsCount,
    inactiveDepartmentsCount,
    activeEmployeesCount,
    inactiveEmployeesCount,
    currentMonthEvaluationsCount: Number(evaluationAggregate.count || 0),
    currentMonthMissingEvaluationsCount: Number(missingEvaluations.count || 0),
    currentMonthTotal: Number(evaluationAggregate.total || 0),
    currentMonthAverage: Number(evaluationAggregate.average || 0)
  }
}