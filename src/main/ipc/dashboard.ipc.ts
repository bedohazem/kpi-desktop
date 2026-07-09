import { ipcMain } from 'electron'
import { getDashboardStats } from '../database/repositories/dashboard.repo'
import type { DashboardStats } from '../types/dashboard'

export function registerDashboardIpc(): void {
  ipcMain.handle('dashboard:stats', (): DashboardStats => {
    return getDashboardStats()
  })
}