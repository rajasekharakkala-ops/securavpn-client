import React, { useState, useEffect } from 'react'
import Login from './components/Login'
import axios from 'axios'
import logo from './assets/logo.png'

const BACKEND_URL = 'http://localhost:8000';

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [status, setStatus] = useState('SYSTEM READY');
    const [loading, setLoading] = useState(false);
    const [ovpnProfile, setOvpnProfile] = useState(null);
    const [stats, setStats] = useState({ down: 0, up: 0, speedDown: 0, speedUp: 0 });
    const [activeTab, setActiveTab] = useState('connection'); // connection, map, profiles
    const [selectedServer, setSelectedServer] = useState({ id: 'nexus-us', name: 'NEXUS UNITED STATES', lat: 35, lon: -100, city: 'Washington' });

    const serverNodes = [
        { id: 'nexus-us', name: 'NEXUS UNITED STATES', lat: 35, lon: -100, city: 'Washington' },
        { id: 'nexus-uk', name: 'NEXUS UNITED KINGDOM', lat: 51, lon: 0, city: 'London' },
        { id: 'nexus-jp', name: 'NEXUS JAPAN', lat: 36, lon: 138, city: 'Tokyo' },
        { id: 'nexus-de', name: 'NEXUS GERMANY', lat: 51, lon: 10, city: 'Frankfurt' },
        { id: 'nexus-sg', name: 'NEXUS SINGAPORE', lat: 1, lon: 103, city: 'Singapore' },
    ];

    const mapToCoords = (lat, lon) => {
        const x = (lon + 180) * (400 / 360);
        const y = (90 - lat) * (200 / 180);
        return { x, y };
    };


    useEffect(() => {
        const initSession = async () => {
            const token = await window.electron.getToken();
            if (token) {
                setIsAuthenticated(true);
            }
        };
        initSession();
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            fetchProfile();
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (!window.electron) return;
        let lastStats = { down: 0, up: 0, time: Date.now() };

        window.electron.onStatsUpdate((data) => {
            const now = Date.now();
            const duration = (now - lastStats.time) / 1000;
            if (duration > 0) {
                const speedDown = (data.down - lastStats.down) / duration;
                const speedUp = (data.up - lastStats.up) / duration;
                setStats({
                    down: data.down,
                    up: data.up,
                    speedDown: Math.max(0, speedDown),
                    speedUp: Math.max(0, speedUp)
                });
            }
            lastStats = { down: data.down, up: data.up, time: now };
        });

        // Initial status check
        window.electron.getStatus().then(res => {
            if (res.connected) {
                setIsConnected(true);
                setStatus('SECURED');
            }
        });

        // Listen for external disconnects (e.g. from Tray)
        window.electron.onStatusChange((data) => {
            if (!data.connected) {
                setIsConnected(false);
                setStatus('SYSTEM READY');
                setStats({ down: 0, up: 0, speedDown: 0, speedUp: 0 });
            }
        });
    }, []);

    const formatSpeed = (bytes) => {
        if (!bytes || bytes < 0) return '0 B/s';
        if (bytes < 1024) return `${bytes.toFixed(1)} B/s`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB/s`;
    };

    const handleConnect = async () => {
        if (!ovpnProfile) {
            setStatus('ERROR: PROFILE MISSING');
            setTimeout(() => setStatus(isConnected ? 'SECURED' : 'SYSTEM READY'), 3000);
            return;
        }

        setLoading(true);
        if (!isConnected) {
            setStatus('ESTABLISHING TUNNEL...');
            const result = await window.electron.connectVpn(ovpnProfile);
            if (result.success) {
                setIsConnected(true);
                setStatus('SECURED');
            } else {
                setStatus('HANDSHAKE FAILED');
                setTimeout(() => setStatus('SYSTEM READY'), 3000);
            }
        } else {
            setStatus('TERMINATING...');
            const result = await window.electron.disconnectVpn();
            if (result.success) {
                setIsConnected(false);
                setStatus('SYSTEM READY');
            }
        }
        setLoading(false);
    };

    const fetchProfile = async () => {
        try {
            const token = await window.electron.getToken();
            const res = await axios.get(`${BACKEND_URL}/users/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setOvpnProfile(res.data);
            setStatus('PROFILE LOADED');
            setTimeout(() => setStatus(isConnected ? 'SECURED' : 'SYSTEM READY'), 3000);
        } catch (err) {
            console.error("Profile sync failed", err);
        }
    }

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            setOvpnProfile(event.target.result);
            setStatus('OVPN CONFIG LOADED');
            setActiveTab('connection');
            setTimeout(() => setStatus(isConnected ? 'SECURED' : 'SYSTEM READY'), 3000);
        };
        reader.readAsText(file);
    };

    const handleControl = (action) => {
        if (window.electron) window.electron.windowControl(action);
    };

    if (!isAuthenticated) {
        return (
            <div className="client-wrapper vertical-layout">
                <header className="window-header">
                    <div className="logo-section">
                        <img src={logo} style={{ width: '24px', height: '24px', marginRight: '10px' }} alt="Nexus" />
                        <span className="brand-text">SECURAVPN</span>
                    </div>
                    <div className="window-controls">
                        <button className="control-btn btn-close" onClick={() => handleControl('close')}></button>
                    </div>
                </header>
                <main className="client-container login-mode">
                    <Login
                        backendUrl={BACKEND_URL}
                        onLoginSuccess={() => setIsAuthenticated(true)}
                    />
                </main>
            </div>
        )
    }

    return (
        <div className="client-wrapper vertical-layout">
            <header className="window-header">
                <div className="logo-section">
                    <button className="menu-btn" onClick={() => setActiveTab(activeTab === 'profiles' ? 'connection' : 'profiles')}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="3" y1="12" x2="21" y2="12"></line>
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <line x1="3" y1="18" x2="21" y2="18"></line>
                        </svg>
                    </button>
                    <span className="window-title">
                        {activeTab === 'profiles' ? 'Network Profiles' : (activeTab === 'map' ? 'Global Grid' : 'Nexus Tunnel Control')}
                    </span>
                </div>
                <div className="tab-switcher">
                    <button className={`tab-link ${activeTab === 'connection' ? 'active' : ''}`} onClick={() => setActiveTab('connection')}>CONTROL</button>
                    <button className={`tab-link ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>MAP</button>
                </div>
                <div className="window-controls">
                    <button className="control-btn btn-min" onClick={() => handleControl('minimize')}></button>
                    <button className="control-btn btn-close" onClick={() => handleControl('close')}></button>
                </div>
            </header>

            <main className="client-container">
                {activeTab === 'connection' && (
                    <>
                        <div className="dashboard">
                            <div className={`status-indicator ${isConnected ? 'secure' : (loading ? 'waiting' : 'idle')}`}>
                                <div className="status-label">{status}</div>
                            </div>

                            <div className="tunnel-card">
                                <div className="tunnel-header">
                                    <div className="tunnel-icon">
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={isConnected ? "var(--success)" : "var(--primary)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                        </svg>
                                    </div>
                                    <div className="tunnel-info">
                                        <div className="name">{selectedServer.name}</div>
                                        <div className="meta">{selectedServer.city} • Safe Tunnel Active</div>
                                    </div>
                                    <div className={`connection-toggle ${isConnected ? 'active' : ''}`} onClick={handleConnect}>
                                        <div className="toggle-track">
                                            <div className="toggle-thumb">
                                                {loading && <div className="btn-spinner"></div>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {isConnected && (
                                <div className="live-metrics animate-fade-in">
                                    <div className="metric-box">
                                        <div className="label">DOWNLOAD</div>
                                        <div className="value">{formatSpeed(stats.speedDown)}</div>
                                        <div className="total-label">Total: {Math.round(stats.down / 1024 / 1024)} MB</div>
                                    </div>
                                    <div className="metric-divider"></div>
                                    <div className="metric-box">
                                        <div className="label">UPLOAD</div>
                                        <div className="value">{formatSpeed(stats.speedUp)}</div>
                                        <div className="total-label">Total: {Math.round(stats.up / 1024 / 1024)} MB</div>
                                    </div>
                                </div>
                            )}

                            {!isConnected && !loading && (
                                <div className="idle-placeholder animate-fade-in">
                                    <div className="placeholder-icon">🔓</div>
                                    <p>Connection is currently inactive. Your traffic is not encrypted.</p>
                                    <button className="goto-map-btn" onClick={() => setActiveTab('map')}>OPEN GLOBAL GRID</button>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {activeTab === 'map' && (
                    <div className="map-view animate-fade-in">
                        <div className="map-wrapper">
                            <svg viewBox="0 0 400 200" className="nexus-map">
                                {/* World Dots Approximation */}
                                <g opacity="0.1">
                                    {Array.from({ length: 40 }).map((_, i) =>
                                        Array.from({ length: 20 }).map((_, j) => (
                                            <circle key={`${i}-${j}`} cx={i * 10} cy={j * 10} r="1" fill="#fff" />
                                        ))
                                    )}
                                </g>
                                {/* Server Nodes */}
                                {serverNodes.map(node => {
                                    const { x, y } = mapToCoords(node.lat, node.lon);
                                    const isActive = selectedServer.id === node.id;
                                    return (
                                        <g key={node.id} className={`map-node ${isActive ? 'active' : ''}`} onClick={() => setSelectedServer(node)}>
                                            <circle cx={x} cy={y} r={isActive ? 6 : 4} className="node-glow" />
                                            <circle cx={x} cy={y} r={isActive ? 3 : 2} className="node-dot" />
                                            {isActive && <text x={x} y={y - 12} textAnchor="middle" className="node-label">{node.city}</text>}
                                        </g>
                                    )
                                })}
                            </svg>
                        </div>
                        <div className="selected-node-panel">
                            <div className="node-info">
                                <div className="label">SELECTED CLUSTER</div>
                                <div className="value">{selectedServer.name}</div>
                            </div>
                            <button className="confirm-node-btn" onClick={() => setActiveTab('connection')}>USE THIS NODE</button>
                        </div>
                    </div>
                )}

                {activeTab === 'profiles' && (
                    <div className="profiles-manager animate-fade-in">
                        <div className="profile-scroll">
                            <div className={`profile-row ${ovpnProfile ? 'active' : ''}`}>
                                <div className="icon">📄</div>
                                <div className="details">
                                    <div className="name">{ovpnProfile ? 'Active Configuration' : 'No Profile Selected'}</div>
                                    <div className="meta">Auto-detected settings</div>
                                </div>
                            </div>
                        </div>

                        <div className="profile-actions">
                            <label className="action-btn primary">
                                <input type="file" accept=".ovpn" onChange={handleFileUpload} style={{ display: 'none' }} />
                                <span>IMPORT .ovpn CONFIG</span>
                            </label>
                            <button className="action-btn secondary" onClick={fetchProfile}>
                                ACCOUNT CLOUD SYNC
                            </button>
                        </div>
                    </div>
                )}
            </main>

            <style dangerouslySetInnerHTML={{
                __html: `
                .dashboard { padding: 2rem; display: flex; flex-direction: column; gap: 2rem; }
                .status-indicator { display: flex; justify-content: center; opacity: 0.8; }
                .status-label { font-size: 0.7rem; letter-spacing: 3px; font-weight: 800; text-transform: uppercase; }
                .status-indicator.secure { color: var(--success); text-shadow: 0 0 10px rgba(16, 185, 129, 0.3); }
                .status-indicator.waiting { color: #f59e0b; animation: pulse 1.5s infinite; }
                .status-indicator.idle { color: var(--text-muted); }

                .tab-switcher { display: flex; gap: 1rem; -webkit-app-region: no-drag; }
                .tab-link { background: none; border: none; color: var(--text-muted); font-size: 9px; font-weight: 800; letter-spacing: 1px; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: all 0.2s; }
                .tab-link.active { color: var(--primary); background: rgba(14, 165, 233, 0.1); }

                .map-view { height: 100%; display: flex; flex-direction: column; padding: 1.5rem; }
                .map-wrapper { flex: 1; display: flex; align-items: center; justify-content: center; border: 1px solid var(--glass-border); border-radius: 12px; background: rgba(0,0,0,0.2); position: relative; overflow: hidden; }
                .nexus-map { width: 100%; height: auto; transition: all 0.5s ease; }
                
                .map-node { cursor: pointer; transition: all 0.3s; }
                .node-glow { fill: var(--primary); opacity: 0.2; }
                .node-dot { fill: var(--primary); }
                .map-node.active .node-glow { fill: var(--success); opacity: 0.4; animation: nodePulse 2s infinite; }
                .map-node.active .node-dot { fill: var(--success); }
                .node-label { fill: #fff; font-size: 8px; font-weight: 800; letter-spacing: 1px; }
                
                @keyframes nodePulse { 0% { r: 6; opacity: 0.4; } 50% { r: 12; opacity: 0; } 100% { r: 6; opacity: 0.4; } }

                .selected-node-panel { margin-top: 1.5rem; display: flex; justify-content: space-between; align-items: center; background: var(--glass-bg); padding: 1rem; border-radius: 12px; border-left: 3px solid var(--primary); }
                .node-info .label { font-size: 8px; color: var(--text-muted); letter-spacing: 1px; }
                .node-info .value { font-size: 11px; font-weight: 800; color: #fff; margin-top: 4px; }
                .confirm-node-btn { background: var(--primary); border: none; color: #fff; font-size: 9px; font-weight: 900; padding: 0.75rem 1rem; border-radius: 8px; cursor: pointer; }

                .goto-map-btn { background: rgba(14, 165, 233, 0.1); border: 1px solid var(--primary); color: var(--primary); margin-top: 1.5rem; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 800; font-size: 9px; cursor: pointer; }

                .tunnel-card { background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 16px; padding: 1.5rem; }
                .tunnel-header { display: flex; align-items: center; gap: 1rem; }
                .tunnel-info { flex: 1; }
                .tunnel-info .name { font-weight: 800; font-size: 1rem; color: #fff; }
                .tunnel-info .meta { font-size: 0.75rem; color: var(--text-muted); }

                .connection-toggle { width: 60px; height: 32px; cursor: pointer; position: relative; }
                .toggle-track { width: 100%; height: 100%; background: #334155; border-radius: 20px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
                .toggle-thumb { position: absolute; top: 4px; left: 4px; width: 24px; height: 24px; background: #fff; border-radius: 50%; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; justify-content: center; }
                .connection-toggle.active .toggle-track { background: var(--success); }
                .connection-toggle.active .toggle-thumb { left: 32px; }

                .live-metrics { display: flex; background: rgba(0,0,0,0.2); border-radius: 12px; padding: 1.5rem 1rem; border: 1px solid var(--glass-border); }
                .metric-box { flex: 1; text-align: center; }
                .metric-box .label { font-size: 0.6rem; letter-spacing: 1.5px; color: var(--text-muted); margin-bottom: 0.5rem; }
                .metric-box .value { font-family: 'JetBrains Mono', monospace; font-size: 1.1rem; font-weight: 800; color: var(--primary); }
                .metric-box .total-label { font-size: 9px; color: var(--text-muted); margin-top: 0.5rem; }
                .metric-divider { width: 1px; background: var(--glass-border); margin: 0 1rem; }

                .idle-placeholder { text-align: center; color: var(--text-muted); padding: 2rem 1rem; }
                .placeholder-icon { font-size: 2rem; margin-bottom: 1rem; opacity: 0.4; }
                .idle-placeholder p { font-size: 0.8rem; line-height: 1.5; max-width: 240px; margin: 0 auto; }

                .profiles-manager { padding: 1.5rem; display: flex; flex-direction: column; height: 100%; }
                .profile-scroll { flex: 1; overflow-y: auto; }
                .profile-row { display: flex; align-items: center; gap: 1rem; padding: 1.25rem; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 12px; margin-bottom: 1rem; }
                .profile-row.active { border-color: var(--primary); background: rgba(14, 165, 233, 0.05); }
                .profile-row .icon { font-size: 1.5rem; }
                .profile-row .details .name { font-weight: 700; color: #fff; }
                .profile-row .details .meta { font-size: 0.75rem; color: var(--text-muted); }

                .profile-actions { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 2rem; }
                .action-btn { width: 100%; padding: 1.1rem; border-radius: 12px; font-weight: 800; font-size: 0.85rem; letter-spacing: 1px; cursor: pointer; text-align: center; transition: all 0.2s; }
                .action-btn.primary { background: var(--primary); color: #fff; border: none; }
                .action-btn.secondary { background: transparent; color: var(--text-main); border: 1px solid var(--glass-border); }
                .action-btn:hover { transform: translateY(-1px); background: rgba(255,255,255,0.05); }
                .action-btn.primary:hover { background: #0369a1; }

                .btn-spinner { width: 14px; height: 14px; border: 2px solid rgba(0,0,0,0.1); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.6s linear infinite; }
                @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
                `}} />
        </div>
    )
}

export default App
