import { BrowserWindow, dialog, ipcMain } from 'electron'
import { writeFile } from 'node:fs/promises'
import { generateReports } from '../database/repositories/reports.repo'
import type { ReportFilters, ReportsResult } from '../types/reports'

type SaveReportPdfInput = {
  html: string
  fileName: string
}

type SaveReportPdfResult = {
  success: boolean
  canceled?: boolean
  filePath?: string
}

export function registerReportsIpc(): void {
  ipcMain.handle('reports:generate', (_event, filters: ReportFilters): ReportsResult => {
    return generateReports(filters)
  })

  ipcMain.handle(
    'reports:save-pdf',
    async (_event, input: SaveReportPdfInput): Promise<SaveReportPdfResult> => {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'حفظ تقرير PDF',
        defaultPath: input.fileName.endsWith('.pdf') ? input.fileName : `${input.fileName}.pdf`,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      })

      if (canceled || !filePath) {
        return { success: false, canceled: true }
      }

      const printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          offscreen: true
        }
      })

      try {
        await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(input.html)}`)

        const pdfBuffer = await printWindow.webContents.printToPDF({
          landscape: true,
          printBackground: true,
          preferCSSPageSize: true,
          margins: {
            marginType: 'custom',
            top: 0.25,
            bottom: 0.25,
            left: 0.25,
            right: 0.25
          }
        })

        await writeFile(filePath, pdfBuffer)

        return {
          success: true,
          filePath
        }
      } finally {
        printWindow.close()
      }
    }
  )
}