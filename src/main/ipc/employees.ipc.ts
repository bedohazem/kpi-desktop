import { ipcMain } from 'electron'
import { createEmployee, listEmployees } from '../database/repositories/employees.repo'
import type { MutationResult } from '../types/common'
import type { CreateEmployeeInput, EmployeeRow } from '../types/employees'

export function registerEmployeesIpc(): void {
  ipcMain.handle('employees:list', (): EmployeeRow[] => {
    return listEmployees()
  })

  ipcMain.handle('employees:create', (_event, input: CreateEmployeeInput): MutationResult => {
    return createEmployee(input)
  })
}