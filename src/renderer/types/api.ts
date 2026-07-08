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
  employee_number: string | null
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
  employee_number: string
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

export type AppApi = {
  dbTest: () => Promise<DbTestResult>
  departments: {
    list: () => Promise<Department[]>
    create: (data: CreateDepartmentInput) => Promise<MutationResult>
  }
  employees: {
    list: () => Promise<Employee[]>
    create: (data: CreateEmployeeInput) => Promise<MutationResult>
  }
}

declare global {
  interface Window {
    api: AppApi
  }
}