const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  dbTest: () => ipcRenderer.invoke('db:test'),

  departments: {
    list: () => ipcRenderer.invoke('departments:list'),
    create: (data) => ipcRenderer.invoke('departments:create', data)
  },

  employees: {
    list: (input) => ipcRenderer.invoke('employees:list', input),
    create: (data) => ipcRenderer.invoke('employees:create', data),
    update: (data) => ipcRenderer.invoke('employees:update', data),
    setActive: (data) => ipcRenderer.invoke('employees:set-active', data),
    delete: (data) => ipcRenderer.invoke('employees:delete', data)
  },

  evaluations: {
    listEmployees: (filters) => ipcRenderer.invoke('evaluations:list-employees', filters),
    saveMonth: (input) => ipcRenderer.invoke('evaluations:save-month', input),
    copyPreviousMonth: (input) => ipcRenderer.invoke('evaluations:copy-previous-month', input)
  },

  reports: {
    generate: (filters) => ipcRenderer.invoke('reports:generate', filters),
    savePdf: (input) => ipcRenderer.invoke('reports:save-pdf', input)
  }

})