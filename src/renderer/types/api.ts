export type DbTestResult = {
  ok: boolean
  dbPath: string
  departmentsCount: number
}

export type Department = {
  id: number
  name: string
  parent_id: number | null
  parent_name: string | null
  notes: string | null
  active: number
  created_at: string
  updated_at: string
}

export type Employee = {
  id: number
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

export type CreateDepartmentInput = {
  name: string
  parent_id: number | null
  notes: string
  active: boolean
}

export type CreateEmployeeInput = {
  name: string
  national_id: string
  qualification: string
  job_title: string
  department_id: number | null
  notes: string
  active: boolean
}

export type MutationResult = {
  success: boolean
}

export type EvaluationEmployee = {
  employee_id: number
  employee_name: string
  job_title: string | null
  department_id: number | null
  department_name: string | null
  evaluation_id: number | null
  evaluation_value: number | null
  evaluation_notes: string | null
}

export type EvaluationFilters = {
  month: number
  year: number
  department_id: number | null
}

export type SaveEvaluationItem = {
  employee_id: number
  evaluation_value: number
  notes: string
}

export type SaveMonthlyEvaluationsInput = {
  month: number
  year: number
  items: SaveEvaluationItem[]
}

export type CopyPreviousMonthInput = {
  month: number
  year: number
  department_id: number | null
}

export type CopyPreviousMonthResult = {
  success: boolean
  copied: number
}

export type ReportFilters = {
  year: number
  from_month: number
  to_month: number
  department_id: number | null
  employee_id: number | null
}

export type EmployeeReportRow = {
  employee_id: number
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

export type SaveReportPdfInput = {
  html: string
  fileName: string
}

export type SaveReportPdfResult = {
  success: boolean
  canceled?: boolean
  filePath?: string
}

export type UpdateEmployeeInput = CreateEmployeeInput & {
  id: number
}

export type SetEmployeeActiveInput = {
  id: number
  active: boolean
}

export type AppApi = {
  dbTest: () => Promise<DbTestResult>
  departments: {
    list: () => Promise<Department[]>
    create: (data: CreateDepartmentInput) => Promise<MutationResult>
  }
  employees: {
    list: () => Promise<Employee[]>
    create: (data: CreateEmployeeInput) => Promise<MutationResult>
    update: (data: UpdateEmployeeInput) => Promise<MutationResult>
    setActive: (data: SetEmployeeActiveInput) => Promise<MutationResult>
  }
  evaluations: {
    listEmployees: (filters: EvaluationFilters) => Promise<EvaluationEmployee[]>
    saveMonth: (input: SaveMonthlyEvaluationsInput) => Promise<MutationResult>
    copyPreviousMonth: (input: CopyPreviousMonthInput) => Promise<CopyPreviousMonthResult>
  }
  reports: {
    generate: (filters: ReportFilters) => Promise<ReportsResult>
    savePdf: (input: SaveReportPdfInput) => Promise<SaveReportPdfResult>
  }
}

declare global {
  interface Window {
    api: AppApi
  }
}