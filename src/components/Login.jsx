import React, { useState } from 'react'
import axios from 'axios'
import logo from '../assets/logo.png'

const Login = ({ onLoginSuccess, backendUrl }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await axios.post(`${backendUrl}/admin/login`, {
                username, password, otp_code: otp
            });
            // Store token in native encrypted vault (libsecret/keychain)
            await window.electron.storeToken(res.data.access_token);
            onLoginSuccess(res.data.access_token);
        } catch (err) {
            setError(err.response?.data?.detail || 'Handshake Failed: Invalid Identity Vector.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ width: '100%', maxWidth: '340px', padding: '2rem' }} className="animate-fade-in">
            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                <img src={logo} style={{ width: '64px', height: '64px', marginBottom: '1.5rem', filter: 'drop-shadow(0 0 10px rgba(14, 165, 233, 0.4))' }} alt="Nexus Shield" />
                <h2 style={{ fontSize: '1.2rem', fontWeight: '900', letterSpacing: '4px', color: '#fff', marginBottom: '0.5rem' }}>AUTHORIZE ACCESS</h2>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '2px' }}>NEXUS COMMAND CREDENTIALS</div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                    <input
                        type="text"
                        placeholder="Nexus Identifier"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        required
                        className="nexus-input"
                    />
                </div>
                <div className="form-group">
                    <input
                        type="password"
                        placeholder="System Password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        className="nexus-input"
                    />
                </div>
                <div className="form-group">
                    <input
                        type="text"
                        placeholder="MFA Code"
                        maxLength={6}
                        value={otp}
                        onChange={e => setOtp(e.target.value)}
                        required
                        className="nexus-input"
                        style={{ textAlign: 'center', letterSpacing: '5px', fontSize: '1.1rem' }}
                    />
                </div>

                {error && <div style={{ color: 'var(--danger)', fontSize: '0.7rem', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', textAlign: 'center' }}>{error}</div>}

                <button type="submit" className="login-btn" disabled={loading}>
                    {loading ? 'SYNCING...' : 'ESTABLISH LINK'}
                </button>
            </form>

            <style dangerouslySetInnerHTML={{
                __html: `
                .nexus-input {
                    width: 100%;
                    background: var(--glass-bg);
                    border: 1px solid var(--glass-border);
                    color: #fff;
                    padding: 1rem;
                    border-radius: 12px;
                    outline: none;
                    transition: border-color 0.3s;
                }
                .nexus-input:focus { border-color: var(--primary); }
                .login-btn {
                    margin-top: 1rem;
                    background: var(--primary);
                    color: #fff;
                    border: none;
                    padding: 1.1rem;
                    border-radius: 12px;
                    font-weight: 800;
                    letter-spacing: 2px;
                    cursor: pointer;
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .login-btn:hover {
                    box-shadow: 0 0 20px var(--primary-glow);
                    transform: translateY(-1px);
                }
            `}} />
        </div>
    )
};

export default Login;
