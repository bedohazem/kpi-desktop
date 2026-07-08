const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  dbTest: () => ipcRenderer.invoke('db:test'),

  departments: {
    list: () => ipcRenderer.invoke('departments:list'),
    create: (data) => ipcRenderer.invoke('departments:create', data)
  },

  employees: {
    list: () => ipcRenderer.invoke('employees:list'),
    create: (data) => ipcRenderer.invoke('employees:create', data)
  }
})