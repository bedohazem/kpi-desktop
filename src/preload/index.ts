import { contextBridge, ipcRenderer } from 'electron'

const api = {
  dbTest: (): Promise<{
    ok: boolean
    dbPath: string
    departmentsCount: number
  }> => ipcRenderer.invoke('db:test')
}

contextBridge.exposeInMainWorld('api', api)
