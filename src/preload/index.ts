import { contextBridge, ipcRenderer } from 'electron'

type DbTestResult = {
  ok: boolean
  dbPath: string
  departmentsCount: number
}

type Department = {
  id: number
  name: string
  parent_id: number | null
  parent_name: string | null
  notes: string | null
  active: number
  created_at: string
  updated_at: string
}

type Employee = {
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

type CreateDepartmentInput = {
  name: string
  parent_id: number | null
  notes: string
  active: boolean
}

type CreateEmployeeInput = {
  employee_number: string
  name: string
  national_id: string
  qualification: string
  job_title: string
  department_id: number | null
  notes: string
  active: boolean
}

type MutationResult = {
  success: boolean
}

const api = {
  dbTest: (): Promise<DbTestResult> => ipcRenderer.invoke('db:test'),

  departments: {
    list: (): Promise<Department[]> => ipcRenderer.invoke('departments:list'),

    create: (data: CreateDepartmentInput): Promise<MutationResult> =>
      ipcRenderer.invoke('departments:create', data)
  },

  employees: {
    list: (): Promise<Employee[]> => ipcRenderer.invoke('employees:list'),

    create: (data: CreateEmployeeInput): Promise<MutationResult> =>
      ipcRenderer.invoke('employees:create', data)
  }
}

contextBridge.exposeInMainWorld('api', api)
