const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const { spawn, execSync } = require('child_process');
const sudo = require('sudo-prompt');
const isDev = process.env.NODE_ENV === 'development';

// Persistent Settings Path
const SETTINGS_PATH = path.join(app.getPath('userData'), 'secura-settings.json');
const DEFAULT_SETTINGS = {
    protocol: 'UDP',
    securityLevel: 'Preferred',
    enforceTLS13: true,
    seamlessTunnel: false,
    blockIPv6: true,
    dnsFallback: true,
    launchAtStartup: false,
    restoreConnection: true
};

function loadSettings() {
    try {
        if (fs.existsSync(SETTINGS_PATH)) {
            return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
        }
    } catch (e) { console.error('Settings load failed', e); }
    return DEFAULT_SETTINGS;
}

function saveSettings(settings) {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 4));
}

// Force software rendering for maximum compatibility on older Linux systems
app.disableHardwareAcceleration();

let vpnProcess = null;
let currentProfilePath = null;
let statsInterval = null;
let tray = null;
let mainWindow = null;
let statsSocket = null;
let isSuspended = false; // To track if the window is hidden for resource saving

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 420,
        height: 680,
        minWidth: 400,
        minHeight: 600,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        show: false, // Standard: don't show until ready
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Resource Optimization: Stop stats when hidden to save CPU/RAM
    mainWindow.on('hide', () => {
        isSuspended = true;
        stopPersistentStats();
    });

    mainWindow.on('show', () => {
        isSuspended = false;
        if (vpnProcess) startPersistentStats(mainWindow.webContents);
    });
}

function showNotification(title, body) {
    if (Notification.isSupported()) {
        new Notification({ title, body, icon: path.join(__dirname, 'build/icon.png') }).show();
    }
}

// Security: Industry-Standard Safe Storage Bridge
ipcMain.handle('store-token', async (event, token) => {
    if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(token);
        fs.writeFileSync(path.join(app.getPath('userData'), 'vault.bin'), encrypted);
        return true;
    }
    return false;
});

ipcMain.handle('get-token', async () => {
    const vaultPath = path.join(app.getPath('userData'), 'vault.bin');
    if (fs.existsSync(vaultPath) && safeStorage.isEncryptionAvailable()) {
        const encrypted = fs.readFileSync(vaultPath);
        return safeStorage.decryptString(encrypted);
    }
    return null;
});

app.whenReady().then(() => {
    createWindow();
    createTray();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('window-control', (event, action) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return;
    if (action === 'minimize') win.hide(); // Low RAM: Hide when not in use
    if (action === 'close') win.close();
});

// VPN Native Orchestration
ipcMain.handle('vpn-connect', async (event, profileContent) => {
    if (vpnProcess) return { success: false, error: 'Link already active.' };

    try {
        currentProfilePath = path.join(os.tmpdir(), `nexus-${Date.now()}.ovpn`);
        fs.writeFileSync(currentProfilePath, profileContent);

        const settings = loadSettings();
        let openvpnPath = 'openvpn';
        if (process.platform === 'win32') openvpnPath = '"C:\\Program Files\\OpenVPN\\bin\\openvpn.exe"';

        const options = { name: 'Secura Future VPN' };
        let command = `${openvpnPath} --config "${currentProfilePath}" --management 127.0.0.1 7505`;

        // Apply Protocol settings
        if (settings.protocol === 'TCP') command += ' --proto tcp-client';
        else if (settings.protocol === 'UDP') command += ' --proto udp';

        // Apply Security Hardening
        if (settings.enforceTLS13) command += ' --tls-version-min 1.3';
        if (settings.blockIPv6) command += ' --block-ipv6';

        return new Promise((resolve) => {
            sudo.exec(command, options, (error) => {
                if (error) {
                    cleanupVpn();
                    resolve({ success: false, error: 'Authorization Denied or System Error.' });
                }
            });

            // Wait for Management Port to become active
            let retryCount = 0;
            const checkConnection = setInterval(() => {
                const client = new net.Socket();
                client.connect(7505, '127.0.0.1', () => {
                    client.write('state\n');
                });

                client.on('data', (data) => {
                    const status = data.toString();

                    // Handle MFA / Password Challenges
                    if (status.includes('>PASSWORD:Need')) {
                        event.sender.send('vpn-mfa-required', { type: 'otp' });
                    }

                    if (status.includes('CONNECTED,SUCCESS')) {
                        clearInterval(checkConnection);
                        vpnProcess = true;
                        if (!isSuspended) startPersistentStats(event.sender);
                        showNotification('Secura Secured', 'Encrypted tunnel successfully established.');
                        resolve({ success: true });
                        client.end();
                    }
                });

                client.on('error', () => {
                    retryCount++;
                    if (retryCount > 15) {
                        clearInterval(checkConnection);
                        cleanupVpn();
                        resolve({ success: false, error: 'Handshake Timeout: Secure tunnel not responding.' });
                    }
                });
            }, 1000);
        });

    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('vpn-disconnect', async () => {
    cleanupVpn();
    showNotification('Secura Offline', 'Encrypted tunnel has been terminated.');
    return { success: true };
});

function startPersistentStats(sender) {
    if (statsSocket) statsSocket.destroy();

    statsSocket = new net.Socket();
    statsSocket.connect(7505, '127.0.0.1', () => {
        // Request bytecount every 2 seconds ONLY IF window is visible
        statsInterval = setInterval(() => {
            if (statsSocket.writable && !isSuspended) statsSocket.write('bytecount 1\n');
        }, 2000);
    });

    statsSocket.on('data', (data) => {
        const raw = data.toString();
        if (raw.includes('BYTECOUNT')) {
            const parts = raw.split(',');
            if (parts.length >= 3) {
                sender.send('vpn-stats-update', {
                    down: parseInt(parts[1]),
                    up: parseInt(parts[2])
                });
            }
        }
    });

    statsSocket.on('error', () => stopPersistentStats());
}

function stopPersistentStats() {
    if (statsInterval) clearInterval(statsInterval);
    if (statsSocket) {
        statsSocket.destroy();
        statsSocket = null;
    }
}

function cleanupVpn() {
    stopPersistentStats();

    if (statsSocket) {
        try { statsSocket.write('signal SIGTERM\n'); } catch (e) { }
    }

    // Fallback for Linux: kill only the nexus openvpn process
    if (process.platform !== 'win32') {
        try { execSync('sudo pkill -f "openvpn --config .*/nexus-.*.ovpn"'); } catch (e) { }
    } else {
        try { execSync('taskkill /f /im openvpn.exe'); } catch (e) { }
    }

    if (currentProfilePath && fs.existsSync(currentProfilePath)) {
        try { fs.unlinkSync(currentProfilePath); } catch (e) { }
    }

    vpnProcess = null;
}


function createTray() {
    const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGA4z4AHMP7//x8Xv2fAAxhpAExDGRgYGBmwiTMCInm6Gh6NMKghMAAA6R8fGf7HMWUAAAAASUVORK5CYII=');
    tray = new Tray(icon);
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Restore Workspace', click: () => {
                mainWindow.show();
                mainWindow.focus();
            }
        },
        {
            label: 'Disconnect Tunnel',
            click: () => {
                cleanupVpn();
                showNotification('Nexus Offline', 'Encrypted tunnel has been terminated via tray control.');
                if (mainWindow) mainWindow.webContents.send('vpn-status-change', { connected: false });
            }
        },
        { type: 'separator' },
        {
            label: 'Terminate Session', click: () => {
                cleanupVpn();
                app.quit();
            }
        }
    ]);
    tray.setToolTip('Secura Future VPN');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => mainWindow.show());
}

ipcMain.handle('vpn-status', async () => {
    return { connected: !!vpnProcess };
});

ipcMain.handle('vpn-submit-mfa', async (event, otp) => {
    if (statsSocket && statsSocket.writable) {
        statsSocket.write(`password "MFA Challenge" ${otp}\n`);
        return true;
    }
    return false;
});

ipcMain.handle('get-settings', async () => loadSettings());
ipcMain.handle('save-settings', async (event, settings) => {
    saveSettings(settings);
    return true;
});
