import React from 'react';
import { EXPORT_THEMES } from './ExportCard';
import CorrelationGraph from './CorrelationGraph';
import {
  interpretCorrelation,
  calculatePValue,
  significanceLabel,
  correlationCI,
  trendDirection,
  adherenceStats,
  computeImpactStatement,
} from '../utils/statistics';

const VAR_COLORS = ['#f59e0b', '#10b981', '#f43f5e', '#38bdf8', '#a78bfa'];

const ExportReport = React.forwardRef(({ chain, rValue, logs = [], themeId, user }, ref) => {
  const theme = EXPORT_THEMES.find(t => t.id === themeId) || EXPORT_THEMES[0];
  const absR = rValue !== null ? Math.abs(rValue) : 0;
  const vars = chain?.variables || [];
  const n = logs.length;

  const pVal = calculatePValue(rValue, n);
  const isSig = pVal !== null && pVal < 0.05;
  const ci = correlationCI(rValue, n);
  const rSquared = rValue !== null ? (rValue * rValue * 100).toFixed(1) : '0';
  const adh = adherenceStats(logs, 30);

  const xVals = logs.map(l => l.values?.[0]).filter(v => v != null);
  const yVals = logs.map(l => l.values?.[1]).filter(v => v != null);

  const impact = computeImpactStatement(
    xVals,
    yVals,
    vars[0]?.name || 'Var A',
    vars[1]?.name || 'Var B',
    vars[1]?.unit || ''
  );

  const interpretation = interpretCorrelation(rValue, vars[0]?.name, vars[1]?.name);
  const firstName = user?.displayName?.split(' ')[0] || user?.displayName || 'User';

  return (
    <div
      ref={ref}
      style={{
        width: '850px',
        minHeight: '1100px',
        background: '#09090b',
        color: '#faf8f3',
        padding: '48px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        boxSizing: 'border-box',
        position: 'relative',
        borderRadius: '20px',
        overflow: 'hidden',
        border: '1px solid rgba(255,252,245,0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '28px',
      }}
    >
      {/* Background ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: '-120px',
          right: '-120px',
          width: '450px',
          height: '450px',
          background: theme.bg,
          opacity: 0.18,
          borderRadius: '50%',
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />

      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,252,245,0.1)', paddingBottom: '20px', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))',
            border: '1px solid rgba(245,158,11,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
          }}>
            ⚛
          </div>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#faf8f3' }}>
              Correlatio<span style={{ color: 'var(--amber)' }}>.</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#a09b8c', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Executive Correlation Report
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid rgba(255,252,245,0.2)', objectFit: 'cover' }}
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,252,245,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
              👤
            </div>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#faf8f3' }}>{firstName}</div>
            <div style={{ fontSize: '0.75rem', color: '#a09b8c' }}>
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* Hero Correlation Feature Banner */}
      <div
        style={{
          background: theme.bg,
          color: theme.color,
          borderRadius: '20px',
          padding: '32px 36px',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
          zIndex: 2,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 3 }}>
          <div>
            <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.85, fontWeight: 700, marginBottom: '6px' }}>
              HABIT THREAD ANALYSIS
            </div>
            <h2 style={{ margin: '0 0 12px', fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
              {chain.name}
            </h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {vars.map((v, vi) => (
                <span key={vi} style={{
                  background: 'rgba(0,0,0,0.25)',
                  backdropFilter: 'blur(8px)',
                  padding: '5px 12px',
                  borderRadius: '99px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}>
                  <span>{v.icon}</span> {v.name} {v.unit ? `(${v.unit})` : ''}
                </span>
              ))}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '4.2rem', fontWeight: 900, lineHeight: '1em', letterSpacing: '-0.03em' }}>
              {absR.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.9 }}>
              PEARSON |r| SCORE
            </div>
          </div>
        </div>

        <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid rgba(255,255,255,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 3 }}>
          <div style={{ fontSize: '1rem', fontWeight: 700 }}>
            {interpretation}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {pVal !== null && (
              <span style={{
                background: isSig ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.3)',
                padding: '4px 12px',
                borderRadius: '99px',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}>
                {isSig ? '🔬 Statistically Significant' : '⚠️ Preliminary Data'}
              </span>
            )}
            <span style={{
              background: 'rgba(0,0,0,0.3)',
              padding: '4px 12px',
              borderRadius: '99px',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}>
              {n} Data Entries
            </span>
          </div>
        </div>
      </div>

      {/* Key Statistical Metrics Grid */}
      <div style={{ display: 'flex', gap: '14px', zIndex: 2 }}>
        <div style={{ flex: 1, background: 'rgba(255,252,245,0.03)', border: '1px solid rgba(255,252,245,0.08)', borderRadius: '14px', padding: '16px' }}>
          <div style={{ fontSize: '0.7rem', color: '#a09b8c', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>R² Variance</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#faf8f3' }}>{rSquared}%</div>
          <div style={{ fontSize: '0.65rem', color: '#a09b8c', marginTop: '2px' }}>Variation explained</div>
        </div>

        <div style={{ flex: 1, background: 'rgba(255,252,245,0.03)', border: '1px solid rgba(255,252,245,0.08)', borderRadius: '14px', padding: '16px' }}>
          <div style={{ fontSize: '0.7rem', color: '#a09b8c', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Significance</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: isSig ? '#10b981' : '#a09b8c' }}>
            {pVal !== null ? (pVal < 0.01 ? 'p < 0.01' : pVal < 0.05 ? 'p < 0.05' : 'p > 0.05') : '—'}
          </div>
          <div style={{ fontSize: '0.65rem', color: '#a09b8c', marginTop: '2px' }}>{isSig ? 'Reliable signal' : 'Requires more logs'}</div>
        </div>

        <div style={{ flex: 1, background: 'rgba(255,252,245,0.03)', border: '1px solid rgba(255,252,245,0.08)', borderRadius: '14px', padding: '16px' }}>
          <div style={{ fontSize: '0.7rem', color: '#a09b8c', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Confidence (95%)</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#faf8f3', marginTop: '4px' }}>
            {ci ? `[${ci.lower.toFixed(2)}, ${ci.upper.toFixed(2)}]` : '—'}
          </div>
          <div style={{ fontSize: '0.65rem', color: '#a09b8c', marginTop: '4px' }}>Fisher z-transformed</div>
        </div>

        <div style={{ flex: 1, background: 'rgba(255,252,245,0.03)', border: '1px solid rgba(255,252,245,0.08)', borderRadius: '14px', padding: '16px' }}>
          <div style={{ fontSize: '0.7rem', color: '#a09b8c', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Consistency</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b' }}>
            {(adh.adherence * 100).toFixed(0)}%
          </div>
          <div style={{ fontSize: '0.65rem', color: '#a09b8c', marginTop: '2px' }}>Streak: {adh.currentStreak} days (Best: {adh.longestStreak})</div>
        </div>
      </div>

      {/* Impact Statement Callout */}
      {impact && (
        <div style={{
          background: 'rgba(245,158,11,0.06)',
          border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: '14px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          zIndex: 2,
        }}>
          <div style={{ fontSize: '24px' }}>💡</div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Actionable Behavioral Insight
            </div>
            <div style={{ fontSize: '0.92rem', color: '#faf8f3', fontWeight: 500, marginTop: '2px', lineHeight: 1.5 }}>
              {impact}
            </div>
          </div>
        </div>
      )}

      {/* Visualizations */}
      <div style={{ zIndex: 2, display: 'flex', gap: '20px' }}>
        <div style={{ flex: 1, background: 'rgba(255,252,245,0.02)', border: '1px solid rgba(255,252,245,0.08)', borderRadius: '16px', padding: '16px', overflow: 'hidden' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a09b8c', marginBottom: '10px' }}>
            Correlation Plot
          </div>
          <div style={{ width: '100%', height: '320px' }}>
            <CorrelationGraph logs={logs} chain={chain} rValue={rValue} mode="scatter" isExport={true} />
          </div>
        </div>
        <div style={{ flex: 1, background: 'rgba(255,252,245,0.02)', border: '1px solid rgba(255,252,245,0.08)', borderRadius: '16px', padding: '16px', overflow: 'hidden' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a09b8c', marginBottom: '10px' }}>
            Timeline Trends
          </div>
          <div style={{ width: '100%', height: '320px' }}>
            <CorrelationGraph logs={logs} chain={chain} rValue={rValue} mode="timeline" isExport={true} />
          </div>
        </div>
      </div>

      {/* Variables Baseline Metrics */}
      <div style={{ zIndex: 2 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a09b8c', marginBottom: '10px' }}>
          Variable Baselines
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {vars.map((v, vi) => {
            const vals = logs.map(l => l.values?.[vi]).filter(x => x != null);
            const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
            const min = vals.length ? Math.min(...vals) : 0;
            const max = vals.length ? Math.max(...vals) : 0;
            const isBool = v.typeId === 'boolean' || v.unit === 'bool';
            const yesCount = isBool ? vals.filter(x => x === 1).length : 0;
            const trend = isBool ? null : trendDirection(vals);
            const trendIcon = trend === 'up' ? '↑ Rising' : trend === 'down' ? '↓ Falling' : '→ Steady';

            return (
              <div key={vi} style={{
                flex: 1,
                background: 'rgba(255,252,245,0.025)',
                border: `1px solid ${VAR_COLORS[vi]}33`,
                borderRadius: '12px',
                padding: '14px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: VAR_COLORS[vi] }}>
                    {v.icon} {v.name}
                  </span>
                  {!isBool && (
                    <span style={{ fontSize: '0.72rem', color: trend === 'up' ? '#10b981' : trend === 'down' ? '#f43f5e' : '#a09b8c', fontWeight: 600 }}>
                      {trendIcon}
                    </span>
                  )}
                </div>

                {isBool ? (
                  <div style={{ fontSize: '0.82rem', color: '#faf8f3' }}>
                    <strong>{yesCount}</strong> Yes / <strong>{vals.length - yesCount}</strong> No
                    <div style={{ fontSize: '0.7rem', color: '#a09b8c', marginTop: '4px' }}>
                      {((yesCount / (vals.length || 1)) * 100).toFixed(0)}% positive completion
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#faf8f3' }}>
                      {avg.toFixed(1)} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#a09b8c' }}>{v.unit} avg</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.72rem', color: '#a09b8c' }}>
                      <span>Min: <strong style={{ color: '#faf8f3' }}>{min.toFixed(1)}</strong></span>
                      <span>Max: <strong style={{ color: '#faf8f3' }}>{max.toFixed(1)}</strong></span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Data Entries Table */}
      {logs.length > 0 && (
        <div style={{ zIndex: 2 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a09b8c', marginBottom: '10px' }}>
            Recent Data Log (Last {Math.min(logs.length, 6)} entries)
          </div>
          <div style={{ background: 'rgba(255,252,245,0.02)', border: '1px solid rgba(255,252,245,0.08)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255,252,245,0.04)', borderBottom: '1px solid rgba(255,252,245,0.08)' }}>
                  <th style={{ padding: '10px 14px', color: '#a09b8c', fontWeight: 600 }}>Date</th>
                  {vars.map((v, vi) => (
                    <th key={vi} style={{ padding: '10px 14px', color: VAR_COLORS[vi], fontWeight: 600 }}>
                      {v.icon} {v.name}
                    </th>
                  ))}
                  <th style={{ padding: '10px 14px', color: '#a09b8c', fontWeight: 600 }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice().reverse().slice(0, 6).map((log, li) => (
                  <tr key={log.id || li} style={{ borderBottom: li !== 5 ? '1px solid rgba(255,252,245,0.04)' : 'none' }}>
                    <td style={{ padding: '9px 14px', color: '#a09b8c' }}>{log.dateString || `Entry ${li + 1}`}</td>
                    {vars.map((v, vi) => (
                      <td key={vi} style={{ padding: '9px 14px', fontWeight: 600, color: '#faf8f3' }}>
                        {log.values?.[vi] !== undefined ? log.values[vi] : '—'} {v.unit && log.values?.[vi] !== undefined ? v.unit : ''}
                      </td>
                    ))}
                    <td style={{ padding: '9px 14px', color: '#a09b8c', fontStyle: 'italic', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.note ? `"${log.note}"` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Branded Footer */}
      <div style={{ marginTop: 'auto', paddingTop: '18px', borderTop: '1px solid rgba(255,252,245,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: '#555047', zIndex: 2 }}>
        <div>
          Confidential Personal Analytics · Generated with <strong>Correlatio.</strong>
        </div>
        <div>
          Scientific Pearson Correlation & Habit Tracking Platform
        </div>
      </div>
    </div>
  );
});

export default ExportReport;
