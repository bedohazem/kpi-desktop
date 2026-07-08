export type ReportFilters = {
  year: number
  from_month: number
  to_month: number
  department_id: number | null
  employee_id: number | null
}

export type EmployeeReportRow = {
  employee_id: number
  employee_number: string | null
  employee_name: string
  job_title: string | null
  department_id: number | null
  department_name: string | null
  month_values: Record<string, number | null>
  total: number
  average: number
  notes: string
}

export type DepartmentSummaryRow = {
  department_id: number | null
  department_name: string
  employees_count: number
  evaluations_count: number
  total: number
  average: number
}

export type ReportsResult = {
  months: number[]
  employees: EmployeeReportRow[]
  departmentSummary: DepartmentSummaryRow[]
}