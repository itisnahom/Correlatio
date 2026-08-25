import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { calculatePearsonCorrelation } from '../utils/statistics';
import { useToast, ToastPortal } from './Toast';
import confetti from 'canvas-confetti';
import { getVarType, VARIABLE_TYPES } from '../utils/variableTypes';
import VariablePicker from './VariablePicker';
import { StreakWidget, ActivityHeatmap, calculateStreaks } from './Gamification';
import { seedTestData } from '../utils/seed';

const CARD_ACCENTS = [
  { stripe: 'linear-gradient(135deg,#f59e0b,#f97316)', iconBg: 'rgba(245,158,11,0.12)', glow: 'rgba(245,158,11,0.15)' },
  { stripe: 'linear-gradient(135deg,#10b981,#38bdf8)', iconBg: 'rgba(16,185,129,0.12)', glow: 'rgba(16,185,129,0.15)' },
  { stripe: 'linear-gradient(135deg,#f43f5e,#ec4899)', iconBg: 'rgba(244,63,94,0.12)', glow: 'rgba(244,63,94,0.15)' },
  { stripe: 'linear-gradient(135deg,#38bdf8,#818cf8)', iconBg: 'rgba(56,189,248,0.12)', glow: 'rgba(56,189,248,0.15)' },
  { stripe: 'linear-gradient(135deg,#a78bfa,#ec4899)', iconBg: 'rgba(167,139,250,0.12)', glow: 'rgba(167,139,250,0.15)' },
  { stripe: 'linear-gradient(135deg,#14b8a6,#10b981)', iconBg: 'rgba(20,184,166,0.12)', glow: 'rgba(20,184,166,0.15)' },
];

const VAR_COLORS = ['#f59e0b', '#10b981', '#f43f5e', '#38bdf8', '#a78bfa'];

const getRClass = (r) => r === null ? 'none' : r > 0.1 ? 'pos' : r < -0.1 ? 'neg' : 'none';
const getRLabel = (r) => r === null ? '—' : (r > 0 ? '+' : '') + r.toFixed(2);

const normalizeThread = (ch) => {
  if (ch.variables) return ch;
  return {
    ...ch,
    variables: [
      { name: ch.var1Name, typeId: ch.var1TypeId, icon: ch.var1Icon || '📊', unit: ch.var1Unit },
      { name: ch.var2Name, typeId: ch.var2TypeId, icon: ch.var2Icon || '📈', unit: ch.var2Unit },
    ],
  };
};

const normalizeLog = (log) => {
  if (log.values) return log;
  return { ...log, values: [log.val1, log.val2] };
};

const Dashboard = ({ user }) => {
  const location = useLocation();
  const [threads, setThreads] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // Gamification state
  const [allLogDates, setAllLogDates] = useState([]);
  const [streaks, setStreaks] = useState({ current: 0, longest: 0, today: false });

  // New thread form state — now supports N variables
  const [threadName, setThreadName] = useState('');
  const [variables, setVariables] = useState([
    { typeId: null, name: '', unit: '' },
    { typeId: null, name: '', unit: '' },
  ]);
  const [creating, setCreating] = useState(false);
  const { toasts, showToast } = useToast();

  useEffect(() => { 
    fetchAll(); 
    
    // Check if we came from Basket.jsx with prefilled variables
    if (location.state?.prefillVariables) {
      const prefill = location.state.prefillVariables.map(v => ({
        typeId: v.typeId, name: v.name, unit: v.unit
      }));
      // Pad to at least 2 variables
      while (prefill.length < 2) prefill.push({ typeId: null, name: '', unit: '' });
      
      setVariables(prefill.slice(0, 3)); // Max 3
      setShowModal(true);
      // Clear state so it doesn't reopen on refresh
      window.history.replaceState({}, document.title);
    }
  }, []);

  const fetchAll = async () => {
    try {
      const snap = await getDocs(query(collection(db, `users/${user.uid}/chains`)));
      const fetched = [];
      snap.forEach(d => {
        fetched.push({ id: d.id, ...d.data() });
      });
      setThreads(fetched.map(t => normalizeThread(t)));

      // Fetch all logs to populate gamification
      let allDates = [];
      for (const th of fetched) {
        const logsSnap = await getDocs(collection(db, `users/${user.uid}/chains/${th.id}/logs`));
        logsSnap.forEach(l => {
          const data = l.data();
          if (data.dateString) allDates.push(data.dateString);
        });
      }
      setAllLogDates(allDates);
      const computedStreaks = calculateStreaks(allDates);
      setStreaks(computedStreaks);
      if ([7, 14, 30, 50, 100].includes(computedStreaks.current) && computedStreaks.today) {
        setTimeout(() => {
          confetti({ particleCount: 150, spread: 80, origin: { y: 0.8 }, colors: ['#f59e0b', '#10b981', '#f43f5e'] });
          showToast(`Milestone: ${computedStreaks.current} Day Streak! 🎉`, 'success', 5000);
        }, 1000);
      }
      
      const st = {};
      for (const ch of fetched) {
        try {
          const ls = await getDocs(collection(db, `users/${user.uid}/chains/${ch.id}/logs`));
          const logs = []; ls.forEach(d => logs.push(normalizeLog(d.data())));
          
          const xData = logs.map(l => l.values[0]);
          const yData = logs.map(l => l.values[1]);
          const r = calculatePearsonCorrelation(xData, yData);
          let shift = null;
          if (logs.length > 7) {
            const sortedLogs = [...logs].sort((a,b) => (a.dateString || '').localeCompare(b.dateString || ''));
            const prevLogs = sortedLogs.slice(0, sortedLogs.length - 7);
            if (prevLogs.length >= 3) {
              const prevR = calculatePearsonCorrelation(prevLogs.map(l => l.values[0]), prevLogs.map(l => l.values[1]));
              if (prevR !== null && r !== null) {
                shift = parseFloat((r - prevR).toFixed(3));
              }
            }
          }
          st[ch.id] = { r, count: logs.length, shift };
        } catch { st[ch.id] = { r: null, count: 0 }; }
      }
      setStats(st);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const addVariable = () => {
    if (variables.length >= 3) return; // Max 3 variables
    setVariables(prev => [...prev, { typeId: null, name: '', unit: '' }]);
  };

  const removeVariable = (index) => {
    if (variables.length <= 2) return;
    setVariables(prev => prev.filter((_, i) => i !== index));
  };

  const updateVariable = (index, val) => {
    setVariables(prev => prev.map((v, i) => i === index ? val : v));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!threadName.trim()) {
      showToast('Please provide a name for this thread!', 'error');
      return;
    }
    
    const hasInvalidVars = variables.some(v => !v.name.trim() || !v.typeId);
    if (hasInvalidVars) {
      showToast('Please ensure all variables have a name and type selected.', 'error');
      return;
    }
    
    setCreating(true);
    try {
      const vars = variables.map(v => {
        const vType = getVarType(v.typeId);
        return {
          name: v.name,
          typeId: v.typeId,
          icon: vType.icon,
          unit: v.unit || vType.unit,
        };
      });

      const docData = {
        name: threadName,
        variables: vars,
        createdAt: serverTimestamp(),
      };

      const ref = await addDoc(collection(db, `users/${user.uid}/chains`), docData);

      const newThread = normalizeThread({ id: ref.id, ...docData });
      setThreads(prev => [...prev, newThread]);
      setStats(prev => ({ ...prev, [ref.id]: { r: null, count: 0 } }));

      setShowModal(false);
      setThreadName('');
      setVariables([{ typeId: null, name: '', unit: '' }, { typeId: null, name: '', unit: '' }]);
    } catch (err) { console.error(err); }
    finally { setCreating(false); }
  };

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  })();
  const firstName = user.displayName?.split(' ')[0] ?? 'there';

  if (loading) return <div className="loading-screen"><div className="spinner" /><span>Loading…</span></div>;

  return (
    <div className="fade-up">
      <div className="dashboard-hero">
        <p className="dashboard-greeting">
          {greeting}, {firstName} <span style={{ WebkitTextFillColor: 'initial', color: 'initial' }}>✨</span>
        </p>
        <p className="dashboard-sub">
          {threads.length === 0
            ? 'Create your first Thread to start discovering hidden correlations.'
            : `${threads.length} active thread${threads.length !== 1 ? 's' : ''}. Keep logging to strengthen your data.`}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <StreakWidget current={streaks.current} longest={streaks.longest} today={streaks.today} />
        <ActivityHeatmap allLogDates={allLogDates} />
      </div>

      <div className="section-bar">
        <span className="section-eyebrow">Your Threads</span>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: '0.82rem' }} onClick={() => seedTestData(user.uid)}>
            🧪 Seed Test Data
          </button>
          <button className="btn btn-amber" style={{ padding: '8px 16px', fontSize: '0.82rem' }} onClick={() => setShowModal(true)}>
            + New Thread
          </button>
        </div>
      </div>

      <div className="chains-grid">
        {threads.length === 0 && (
          <div className="card fade-up" style={{ padding: '64px 24px', textAlign: 'center', gridColumn: '1 / -1' }}>
            <div className="float" style={{ fontSize: '3rem', marginBottom: '16px' }}>🧵</div>
            <h3 style={{ marginBottom: '8px' }}>No threads yet</h3>
            <p style={{ maxWidth: '400px', margin: '0 auto', fontSize: '0.9rem' }}>Create a thread to track the relationship between any two or three variables in your life.</p>
          </div>
        )}
        {threads.map((thread, i) => {
          const { stripe, iconBg, glow } = CARD_ACCENTS[i % CARD_ACCENTS.length];
          const s = stats[thread.id] || {};
          const cls = getRClass(s.r);
          const rLabel = getRLabel(s.r);
          const vars = thread.variables || [];

          return (
            <Link to={`/chain/${thread.id}`} key={thread.id} className={`chain-card fade-up d${Math.min(i + 1, 6)}`} style={{ '--card-glow': glow }}>
              <div className="chain-card-stripe" style={{ background: stripe }} />
              <div className="chain-card-body">
                <div className="chain-card-top">
                  <div className="chain-icon-wrap" style={{ background: iconBg }}>
                    {vars[0]?.icon ?? '📊'}
                  </div>
                  <div className={`r-badge ${cls}`}>{rLabel}</div>
                </div>
                <div className="chain-card-name">{thread.name}</div>
                <div className="chain-card-vars">
                  {vars.map((v, vi) => (
                    <React.Fragment key={vi}>
                      {vi > 0 && <span className="chain-card-sep">×</span>}
                      <span style={{ color: VAR_COLORS[vi % VAR_COLORS.length] }}>{v.icon} {v.name}</span>
                    </React.Fragment>
                  ))}
                </div>
                <div className="chain-card-footer">
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className="chain-card-count">{s.count ?? 0} log{(s.count ?? 0) !== 1 ? 's' : ''}</span>
                    {Math.abs(s.shift || 0) > 0.2 && (
                      <span style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', color: s.shift > 0 ? 'var(--emerald)' : 'var(--rose)' }}>
                        {s.shift > 0 ? '📈 Trending Up' : '⚡ Shift Detected'}
                      </span>
                    )}
                  </div>
                  <span className="chain-card-cta">Explore →</span>
                </div>
              </div>
            </Link>
          );
        })}

        <button className="new-chain-tile" onClick={() => setShowModal(true)}>
          <div className="new-chain-plus">+</div>
          <span className="new-chain-label">Track a new relationship</span>
        </button>
      </div>

      {/* Create thread modal — now supports N variables */}
      {showModal && (
        <div className="glass-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">New Thread</span>
              <button className="modal-close" onClick={() => { setShowModal(false); }}>×</button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="input-label">Thread Name</label>
                <input
                  className="input"
                  type="text"
                  placeholder="e.g. Sleep & Focus, Coffee & Productivity…"
                  value={threadName}
                  onChange={e => setThreadName(e.target.value)}
                />
              </div>

              {variables.map((v, i) => (
                <React.Fragment key={i}>
                  {i > 0 && (
                    <div className="modal-connector">
                      <div className="connector-line" />
                      <span className="connector-dot" style={{ background: VAR_COLORS[i - 1] }} />
                      <span className="connector-text">threads with</span>
                      <span className="connector-dot" style={{ background: VAR_COLORS[i] }} />
                      <div className="connector-line" />
                    </div>
                  )}
                  <div className="modal-section" style={{ position: 'relative' }}>
                    <VariablePicker
                      label={`Variable ${String.fromCharCode(65 + i)}`}
                      value={v}
                      onChange={(val) => updateVariable(i, val)}
                      accentColor={VAR_COLORS[i]}
                    />
                    {variables.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeVariable(i)}
                        style={{
                          position: 'absolute', top: 0, right: 0,
                          background: 'none', border: 'none', color: 'var(--text-3)',
                          cursor: 'pointer', fontSize: '1.1rem', padding: '4px 8px',
                        }}
                      >×</button>
                    )}
                  </div>
                </React.Fragment>
              ))}

              {variables.length < 3 && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={addVariable}
                  style={{ width: '100%', borderRadius: '10px', padding: '10px', margin: '12px 0 4px', borderStyle: 'dashed' }}
                >
                  + Add another variable ({variables.length}/3)
                </button>
              )}

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-amber"
                  disabled={creating}
                  style={{ flex: 1, borderRadius: '10px', padding: '12px', fontSize: '0.9rem' }}
                >
                  {creating ? 'Creating…' : 'Create Thread'}
                </button>
                <button type="button" className="btn btn-ghost" style={{ borderRadius: '10px', padding: '12px 18px' }} onClick={() => { setShowModal(false); }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <ToastPortal toasts={toasts} />
    </div>
  );
};

export default Dashboard;
