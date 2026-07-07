"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("api", {
    departments: {
        list: () => electron_1.ipcRenderer.invoke("departments:list"),
        create: (data) => electron_1.ipcRenderer.invoke("departments:create", data),
        update: (data) => electron_1.ipcRenderer.invoke("departments:update", data),
        delete: (id) => electron_1.ipcRenderer.invoke("departments:delete", id)
    },
    employees: {
        list: (filters) => electron_1.ipcRenderer.invoke("employees:list", filters),
        create: (data) => electron_1.ipcRenderer.invoke("employees:create", data),
        update: (data) => electron_1.ipcRenderer.invoke("employees:update", data),
        delete: (id) => electron_1.ipcRenderer.invoke("employees:delete", id)
    },
    evaluations: {
        loadMonth: (data) => electron_1.ipcRenderer.invoke("evaluations:load-month", data),
        saveBulk: (data) => electron_1.ipcRenderer.invoke("evaluations:save-bulk", data),
        copyMonth: (data) => electron_1.ipcRenderer.invoke("evaluations:copy-month", data)
    },
    reports: {
        employeePeriod: (data) => electron_1.ipcRenderer.invoke("reports:employee-period", data)
    }
});
