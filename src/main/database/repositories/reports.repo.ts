import { getDb } from '../db';
import type {
  DepartmentSummaryRow,
  EmployeeReportRow,
  ReportFilters,
  ReportsResult,
} from '../../types/reports';

type EmployeeBaseRow = {
  employee_id: number;
  employee_name: string;
  qualification: string | null;
  job_title: string | null;
  department_id: number | null;
  sort_order: number;
  department_name: string | null;
  notes: string | null;
  active: number;
};

type EvaluationValueRow = {
  employee_id: number;
  month: number;
  evaluation_value: number;
  department_id_at_evaluation: number | null;
  department_name_at_evaluation: string | null;
  job_title_at_evaluation: string | null;
};

type DepartmentAggregateRow = {
  department_id: number | null;
  department_name: string | null;
  employees_count: number;
  evaluations_count: number;
  total: number | null;
  average: number | null;
  first_month_total: number | null;
  last_month_total: number | null;
};

function validateReportFilters(filters: ReportFilters): void {
  if (
    !Number.isInteger(filters.year) ||
    filters.year < 2000 ||
    filters.year > 2100
  ) {
    throw new Error('السنة غير صحيحة');
  }

  if (
    !Number.isInteger(filters.from_month) ||
    filters.from_month < 1 ||
    filters.from_month > 12
  ) {
    throw new Error('شهر البداية غير صحيح');
  }

  if (
    !Number.isInteger(filters.to_month) ||
    filters.to_month < 1 ||
    filters.to_month > 12
  ) {
    throw new Error('شهر النهاية غير صحيح');
  }

  if (filters.from_month > filters.to_month) {
    throw new Error('شهر البداية لازم يكون قبل شهر النهاية');
  }
}

export function generateReports(filters: ReportFilters): ReportsResult {
  validateReportFilters(filters);

  const db = getDb();

  const months = Array.from(
    { length: filters.to_month - filters.from_month + 1 },
    (_, index) => filters.from_month + index,
  );

  const params = {
    year: filters.year,
    from_month: filters.from_month,
    to_month: filters.to_month,
    department_id: filters.department_id,
    employee_id: filters.employee_id,
  };

  // جلب الموظفين النشطين وأصحاب التقييمات التاريخية
  const employees = db
    .prepare(
      `
      SELECT
        e.id AS employee_id,
        e.name AS employee_name,
        e.qualification,
        e.job_title,
        e.department_id,
        e.sort_order,
        COALESCE(d.name, 'بدون إدارة') AS department_name,
        e.notes,
        e.active
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE (
        e.active = 1
        OR EXISTS (
          SELECT 1
          FROM monthly_evaluations historical
          WHERE historical.employee_id = e.id
            AND historical.year = @year
            AND historical.month BETWEEN @from_month AND @to_month
        )
      )
      AND (@employee_id IS NULL OR e.id = @employee_id)
      ORDER BY e.id ASC
    `,
    )
    .all({
      year: filters.year,
      from_month: filters.from_month,
      to_month: filters.to_month,
      employee_id: filters.employee_id,
    }) as EmployeeBaseRow[];

  // جلب التقييمات حسب الإدارة المحفوظة وقت التقييم
  const evaluations = db
    .prepare(
      `
      SELECT
        me.employee_id,
        me.month,
        me.evaluation_value,
        me.department_id_at_evaluation,
        d.name AS department_name_at_evaluation,
        me.job_title_at_evaluation
      FROM monthly_evaluations me
      LEFT JOIN departments d
        ON d.id = me.department_id_at_evaluation
      WHERE me.year = @year
        AND me.month BETWEEN @from_month AND @to_month
        AND (
          @department_id IS NULL
          OR me.department_id_at_evaluation IN (
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
        AND (@employee_id IS NULL OR me.employee_id = @employee_id)
      ORDER BY me.employee_id, me.month
    `,
    )
    .all(params) as EvaluationValueRow[];

  const valuesByEmployee = new Map<number, EvaluationValueRow[]>();

  for (const evaluation of evaluations) {
    const current = valuesByEmployee.get(evaluation.employee_id) || [];

    current.push(evaluation);
    valuesByEmployee.set(evaluation.employee_id, current);
  }

  // تحديد الإدارة المختارة والإدارات التابعة لها
  const selectedDepartmentIds =
    filters.department_id === null
      ? null
      : new Set(
          (
            db
              .prepare(
                `
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
              `,
              )
              .all({ department_id: filters.department_id }) as Array<{
              id: number;
            }>
          ).map((row) => row.id),
        );

  // الموظف المنقول يظل ظاهرًا إذا له تقييم تاريخي في الإدارة
  const reportEmployees = employees.filter((employee) => {
    if (selectedDepartmentIds === null) {
      return true;
    }

    const activeInSelectedDepartment =
      employee.active === 1 &&
      employee.department_id !== null &&
      selectedDepartmentIds.has(employee.department_id);

    const hasHistoricalEvaluation = valuesByEmployee.has(employee.employee_id);

    return activeInSelectedDepartment || hasHistoricalEvaluation;
  });

  const employeeRows: EmployeeReportRow[] = reportEmployees.map((employee) => {
    const employeeEvaluations =
      valuesByEmployee.get(employee.employee_id) || [];

    const monthValues: Record<string, number | null> = {};
    const monthAssignments: EmployeeReportRow['month_assignments'] = {};
    for (const month of months) {
      const found = employeeEvaluations.find(
        (evaluation) => evaluation.month === month,
      );

      monthValues[String(month)] = found
        ? Number(found.evaluation_value)
        : null;

      monthAssignments[String(month)] = found
        ? {
            department_id: found.department_id_at_evaluation,
            department_name: found.department_name_at_evaluation,
            job_title: found.job_title_at_evaluation,
          }
        : null;
    }

    const numericValues = Object.values(monthValues).filter(
      (value): value is number => typeof value === 'number',
    );

    const total = numericValues.reduce((sum, value) => sum + value, 0);

    const average = numericValues.length > 0 ? total / numericValues.length : 0;

    return {
      ...employee,
      month_values: monthValues,
      month_assignments: monthAssignments,
      total,
      average,
      notes: employee.notes?.trim() || '',
    };
  });

  // ملخص الإدارات اعتمادًا على الإدارة التاريخية لكل تقييم
  const summaryRows = db
    .prepare(
      `
      WITH RECURSIVE selected_departments(id) AS (
        SELECT id
        FROM departments
        WHERE id = @department_id

        UNION

        SELECT d.id
        FROM departments d
        INNER JOIN selected_departments sd
          ON sd.id = d.parent_id
      ),
      base AS (
        SELECT
          e.id AS employee_id,
          e.department_id AS department_id,
          NULL AS evaluation_id,
          NULL AS evaluation_value,
          NULL AS evaluation_month
        FROM employees e
        WHERE e.active = 1
          AND (@employee_id IS NULL OR e.id = @employee_id)

        UNION ALL

        SELECT
          me.employee_id,
          me.department_id_at_evaluation AS department_id,
          me.id AS evaluation_id,
          me.evaluation_value,
          me.month AS evaluation_month
        FROM monthly_evaluations me
        WHERE me.year = @year
          AND me.month BETWEEN @from_month AND @to_month
          AND (
            @employee_id IS NULL
            OR me.employee_id = @employee_id
          )
      )
      SELECT
        b.department_id,
        COALESCE(d.name, 'بدون إدارة') AS department_name,
        COUNT(DISTINCT b.employee_id) AS employees_count,
        COUNT(b.evaluation_id) AS evaluations_count,
        IFNULL(SUM(b.evaluation_value), 0) AS total,
        IFNULL(AVG(b.evaluation_value), 0) AS average,
        IFNULL(
          SUM(
            CASE
              WHEN b.evaluation_month = @from_month
              THEN b.evaluation_value
              ELSE 0
            END
          ),
          0
        ) AS first_month_total,
        IFNULL(
          SUM(
            CASE
              WHEN b.evaluation_month = @to_month
              THEN b.evaluation_value
              ELSE 0
            END
          ),
          0
        ) AS last_month_total
      FROM base b
      LEFT JOIN departments d ON d.id = b.department_id
      WHERE (
        @department_id IS NULL
        OR b.department_id IN (
          SELECT id FROM selected_departments
        )
      )
      GROUP BY b.department_id, d.name
      ORDER BY d.name
    `,
    )
    .all(params) as DepartmentAggregateRow[];

  const departmentSummary: DepartmentSummaryRow[] = summaryRows.map((row) => ({
    department_id: row.department_id,
    department_name: row.department_name || 'بدون إدارة',
    employees_count: Number(row.employees_count || 0),
    evaluations_count: Number(row.evaluations_count || 0),
    total: Number(row.total || 0),
    average: Number(row.average || 0),
    first_month_total: Number(row.first_month_total || 0),
    last_month_total: Number(row.last_month_total || 0),
  }));

  return {
    months,
    employees: employeeRows,
    departmentSummary,
  };
}
