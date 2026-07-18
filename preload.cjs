const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  dbTest: () => ipcRenderer.invoke('db:test'),
  
  dashboard: {
    stats: () => ipcRenderer.invoke('dashboard:stats')
  },

  departments: {
    list: (input) => ipcRenderer.invoke('departments:list', input),
    create: (data) => ipcRenderer.invoke('departments:create', data),
    update: (data) => ipcRenderer.invoke('departments:update', data),
    setActive: (data) => ipcRenderer.invoke('departments:set-active', data),
    delete: (data) => ipcRenderer.invoke('departments:delete', data)
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
  },

  backup: {
    getStatus: () =>
      ipcRenderer.invoke('backup:get-status'),

    chooseDirectory: () =>
      ipcRenderer.invoke('backup:choose-directory'),

    createNow: () =>
      ipcRenderer.invoke('backup:create-now'),

    setEnabled: (enabled) =>
      ipcRenderer.invoke(
        'backup:set-enabled',
        enabled
      ),

    openDirectory: () =>
      ipcRenderer.invoke('backup:open-directory'),
  
    chooseRestoreFile: () =>
      ipcRenderer.invoke(
        'backup:choose-restore-file'
      ),

    restartAfterRestore: () =>
      ipcRenderer.invoke(
        'backup:restart-after-restore'
      )

  }

})