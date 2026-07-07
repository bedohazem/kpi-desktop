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

type CreateDepartmentInput = {
  name: string
  parent_id: number | null
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
  }
}

contextBridge.exposeInMainWorld('api', api)
