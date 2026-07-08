import { ipcMain } from 'electron'
import { generateReports } from '../database/repositories/reports.repo'
import type { ReportFilters, ReportsResult } from '../types/reports'

export function registerReportsIpc(): void {
  ipcMain.handle('reports:generate', (_event, filters: ReportFilters): ReportsResult => {
    return generateReports(filters)
  })
}