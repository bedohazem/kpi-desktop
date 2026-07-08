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
  },

  evaluations: {
    listEmployees: (filters) => ipcRenderer.invoke('evaluations:list-employees', filters),
    saveMonth: (input) => ipcRenderer.invoke('evaluations:save-month', input),
    copyPreviousMonth: (input) => ipcRenderer.invoke('evaluations:copy-previous-month', input)
  }

})