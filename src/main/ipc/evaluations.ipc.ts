import { ipcMain } from 'electron'
import {
  copyPreviousMonthEvaluations,
  listEvaluationEmployees,
  saveMonthlyEvaluations
} from '../database/repositories/evaluations.repo'
import type { MutationResult } from '../types/common'
import type {
  CopyPreviousMonthInput,
  CopyPreviousMonthResult,
  EvaluationEmployeeRow,
  EvaluationFilters,
  SaveMonthlyEvaluationsInput
} from '../types/evaluations'

export function registerEvaluationsIpc(): void {
  ipcMain.handle('evaluations:list-employees', (_event, filters: EvaluationFilters): EvaluationEmployeeRow[] => {
    return listEvaluationEmployees(filters)
  })

  ipcMain.handle(
    'evaluations:save-month',
    (_event, input: SaveMonthlyEvaluationsInput): MutationResult => {
      return saveMonthlyEvaluations(input)
    }
  )

  ipcMain.handle(
    'evaluations:copy-previous-month',
    (_event, input: CopyPreviousMonthInput): CopyPreviousMonthResult => {
      return copyPreviousMonthEvaluations(input)
    }
  )
}