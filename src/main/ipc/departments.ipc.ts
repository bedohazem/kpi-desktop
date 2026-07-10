import { ipcMain } from 'electron'
import {
  createDepartment,
  deleteDepartment,
  listDepartments,
  setDepartmentActive,
  updateDepartment
} from '../database/repositories/departments.repo'
import type { MutationResult } from '../types/common'
import type { 
  CreateDepartmentInput, 
  DeleteDepartmentInput, 
  DepartmentRow, 
  ListDepartmentsInput, 
  SetDepartmentActiveInput, 
  UpdateDepartmentInput 
} from '../types/departments'

export function registerDepartmentsIpc(): void {

  ipcMain.handle('departments:list', (_event, input?: ListDepartmentsInput): DepartmentRow[] => {
    return listDepartments(input)
  })

  ipcMain.handle('departments:create', (_event, input: CreateDepartmentInput): MutationResult => {
    return createDepartment(input)
  })

  ipcMain.handle('departments:update', (_event, input: UpdateDepartmentInput): MutationResult => {
    return updateDepartment(input)
  })

  ipcMain.handle('departments:set-active', (_event, input: SetDepartmentActiveInput): MutationResult => {
    return setDepartmentActive(input)
  })

  ipcMain.handle('departments:delete', (_event, input: DeleteDepartmentInput): MutationResult => {
    return deleteDepartment(input)
  })
}