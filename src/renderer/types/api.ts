export type DbTestResult = {
  ok: boolean
  dbPath: string
  departmentsCount: number
}

export type DashboardStats = {
  currentMonth: number
  currentYear: number
  activeDepartmentsCount: number
  inactiveDepartmentsCount: number
  activeEmployeesCount: number
  inactiveEmployeesCount: number
  currentMonthEvaluationsCount: number
  currentMonthMissingEvaluationsCount: number
  currentMonthTotal: number
  currentMonthAverage: number
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
  sort_order: number
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

export type UpdateDepartmentInput = CreateDepartmentInput & {
  id: number
}

export type SetDepartmentActiveInput = {
  id: number
  active: boolean
}

export type ListDepartmentsInput = {
  includeInactive?: boolean
}

export type DeleteDepartmentInput = {
  id: number
}

export type CreateEmployeeInput = {
  name: string
  national_id: string
  qualification: string
  job_title: string
  department_id: number | null
  sort_order: number
  notes: string
  active: boolean
}

export type MutationResult = {
  success: boolean
}

export type EvaluationEmployee = {
  employee_id: number
  employee_name: string
  qualification: string | null
  job_title: string | null
  department_id: number | null
  sort_order: number
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
  qualification: string | null
  job_title: string | null
  department_id: number | null
  sort_order: number
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

export type ListEmployeesInput = {
  includeInactive?: boolean
}

export type DeleteEmployeeInput = {
  id: number
}

export type BackupStatus = {
  directory: string
  enabled: boolean
  lastBackupAt: string | null
  lastBackupPath: string | null
  lastError: string | null
  configured: boolean
}

export type ChooseBackupDirectoryResult = {
  canceled: boolean
  status: BackupStatus
}

export type OpenBackupDirectoryResult = {
  success: boolean
}

export type PrepareRestoreResult = {
  success: boolean
  fileName: string
}

export type ChooseRestoreFileResult = {
  canceled: boolean
  result: PrepareRestoreResult | null
}

export type RestartAfterRestoreResult = {
  success: boolean
}

export type AppApi = {
  dbTest: () => Promise<DbTestResult>
  dashboard: {
    stats: () => Promise<DashboardStats>
  }
  departments: {
    list: (input?: ListDepartmentsInput) => Promise<Department[]>
    create: (data: CreateDepartmentInput) => Promise<MutationResult>
    update: (data: UpdateDepartmentInput) => Promise<MutationResult>
    setActive: (data: SetDepartmentActiveInput) => Promise<MutationResult>
    delete: (data: DeleteDepartmentInput) => Promise<MutationResult>
  }
  employees: {
    list: (input?: ListEmployeesInput) => Promise<Employee[]>
    create: (data: CreateEmployeeInput) => Promise<MutationResult>
    update: (data: UpdateEmployeeInput) => Promise<MutationResult>
    setActive: (data: SetEmployeeActiveInput) => Promise<MutationResult>
    delete: (data: DeleteEmployeeInput) => Promise<MutationResult>
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
  backup: {
    getStatus: () => Promise<BackupStatus>

    chooseDirectory: () =>
      Promise<ChooseBackupDirectoryResult>

    createNow: () => Promise<BackupStatus>

    setEnabled: (
      enabled: boolean
    ) => Promise<BackupStatus>

    openDirectory: () =>
      Promise<OpenBackupDirectoryResult>

    chooseRestoreFile: () =>
      Promise<ChooseRestoreFileResult>

    restartAfterRestore: () =>
      Promise<RestartAfterRestoreResult>
  }
}

declare global {
  interface Window {
    api: AppApi
  }
}