import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { doc, getDoc, collection, query, getDocs, addDoc, deleteDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { useNavigate, useParams, Link } from 'react-router-dom';
import html2canvas from 'html2canvas';
import CorrelationGraph from './CorrelationGraph';
import NerdModeStats from './NerdModeStats';
import TimerInput from './TimerInput';
import ExportCard, { EXPORT_THEMES } from './ExportCard';
import ExportReport from './ExportReport';
import { exportCanvasToPdf } from '../utils/pdfExport';
import { calculatePearsonCorrelation, interpretCorrelation, calculatePValue, significanceLabel, trendDirection, booleanStreak, computeImpactStatement } from '../utils/statistics';
import { useToast, ToastPortal } from './Toast';

const VAR_COLORS = ['#f59e0b', '#10b981', '#f43f5e', '#38bdf8', '#a78bfa'];

const getRClass = (r) => r === null ? 'none' : r > 0.1 ? 'pos' : r < -0.1 ? 'neg' : 'none';
const getRLabel = (r) => r === null ? '—' : (r > 0 ? '+' : '') + r.toFixed(3);
const getStrength = (r) => {
  if (r === null) return '—';
  const a = Math.abs(r);
  if (a >= 0.8) return 'Strong';
  if (a >= 0.5) return 'Moderate';
  if (a >= 0.3) return 'Weak';
  return 'Very weak';
};

// Normalize old format to new variables array
const normalizeThread = (ch) => {
  if (ch.variables) return ch;
  return {
    ...ch,
    variables: [
      { name: ch.var1Name, typeId: ch.var1TypeId, icon: ch.var1Icon || '📊', unit: ch.var1Unit },
      { name: ch.var2Name, typeId: ch.var2TypeId, icon: ch.var2Icon || '📈', unit: ch.var2Unit }
    ]
  };
};

const normalizeLog = (log) => {
  if (log.values) return log;
  return { ...log, values: [log.val1, log.val2] };
};

// Get a value handling backwards compat for old logs
const getLogValue = (log, index) => {
  return log.values[index];
};

const ChainDetail = ({ user }) => {
  const { chainId } = useParams();
  const navigate = useNavigate();
  const [chain, setChain] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dynamic values for N variables
  const [values, setValues] = useState([]);
  const [nerdMode, setNerdMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('scatter');
  const [note, setNote] = useState('');
  // Selected pair for scatter plot: [indexA, indexB]
  const [selectedPair, setSelectedPair] = useState([0, 1]);
  const exportRef = useRef(null);
  const exportReportRef = useRef(null);
  
  // Export Modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportTheme, setExportTheme] = useState(EXPORT_THEMES[0].id);
  const [exportType, setExportType] = useState('card'); // 'card' | 'report'
  const [exporting, setExporting] = useState(false);
  const { toasts, showToast } = useToast();

  useEffect(() => { fetchData(); }, [chainId]);

  const fetchData = async () => {
    try {
      const chainSnap = await getDoc(doc(db, `users/${user.uid}/chains/${chainId}`));
      if (chainSnap.exists()) {
        const normalized = normalizeThread({ id: chainSnap.id, ...chainSnap.data() });
        setChain(normalized);
        setValues(Array.from({ length: normalized.variables.length }).fill(''));
      }
      const q = query(collection(db, `users/${user.uid}/chains/${chainId}/logs`), orderBy('createdAt', 'asc'));
      const snap = await getDocs(q);
      const arr = [];
      snap.forEach(d => {
        arr.push({ id: d.id, ...normalizeLog(d.data()) });
      });
      setLogs(arr);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this thread? This will delete all logged data and cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/chains/${chainId}`));
      navigate('/');
    } catch (err) { console.error(err); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (values.some(v => v === '')) return;
    setSubmitting(true);
    try {
      const numValues = values.map(Number);
      const logDoc = {
        values: numValues,
        note: note.trim(),
        createdAt: serverTimestamp(),
        dateString: (() => {
          const d = new Date();
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })(),
      };
      await addDoc(collection(db, `users/${user.uid}/chains/${chainId}/logs`), logDoc);
      setValues(Array.from({ length: chain.variables.length }).fill(''));
      setNote('');
      showToast('Entry logged! Keep the streak going 🔥', 'success', 2500);
      fetchData();
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  // Compute correlation matrix for all variable pairs
  const corrMatrix = useMemo(() => {
    if (!chain || logs.length < 3) return [];
    const vars = chain.variables;
    const matrix = [];
    for (let i = 0; i < vars.length; i++) {
      for (let j = i + 1; j < vars.length; j++) {
        const xData = logs.map(l => getLogValue(l, i)).filter(v => v !== null && v !== undefined);
        const yData = logs.map(l => getLogValue(l, j)).filter(v => v !== null && v !== undefined);
        const minLen = Math.min(xData.length, yData.length);
        const r = calculatePearsonCorrelation(xData.slice(0, minLen), yData.slice(0, minLen));
        matrix.push({ i, j, r, nameA: vars[i].name, nameB: vars[j].name, iconA: vars[i].icon, iconB: vars[j].icon });
      }
    }
    return matrix;
  }, [chain, logs]);

  // Currently selected pair's r value
  const isAllThree = selectedPair.length === 3;
  const currentCorr = useMemo(() => {
    if (isAllThree) return { r: null };
    return corrMatrix.find(m => m.i === selectedPair[0] && m.j === selectedPair[1]) || { r: null };
  }, [corrMatrix, selectedPair, isAllThree]);

  const rValue = currentCorr.r;
  const absR = rValue !== null ? Math.abs(rValue) : 0;
  const strength = getStrength(absR);
  const interpretation = interpretCorrelation(rValue, chain?.variables[selectedPair[0]]?.name, chain?.variables[selectedPair[1]]?.name);

  const handleExport = async (format = 'png') => {
    const targetRef = exportType === 'report' ? exportReportRef.current : exportRef.current;
    if (!targetRef) return;
    setExporting(true);
    try {
      if (document.fonts) await document.fonts.ready;
      
      const canvas = await html2canvas(targetRef, {
        backgroundColor: exportType === 'report' ? '#09090b' : null,
        scale: 2.2,
        useCORS: true,
        allowTaint: true,
        logging: false
      });

      const baseName = `Correlatio-${chain.name.replace(/\s+/g, '-')}-${exportType === 'report' ? 'Report' : 'Card'}`;

      if (format === 'pdf') {
        await exportCanvasToPdf(canvas, `${baseName}.pdf`);
        showToast('PDF exported successfully! 📄', 'success', 3000);
      } else {
        const link = document.createElement('a');
        link.download = `${baseName}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('Image exported! 🖼️', 'success', 3000);
      }
      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export', err);
      showToast('Export failed. Please try again.', 'error', 3000);
    } finally {
      setExporting(false);
    }
  };


  if (loading) return <div className="loading-screen"><div className="spinner" /><span>Loading…</span></div>;
  if (!chain) return <div className="loading-screen">Thread not found.</div>;

  const vars = chain.variables;
  const rClass = getRClass(rValue);
  const rLabel = getRLabel(rValue);

  // Build compatible chain object for CorrelationGraph (selected pair)
  const graphChain = {
    ...chain,
    var1Name: vars[selectedPair[0]]?.name,
    var1Unit: vars[selectedPair[0]]?.unit,
    var1Icon: vars[selectedPair[0]]?.icon,
    var2Name: vars[selectedPair[1]]?.name,
    var2Unit: vars[selectedPair[1]]?.unit,
    var2Icon: vars[selectedPair[1]]?.icon,
    ...(isAllThree ? {
      var3Name: vars[2]?.name,
      var3Unit: vars[2]?.unit,
      var3Icon: vars[2]?.icon,
    } : {})
  };

  // Build compatible logs for the selected pair
  const graphLogs = logs.map(l => ({
    ...l,
    val1: getLogValue(l, selectedPair[0]),
    val2: getLogValue(l, selectedPair[1]),
    ...(isAllThree ? { val3: getLogValue(l, 2) } : {})
  }));

  const todayDateString = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const hasLoggedToday = logs.some(l => l.dateString === todayDateString);
  
  const displayDate = (ds) => {
    if (!ds) return '';
    if (ds.includes('-')) {
      const parts = ds.split('-');
      if (parts.length === 3) {
        const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    }
    return ds; // fallback for old "Aug 17" strings
  };

  return (
    <div className="chain-page fade-up">
      <Link to="/" className="back-btn" data-html2canvas-ignore="true">← Back to threads</Link>

      <div ref={exportRef} style={{ background: 'var(--bg)', padding: '20px', borderRadius: '16px', margin: '-20px' }}>
      {/* Header */}
      <div className="chain-page-header">
        <div>
          <h1 className="chain-page-title">{chain.name}</h1>
          <div className="chain-page-meta">
            {vars.map((v, vi) => (
              <React.Fragment key={vi}>
                {vi > 0 && <span className="thread-connector-mini">
                  <span className="thread-dot" style={{ background: VAR_COLORS[vi - 1] }} />
                  <span className="thread-line" />
                  <span className="thread-dot" style={{ background: VAR_COLORS[vi] }} />
                </span>}
                <span className="chain-var-tag" style={{ borderColor: `${VAR_COLORS[vi]}33` }}>
                  <span>{v.icon}</span>
                  <span style={{ color: VAR_COLORS[vi] }}>{v.name}</span>
                  {v.unit && <span style={{ color: 'var(--text-3)' }}>{v.unit}</span>}
                </span>
              </React.Fragment>
            ))}
            <span style={{ color: 'var(--text-3)', fontSize: '0.78rem' }}>· {logs.length} entries</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--amber)' }} onClick={() => setShowExportModal(true)}>
            📸 Export
          </button>
          <label className="toggle-wrap" htmlFor="nerd-mode">
            <input type="checkbox" id="nerd-mode" checked={nerdMode} onChange={e => setNerdMode(e.target.checked)} />
            <div className="toggle-track"><div className="toggle-thumb" /></div>
            <span className="nerd-toggle-text">🤓 Nerd Mode</span>
          </label>
          <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '0.75rem', borderColor: 'rgba(244,63,94,0.3)', color: 'var(--rose)' }} onClick={handleDelete}>
            Delete Thread
          </button>
        </div>
      </div>

      {/* Correlation Matrix (for 3+ variables, pair-specific for scatter plot) */}
      {vars.length > 2 && logs.length >= 3 && activeTab === 'scatter' && (
        <div className="card corr-matrix-panel d1 fade-up">
          <div className="corr-matrix-title">Correlation Matrix</div>
          <div className="corr-matrix-grid" style={{ gridTemplateColumns: `repeat(${corrMatrix.length}, 1fr)` }}>
            {corrMatrix.map((pair, idx) => {
              const isActive = selectedPair[0] === pair.i && selectedPair[1] === pair.j && !isAllThree;
              const pairR = pair.r;
              const pairClass = getRClass(pairR);
              return (
                <button
                  key={idx}
                  className={`corr-matrix-cell ${pairClass}${isActive ? ' active' : ''}`}
                  onClick={() => setSelectedPair([pair.i, pair.j])}
                >
                  <div className="corr-matrix-pair">
                    <span style={{ color: VAR_COLORS[pair.i] }}>{pair.iconA}</span>
                    <span className="corr-matrix-x">×</span>
                    <span style={{ color: VAR_COLORS[pair.j] }}>{pair.iconB}</span>
                  </div>
                  <div className="corr-matrix-names">{pair.nameA} & {pair.nameB}</div>
                  <div className={`r-badge ${pairClass}`} style={{ fontSize: '0.72rem' }}>
                    {pairR !== null ? (pairR > 0 ? '+' : '') + pairR.toFixed(2) : '—'}
                  </div>
                </button>
              );
            })}

            {vars.length === 3 && (
              <button
                className={`corr-matrix-cell none${isAllThree ? ' active' : ''}`}
                onClick={() => setSelectedPair([0, 1, 2])}
                style={{ gridColumn: `1 / span ${corrMatrix.length}`, marginTop: '8px' }}
              >
                <div className="corr-matrix-pair">
                  <span style={{ color: VAR_COLORS[0] }}>{vars[0].icon}</span>
                  <span className="corr-matrix-x">×</span>
                  <span style={{ color: VAR_COLORS[1] }}>{vars[1].icon}</span>
                  <span className="corr-matrix-x">×</span>
                  <span style={{ color: VAR_COLORS[2] }}>{vars[2].icon}</span>
                </div>
                <div className="corr-matrix-names">All Three Variables</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 4 }}>3D Bubble Chart View</div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Correlation Hero Banner (Pair-specific) */}
      {logs.length >= 3 && activeTab === 'scatter' && !isAllThree && (() => {
        const xValsHero = logs.map(l => l.values[selectedPair[0]]).filter(v => v != null);
        const yValsHero = logs.map(l => l.values[selectedPair[1]]).filter(v => v != null);
        const pVal = calculatePValue(rValue, logs.length);
        const isSig = pVal !== null && pVal < 0.05;
        const impact = computeImpactStatement(
          xValsHero, yValsHero,
          vars[selectedPair[0]]?.name, vars[selectedPair[1]]?.name,
          vars[selectedPair[1]]?.unit
        );
        return (
          <div className={`corr-hero ${rClass} d1 fade-up`}>
            <div className="corr-hero-r">{rLabel}</div>
            <div className="corr-hero-info">
              <strong>
                {strength} {rClass === 'pos' ? 'positive' : rClass === 'neg' ? 'negative' : ''} correlation
                {vars.length > 2 && ` (${vars[selectedPair[0]]?.name} × ${vars[selectedPair[1]]?.name})`}
              </strong>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {interpretation} · {logs.length} data points
                {pVal !== null && (
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                    background: isSig ? 'rgba(16,185,129,0.12)' : 'rgba(160,155,140,0.1)',
                    border: `1px solid ${isSig ? 'rgba(16,185,129,0.3)' : 'rgba(160,155,140,0.2)'}`,
                    color: isSig ? 'var(--emerald)' : 'var(--text-3)',
                  }}>
                    {isSig ? '🔬 Significant' : '⚠️ More data'}
                  </span>
                )}
              </span>
              {impact && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontStyle: 'italic', marginTop: 4 }}>
                  💡 {impact}
                </span>
              )}
            </div>
            <div className="corr-bar-wrap">
              <div className="corr-bar-track">
                <div className="corr-bar-fill" style={{ width: `${absR * 100}%` }} />
              </div>
              <div className="corr-bar-labels">
                <span>0 (none)</span>
                <span>|r| = {absR.toFixed(2)}</span>
                <span>1 (perfect)</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Quick Stats Bar */}
      {logs.length >= 3 && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {vars.map((v, vi) => {
            const vals = logs.map(l => l.values[vi]).filter(x => x != null);
            const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
            const min = Math.min(...vals);
            const max = Math.max(...vals);
            const isBool = v.typeId === 'boolean' || v.unit === 'bool';
            const yesCount = isBool ? vals.filter(x => x === 1).length : null;
            const streak = isBool ? booleanStreak(logs, vi) : null;
            const trend = isBool ? null : trendDirection(vals);
            const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
            const trendColor = trend === 'up' ? 'var(--emerald)' : trend === 'down' ? 'var(--rose)' : 'var(--text-3)';
            return (
              <div key={vi} style={{
                background: 'var(--surface)', border: `1px solid ${VAR_COLORS[vi]}22`,
                borderRadius: '12px', padding: '12px 16px', fontSize: '0.78rem', minWidth: '140px', flex: 1,
              }}>
                <div style={{ color: VAR_COLORS[vi], fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{v.icon} {v.name}</span>
                  {!isBool && trend && (
                    <span style={{ color: trendColor, fontSize: '1rem', fontWeight: 700 }}>{trendIcon}</span>
                  )}
                </div>
                {isBool ? (
                  <>
                    <div style={{ color: 'var(--text-2)' }}>Yes <strong>{yesCount}</strong> / No <strong>{vals.length - yesCount}</strong></div>
                    {streak > 0 && (
                      <div style={{ color: 'var(--amber)', fontSize: '0.68rem', marginTop: 4 }}>🔥 {streak}-day streak</div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ color: 'var(--text-2)' }}>Avg <strong style={{ color: 'var(--text-1)' }}>{parseFloat(avg.toFixed(2))}</strong> {v.unit}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <span style={{ color: 'var(--text-3)', fontSize: '0.68rem' }}>↓ {parseFloat(min.toFixed(1))}</span>
                      <span style={{ color: 'var(--text-3)', fontSize: '0.68rem' }}>↑ {parseFloat(max.toFixed(1))}</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '12px 16px', fontSize: '0.78rem', minWidth: '100px',
          }}>
            <div style={{ color: 'var(--text-3)', fontWeight: 600, marginBottom: '6px' }}>📅 Entries</div>
            <div style={{ color: 'var(--text-2)' }}><strong style={{ color: 'var(--text-1)' }}>{logs.length}</strong> days</div>
            <div style={{ color: 'var(--text-3)', fontSize: '0.68rem', marginTop: 4 }}>
              {logs.length >= 30 ? '🟢 Great sample' : logs.length >= 10 ? '🟡 Building up' : '🔴 Need more'}
            </div>
          </div>
        </div>
      )}

      {/* Multivariate Bubble Chart Hero Banner */}
      {logs.length >= 3 && activeTab === 'scatter' && isAllThree && (
        <div className="corr-hero none d1 fade-up" style={{ padding: '24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: '2.4rem', marginBottom: '8px' }}>🫧</div>
          <strong style={{ fontSize: '1.2rem', display: 'block', color: 'var(--text-1)', marginBottom: '6px' }}>Multivariate Bubble Chart</strong>
          <span style={{ color: 'var(--text-3)', fontSize: '0.9rem', maxWidth: '400px', lineHeight: 1.5 }}>
            Exploring the intersection of 3 variables simultaneously. The <strong style={{ color: VAR_COLORS[2] }}>size of each bubble</strong> represents the value of <strong style={{ color: VAR_COLORS[2] }}>{vars[2].name}</strong>.
          </span>
        </div>
      )}

      {/* Main layout */}
      <div className="chain-layout">
        {/* Log Panel */}
        <div className="card log-panel d2 fade-up">
          <div className="log-panel-title">Log today's values</div>
          
          {hasLoggedToday ? (
            <div className="logged-today-success" style={{ padding: '24px 16px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✅</div>
              <h3 style={{ color: 'var(--emerald)', margin: '0 0 4px', fontSize: '1.1rem' }}>Data logged for today!</h3>
              <p style={{ color: 'var(--text-3)', fontSize: '0.85rem', margin: 0 }}>Come back tomorrow to keep your streak alive.</p>
            </div>
          ) : (
            <form onSubmit={handleAdd} className="log-form">
              {vars.map((v, vi) => (
                <div key={vi}>
                  <div className="log-var-label">
                    <span className="log-var-icon">{v.icon}</span>
                    <span style={{ color: VAR_COLORS[vi] }}>{v.name}</span>
                    {v.unit && <span className="log-var-unit">{v.unit}</span>}
                  </div>
                  {v.typeId === 'boolean' || v.unit === 'bool' ? (
                  <div style={{ marginTop: '8px', marginBottom: '16px' }}>
                    <label className="toggle-wrap" style={{ cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={values[vi] === 1}
                        onChange={(e) => {
                          setValues(prev => prev.map((pv, pi) => pi === vi ? (e.target.checked ? 1 : 0) : pv));
                        }} 
                      />
                      <div className="toggle-track"><div className="toggle-thumb" /></div>
                      <span className="nerd-toggle-text" style={{ fontSize: '0.9rem' }}>
                        {values[vi] === 1 ? 'Yes' : 'No'}
                      </span>
                    </label>
                  </div>
                ) : (
                  <TimerInput
                    value={values[vi] || ''}
                    onChange={(val) => {
                      setValues(prev => prev.map((pv, pi) => pi === vi ? val : pv));
                    }}
                    unit={v.unit}
                    isTimeBased={['hours', 'minutes', 'hrs', 'min'].includes(v.typeId || v.unit)}
                  />
                )}
                </div>
              ))}
              
              <div className="log-var-label" style={{ marginTop: '8px' }}>
                <span className="log-var-icon">📓</span>
                <span style={{ color: 'var(--text-2)' }}>Journal Note (optional)</span>
              </div>
              <textarea
                className="input"
                style={{ width: '100%', minHeight: '60px', padding: '10px', resize: 'vertical' }}
                placeholder="Any context for today?"
                value={note}
                onChange={e => setNote(e.target.value)}
              />

              <button type="submit" className="btn btn-amber log-submit" disabled={submitting}>
                {submitting ? 'Saving…' : '+ Log entry'}
              </button>
            </form>
          )}

          {logs.length > 0 && (
            <div className="log-history">
              <div className="divider" style={{ margin: '18px 0 14px' }} />
              <div className="log-history-title">Recent entries</div>
              {logs.slice().reverse().slice(0, 8).map((log, li) => (
                <div key={log.id} className="log-row slide-in-right" style={{ animationDelay: `${li * 0.05}s` }}>
                  <span className="log-row-date">{displayDate(log.dateString)}</span>
                  <div className="log-row-vals">
                    {vars.map((v, vi) => (
                      <React.Fragment key={vi}>
                        {vi > 0 && <span className="log-val-sep">·</span>}
                        <span style={{ color: VAR_COLORS[vi], fontWeight: 500, fontSize: '0.82rem' }}>
                          {getLogValue(log, vi)}
                        </span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Charts */}
        <div>
          <div className="card chart-panel d3 fade-up">
            {logs.length < 3 ? (
              <div className="empty-chart">
                <div className="empty-chart-icon">📈</div>
                <p>Log at least <strong>3 entries</strong> to generate your correlation chart.</p>
              </div>
            ) : (
              <>
                <div className="chart-tabs">
                  {[['scatter', 'Scatter Plot'], ['timeline', 'Timeline'], ['radar', 'Distribution'], ['heatmap', 'Heat Map']].map(([id, label]) => (
                    <button key={id} className={`chart-tab${activeTab === id ? ' active' : ''}`} onClick={() => setActiveTab(id)}>
                      {label}
                    </button>
                  ))}
                </div>
                {vars.length > 2 && activeTab === 'scatter' && (
                  <div className="pair-selector">
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>Viewing:</span>
                    <span style={{ color: VAR_COLORS[selectedPair[0]], fontWeight: 600, fontSize: '0.82rem' }}>
                      {vars[selectedPair[0]]?.icon} {vars[selectedPair[0]]?.name}
                    </span>
                    <span style={{ color: 'var(--text-3)', fontSize: '0.72rem' }}>vs</span>
                    <span style={{ color: VAR_COLORS[selectedPair[1]], fontWeight: 600, fontSize: '0.82rem' }}>
                      {vars[selectedPair[1]]?.icon} {vars[selectedPair[1]]?.name}
                    </span>
                    {isAllThree && (
                      <>
                        <span style={{ color: 'var(--text-3)', fontSize: '0.72rem' }}>sized by</span>
                        <span style={{ color: VAR_COLORS[2], fontWeight: 600, fontSize: '0.82rem' }}>
                          {vars[2]?.icon} {vars[2]?.name}
                        </span>
                      </>
                    )}
                  </div>
                )}
                <CorrelationGraph
                  logs={graphLogs}
                  chain={graphChain}
                  rValue={rValue}
                  mode={activeTab}
                  allLogs={logs}
                  allVars={vars}
                  varColors={VAR_COLORS}
                />
              </>
            )}
          </div>

          {nerdMode && logs.length >= 3 && (
            <div className="d4 fade-up">
              <NerdModeStats rValue={rValue} n={logs.length} chain={graphChain} logs={graphLogs} />
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Export Modal with Theme Picker and Format Chooser */}
      {showExportModal && (
        <div className="glass-overlay" onClick={e => e.target === e.currentTarget && setShowExportModal(false)} style={{ zIndex: 9999, overflow: 'auto', padding: '20px' }}>
          <div className="modal" style={{ maxWidth: '940px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '24px', overflow: 'hidden' }}>
            <div className="modal-header" style={{ flexShrink: 0, padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.2rem' }}>📸</span>
                <span className="modal-title" style={{ fontSize: '1.1rem', fontWeight: 700 }}>Export & Share</span>
              </div>
              <button className="modal-close" onClick={() => setShowExportModal(false)}>×</button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Format Switcher: Card vs Executive Report */}
              <div style={{
                display: 'flex',
                background: 'rgba(255,252,245,0.05)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '4px',
                marginBottom: '20px',
                gap: '6px',
              }}>
                <button
                  onClick={() => setExportType('card')}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: exportType === 'card' ? 'var(--amber)' : 'transparent',
                    color: exportType === 'card' ? '#09090b' : 'var(--text-2)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  🎨 Social Card
                </button>
                <button
                  onClick={() => setExportType('report')}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: exportType === 'report' ? 'var(--amber)' : 'transparent',
                    color: exportType === 'report' ? '#09090b' : 'var(--text-2)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  📊 Executive Report (PDF)
                </button>
              </div>

              {/* Theme Selector */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {EXPORT_THEMES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setExportTheme(t.id)}
                    style={{
                      padding: '7px 16px',
                      borderRadius: '20px',
                      border: exportTheme === t.id ? '2px solid white' : '1px solid var(--border)',
                      background: t.bg,
                      color: t.color,
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      opacity: exportTheme === t.id ? 1 : 0.6,
                      boxShadow: exportTheme === t.id ? '0 4px 12px rgba(0,0,0,0.4)' : 'none',
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>

              {/* Hidden elements strictly for html2canvas capture without CSS transform scaling */}
              <div style={{ position: 'absolute', top: '-20000px', left: '-20000px' }}>
                <ExportCard 
                  ref={exportRef}
                  chain={chain}
                  rValue={rValue}
                  logsCount={logs.length}
                  themeId={exportTheme}
                  user={user}
                />
                <ExportReport
                  ref={exportReportRef}
                  chain={chain}
                  rValue={rValue}
                  logs={logs}
                  themeId={exportTheme}
                  user={user}
                />
              </div>

              {/* Visual Preview Container */}
              {exportType === 'card' ? (
                <div style={{
                  width: '800px',
                  height: '450px',
                  transform: 'scale(0.8)',
                  transformOrigin: 'top center',
                  marginBottom: '-70px',
                  boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
                  borderRadius: '24px',
                  overflow: 'hidden',
                }}>
                  <ExportCard 
                    chain={chain}
                    rValue={rValue}
                    logsCount={logs.length}
                    themeId={exportTheme}
                    user={user}
                  />
                </div>
              ) : (
                <div style={{
                  width: '100%',
                  maxHeight: '460px',
                  overflowY: 'auto',
                  borderRadius: '16px',
                  border: '1px solid rgba(255,252,245,0.1)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                  background: '#09090b',
                  display: 'flex',
                  justifyContent: 'center',
                  padding: '20px 0',
                }}>
                  <div style={{ transform: 'scale(0.72)', transformOrigin: 'top center', marginBottom: '-280px' }}>
                    <ExportReport
                      chain={chain}
                      rValue={rValue}
                      logs={logs}
                      themeId={exportTheme}
                      user={user}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{
              flexShrink: 0,
              padding: '18px 24px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255,252,245,0.02)',
            }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>
                {exportType === 'report' ? '📄 Executive PDF Report format' : '🎨 Visual Card format'}
              </span>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => handleExport('png')}
                  disabled={exporting}
                  style={{ padding: '10px 20px', fontSize: '0.9rem', borderRadius: '10px' }}
                >
                  {exporting ? 'Exporting…' : '🖼️ Download PNG'}
                </button>
                <button
                  className="btn btn-amber"
                  onClick={() => handleExport('pdf')}
                  disabled={exporting}
                  style={{
                    padding: '10px 24px',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    borderRadius: '10px',
                    boxShadow: '0 4px 16px rgba(245,158,11,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {exporting ? 'Generating PDF…' : '📄 Download PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChainDetail;
