import { ipcMain } from 'electron'
import { createEmployee, listEmployees, setEmployeeActive, updateEmployee } from '../database/repositories/employees.repo'
import type { MutationResult } from '../types/common'
import type {
  CreateEmployeeInput,
  EmployeeRow,
  SetEmployeeActiveInput,
  UpdateEmployeeInput
} from '../types/employees'

export function registerEmployeesIpc(): void {
  ipcMain.handle('employees:list', (): EmployeeRow[] => {
    return listEmployees()
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
}