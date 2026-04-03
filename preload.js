const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    windowControl: (action) => ipcRenderer.send('window-control', action),
    connectVpn: (profile) => ipcRenderer.invoke('vpn-connect', profile),
    disconnectVpn: () => ipcRenderer.invoke('vpn-disconnect'),
    getStatus: () => ipcRenderer.invoke('vpn-status'),
    onStatsUpdate: (callback) => ipcRenderer.on('vpn-stats-update', (event, data) => callback(data)),
    onStatusChange: (callback) => ipcRenderer.on('vpn-status-change', (event, data) => callback(data)),
    onMfaRequired: (callback) => ipcRenderer.on('vpn-mfa-required', (event, data) => callback(data)),
    submitMfa: (otp) => ipcRenderer.invoke('vpn-submit-mfa', otp),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    storeToken: (token) => ipcRenderer.invoke('store-token', token),
    getToken: () => ipcRenderer.invoke('get-token'),
});
