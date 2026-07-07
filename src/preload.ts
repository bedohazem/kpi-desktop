import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  departments: {
    list: () => ipcRenderer.invoke("departments:list"),
    create: (data: any) => ipcRenderer.invoke("departments:create", data),
    update: (data: any) => ipcRenderer.invoke("departments:update", data),
    delete: (id: number) => ipcRenderer.invoke("departments:delete", id)
  },

  employees: {
    list: (filters?: any) => ipcRenderer.invoke("employees:list", filters),
    create: (data: any) => ipcRenderer.invoke("employees:create", data),
    update: (data: any) => ipcRenderer.invoke("employees:update", data),
    delete: (id: number) => ipcRenderer.invoke("employees:delete", id)
  },

  evaluations: {
    loadMonth: (data: any) => ipcRenderer.invoke("evaluations:load-month", data),
    saveBulk: (data: any) => ipcRenderer.invoke("evaluations:save-bulk", data),
    copyMonth: (data: any) => ipcRenderer.invoke("evaluations:copy-month", data)
  },

  reports: {
    employeePeriod: (data: any) => ipcRenderer.invoke("reports:employee-period", data)
  }
});