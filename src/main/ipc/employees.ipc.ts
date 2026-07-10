import { ipcMain } from 'electron'
import {
  createEmployee,
  deleteEmployee,
  listEmployees,
  setEmployeeActive,
  updateEmployee
} from '../database/repositories/employees.repo'
import type { MutationResult } from '../types/common'
import type {
  CreateEmployeeInput,
  DeleteEmployeeInput,
  EmployeeRow,
  ListEmployeesInput,
  SetEmployeeActiveInput,
  UpdateEmployeeInput
} from '../types/employees'

export function registerEmployeesIpc(): void {

  ipcMain.handle('employees:list', (_event, input?: ListEmployeesInput): EmployeeRow[] => {
    return listEmployees(input)
  })

  ipcMain.handle('employees:create', (_event, input: CreateEmployeeInput): MutationResult => {
    return createEmployee(input)
  })

  ipcMain.handle('employees:update', (_event, input: UpdateEmployeeInput): MutationResult => {
    return updateEmployee(input)
  })

  ipcMain.handle('employees:set-active', (_event, input: SetEmployeeActiveInput): MutationResult => {
    return setEmployeeActive(input)
  })

  ipcMain.handle('employees:delete', (_event, input: DeleteEmployeeInput): MutationResult => {
    return deleteEmployee(input)
  })





  
}