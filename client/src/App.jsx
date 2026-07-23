import React, { useState, useEffect } from 'react';
import { Truck, Shield, ArrowRight } from 'lucide-react';
import AdminDashboard from './pages/AdminDashboard';
import { API_BASE_URL } from './config';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-sync token
  useEffect(() => {
    if (token && user) {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }, [token, user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Authentication failed.');
      }
      if (data.user.role !== 'admin') {
        throw new Error('Access denied. Administrator privileges required.');
      }
      setToken(data.token);
      setUser(data.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (mail, pass) => {
    setEmail(mail);
    setPassword(pass);
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    setEmail('');
    setPassword('');
  };

  if (token && user) {
    if (user.role !== 'admin') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return null;
    }
    return (
      <div style={{ position: 'relative' }}>
        <AdminDashboard token={token} onLogout={handleLogout} />
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Orbs */}
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.15) 0%, rgba(0,0,0,0) 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.15) 0%, rgba(0,0,0,0) 70%)', pointerEvents: 'none' }} />

      <div className="glass-panel" style={{ width: '420px', padding: '2.5rem', zIndex: 10 }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Truck className="glow-text-cyan" size={36} style={{ margin: '0 auto 0.5rem auto' }} />
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, fontFamily: 'var(--font-display)' }}>
            SmartRoute <span className="glow-text-cyan">Quantum</span>
          </h2>
          <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: '0.5rem 0 0 0' }}>
            Hybrid Quantum-Classical Logistics Optimisation
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            color: '#ef4444',
            padding: '0.65rem',
            marginBottom: '1rem',
            fontSize: '0.8rem',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <label>Sign-in Email Address</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder="e.g. name@smartroute.com"
          />

          <label>Secret Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}>
            {loading ? 'Authenticating credentials...' : 'Enter Console'} <ArrowRight size={16} />
          </button>
        </form>

        {/* Demo Fast Fill Buttons */}
        <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid var(--panel-border)' }}>
          <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '8px', fontWeight: 600 }}>Quick Autofill Accounts:</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
            <div
              style={{
                cursor: 'pointer',
                background: 'rgba(6, 182, 212, 0.06)',
                border: '1px solid rgba(6, 182, 212, 0.2)',
                borderRadius: '6px',
                padding: '6px',
                textAlign: 'center',
                fontSize: '0.75rem',
                color: '#06b6d4'
              }}
              onClick={() => handleQuickLogin('admin@smartroute.com', 'admin123')}
            >
              <Shield size={12} style={{ marginRight: '4px', verticalAlign: 'text-top' }} /> Admin Account
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
