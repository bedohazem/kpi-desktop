import { ipcMain } from 'electron'
import { createDepartment, listDepartments } from '../database/repositories/departments.repo'
import type { MutationResult } from '../types/common'
import type { CreateDepartmentInput, DepartmentRow } from '../types/departments'

export function registerDepartmentsIpc(): void {
  ipcMain.handle('departments:list', (): DepartmentRow[] => {
    return listDepartments()
  })

  ipcMain.handle('departments:create', (_event, input: CreateDepartmentInput): MutationResult => {
    return createDepartment(input)
  })
}