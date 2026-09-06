import React, { useState } from 'react';
import {
  interpretCorrelation, analyzePattern,
  calculatePValue, significanceLabel, correlationCI,
  calculateLaggedCorrelations, bestLag,
  rollingAverage, dayOfWeekBreakdown, adherenceStats,
  trendDirection, computeImpactStatement,
} from '../utils/statistics';
import { generateAiInsight } from '../utils/ai';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';

const VAR_COLORS = ['#f59e0b', '#10b981', '#f43f5e', '#38bdf8', '#a78bfa'];

const TABS = ['Stats', 'Time Patterns', 'Lag Analysis'];

// ─── Mini Components ──────────────────────────────────────────────────────────

const StatCell = ({ label, value, color, sub }) => (
  <div className="stat-cell">
    <div className="stat-cell-label">{label}</div>
    <div className="stat-cell-val" style={{ color: color || 'var(--text-1)' }}>{value}</div>
    {sub && <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', marginTop: 2 }}>{sub}</div>}
  </div>
);

const SigBadge = ({ p }) => {
  if (p === null) return null;
  const sig = p < 0.05;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: '0.7rem', fontWeight: 600, padding: '3px 10px',
      borderRadius: 99, marginLeft: 8,
      background: sig ? 'rgba(16,185,129,0.1)' : 'rgba(160,155,140,0.1)',
      border: `1px solid ${sig ? 'rgba(16,185,129,0.3)' : 'rgba(160,155,140,0.2)'}`,
      color: sig ? 'var(--emerald)' : 'var(--text-3)',
    }}>
      {sig ? '🔬 Significant' : '⚠️ More data needed'}
    </span>
  );
};

// ─── Tab A: Stats ─────────────────────────────────────────────────────────────

const StatsTab = ({ rValue, n, chain, pattern, selectedPair }) => {
  const isNull = rValue === null || isNaN(rValue);
  const absR = isNull ? 0 : Math.abs(rValue);
  const isCurved = pattern.type !== 'linear';
  const rSquared = isNull ? 0 : (isCurved && pattern.quad)
    ? pattern.quad.rSquared : rValue * rValue;

  const pVal = calculatePValue(rValue, n);
  const ci = correlationCI(rValue, n);

  const rClass = isNull ? 'none' : rValue > 0.1 ? 'pos' : rValue < -0.1 ? 'neg' : 'none';
  const rColor = rClass === 'pos' ? 'var(--corr-pos-text)' : rClass === 'neg' ? 'var(--corr-neg-text)' : 'var(--text-2)';
  const barGrad = rClass === 'pos'
    ? 'linear-gradient(90deg, #10b981, #34d399)'
    : rClass === 'neg' ? 'linear-gradient(90deg, #f43f5e, #fb7185)' : 'var(--border-bright)';

  const varA = chain?.variables?.[selectedPair?.[0]]?.name ?? 'Variable A';
  const varB = chain?.variables?.[selectedPair?.[1]]?.name ?? 'Variable B';

  const getInsight = () => {
    if (isNull) return 'Not enough variation to compute statistics.';
    if (isCurved) return `Fascinating! A ${pattern.type === 'u-shaped' ? 'U-shaped (biphasic)' : 'inverted U-shaped'} curve — ${varA} affects ${varB} differently at low vs. high values.`;
    if (absR >= 0.8) return `An exceptionally tight relationship. ${varA} explains ${(rSquared * 100).toFixed(1)}% of the variance in ${varB}.`;
    if (absR >= 0.5) return `A meaningful signal. ${varA} noticeably predicts ${varB}, though other factors also matter.`;
    if (absR >= 0.3) return `A weak but real pattern. More data will clarify whether ${varA} genuinely affects ${varB}.`;
    return `No clear linear relationship yet. These may be independent, or you may need more data.`;
  };

  // Data quality score (0–100) based on sample size and variance
  const qualityScore = Math.min(100, Math.round((Math.min(n, 30) / 30) * 70 + (absR > 0 ? 30 : 0)));

  const stats = [
    { label: isCurved ? 'Curve Type' : "Pearson's r", value: isCurved ? (pattern.type === 'u-shaped' ? 'U-Shape' : 'Inverted U') : (isNull ? '—' : (rValue > 0 ? '+' : '') + rValue.toFixed(4)), color: isCurved ? 'var(--amber)' : rColor },
    { label: 'R² (variance explained)', value: isNull ? '—' : (rSquared * 100).toFixed(1) + '%', color: 'var(--text-1)' },
    { label: 'Sample size n', value: n, color: 'var(--text-1)', sub: n < 10 ? 'Low — collect more data' : n < 20 ? 'Getting reliable' : 'Good sample' },
    { label: 'Strength', value: absR >= 0.8 ? 'Strong' : absR >= 0.5 ? 'Moderate' : absR >= 0.3 ? 'Weak' : 'Very weak', color: 'var(--text-1)' },
    { label: 'Direction', value: isCurved ? 'Non-linear' : (isNull || absR < 0.1 ? 'None' : rValue > 0 ? 'Positive ↗' : 'Negative ↘'), color: isCurved ? 'var(--amber)' : rColor },
    { label: 'Unexplained variance', value: isNull ? '—' : ((1 - rSquared) * 100).toFixed(1) + '%', color: 'var(--text-1)' },
  ];

  return (
    <div>
      {/* Stats grid */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        {stats.map(s => <StatCell key={s.label} {...s} />)}
      </div>

      {/* Strength bar */}
      {!isNull && (
        <div className="stat-bar-wrap">
          <div className="stat-bar-label" style={{ display: 'flex', alignItems: 'center' }}>
            Correlation strength: <strong style={{ color: 'var(--text-1)', marginLeft: 4 }}>{(absR * 100).toFixed(0)}%</strong>
            <SigBadge p={pVal} />
          </div>
          <div className="stat-bar-track">
            <div className="stat-bar-fill" style={{ width: `${absR * 100}%`, background: barGrad }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-3)', marginTop: 5 }}>
            <span>No correlation (r = 0)</span>
            <span>Perfect (r = ±1)</span>
          </div>
        </div>
      )}

      {/* P-value & CI */}
      {!isNull && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
          <div style={{ flex: 1, minWidth: 140, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginBottom: 4 }}>P-value (2-tailed)</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: pVal !== null && pVal < 0.05 ? 'var(--emerald)' : 'var(--text-2)' }}>
              {pVal !== null ? significanceLabel(pVal) : '—'}
            </div>
          </div>
          {ci && (
            <div style={{ flex: 1, minWidth: 140, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginBottom: 4 }}>95% Confidence Interval</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-1)' }}>
                [{ci.lower > 0 ? '+' : ''}{ci.lower.toFixed(2)}, {ci.upper > 0 ? '+' : ''}{ci.upper.toFixed(2)}]
              </div>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 140, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginBottom: 6 }}>Data quality</div>
            <div style={{ background: 'var(--border)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
              <div style={{ width: `${qualityScore}%`, height: '100%', background: qualityScore > 70 ? '#10b981' : qualityScore > 40 ? '#f59e0b' : '#f43f5e', borderRadius: 99, transition: 'width 0.8s ease' }} />
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: 4 }}>{qualityScore}% — {qualityScore > 70 ? 'Reliable' : qualityScore > 40 ? 'Building up' : 'Need more data'}</div>
          </div>
        </div>
      )}

      {/* Insight text */}
      <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 10, fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.6 }}>
        💡 {getInsight()}
      </div>
    </div>
  );
};

// ─── Tab B: Time Patterns ─────────────────────────────────────────────────────

const TimePatternsTab = ({ logs, chain, selectedPair }) => {
  const vars = chain?.variables ?? [];
  const adh = adherenceStats(logs, 30);

  const selectedIdx = selectedPair?.[0] ?? 0;
  const selectedVar = vars[selectedIdx];
  const [focusVar, setFocusVar] = useState(selectedIdx);

  const dowData = dayOfWeekBreakdown(logs, focusVar);
  const vals = logs.map(l => l.values?.[focusVar]).filter(v => v != null);
  const trend = trendDirection(vals);
  const rolling7 = rollingAverage(vals, 7);
  const recentAvg = rolling7[rolling7.length - 1];
  const prevRolling = rollingAverage(vals, 14);
  const prevAvg = prevRolling[Math.max(0, prevRolling.length - 8)];
  const avgChange = recentAvg && prevAvg ? ((recentAvg - prevAvg) / Math.abs(prevAvg) * 100) : 0;

  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const trendColor = trend === 'up' ? 'var(--emerald)' : trend === 'down' ? 'var(--rose)' : 'var(--text-3)';

  const dowMax = Math.max(...dowData.map(d => d.avg ?? 0));

  return (
    <div>
      {/* Adherence */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 120, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginBottom: 2 }}>30-day adherence</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: adh.adherence > 0.8 ? 'var(--emerald)' : adh.adherence > 0.5 ? 'var(--amber)' : 'var(--rose)' }}>
            {(adh.adherence * 100).toFixed(0)}%
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>{adh.loggedDays}/{adh.totalDays} days logged</div>
        </div>
        <div style={{ flex: 1, minWidth: 120, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginBottom: 2 }}>Current streak</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--amber)' }}>{adh.currentStreak} <span style={{ fontSize: '0.9rem' }}>days</span></div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>Best: {adh.longestStreak} days</div>
        </div>
        <div style={{ flex: 1, minWidth: 120, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginBottom: 2 }}>7-day trend</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: trendColor }}>{trendIcon} {recentAvg ? recentAvg.toFixed(1) : '—'}</div>
          <div style={{ fontSize: '0.65rem', color: trendColor }}>{avgChange > 0 ? '+' : ''}{avgChange.toFixed(1)}% vs prev period</div>
        </div>
      </div>

      {/* Variable selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', alignSelf: 'center' }}>Day pattern for:</span>
        {vars.map((v, vi) => (
          <button key={vi} onClick={() => setFocusVar(vi)} style={{
            padding: '4px 10px', borderRadius: 99, border: `1px solid ${focusVar === vi ? VAR_COLORS[vi] : 'var(--border)'}`,
            background: focusVar === vi ? `${VAR_COLORS[vi]}18` : 'transparent',
            color: focusVar === vi ? VAR_COLORS[vi] : 'var(--text-3)',
            fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
          }}>
            {v.icon} {v.name}
          </button>
        ))}
      </div>

      {/* Day-of-week bar chart */}
      <div style={{ height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dowData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <XAxis dataKey="day" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              formatter={(v) => [v != null ? v.toFixed(2) : 'No data', vars[focusVar]?.name]}
            />
            <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
              {dowData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.avg === dowMax && entry.avg != null ? VAR_COLORS[focusVar] : 'rgba(255,252,245,0.08)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', textAlign: 'center', marginTop: 4 }}>
        Highlighted bar = highest average day. Grey = no data for that day.
      </div>
    </div>
  );
};

// ─── Tab C: Lag Analysis ──────────────────────────────────────────────────────

const LagTab = ({ logs, chain, selectedPair }) => {
  const vars = chain?.variables ?? [];
  const varA = vars[selectedPair?.[0]];
  const varB = vars[selectedPair?.[1]];

  const x = logs.map(l => l.values?.[selectedPair?.[0]]).filter(v => v != null);
  const y = logs.map(l => l.values?.[selectedPair?.[1]]).filter(v => v != null);
  const minLen = Math.min(x.length, y.length);

  const lagResults = calculateLaggedCorrelations(x.slice(0, minLen), y.slice(0, minLen), 4);
  const best = bestLag(lagResults);

  if (lagResults.length === 0 || x.length < 5) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-3)', fontSize: '0.85rem' }}>
        Need at least 5 paired data points for lag analysis.
      </div>
    );
  }

  const maxAbsR = Math.max(...lagResults.map(l => Math.abs(l.r ?? 0)));

  return (
    <div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginBottom: 16, lineHeight: 1.6 }}>
        Does <strong style={{ color: VAR_COLORS[0] }}>{varA?.name}</strong> today predict <strong style={{ color: VAR_COLORS[1] }}>{varB?.name}</strong> in 1–4 days? Lag analysis shifts the data to find the strongest delayed effect.
      </div>

      {/* Lag bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lagResults.map(({ lag, r }) => {
          const absR = r !== null ? Math.abs(r) : 0;
          const isBest = best && lag === best.lag;
          const barColor = r !== null && r > 0 ? '#10b981' : '#f43f5e';
          return (
            <div key={lag} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 56, fontSize: '0.72rem', fontWeight: isBest ? 700 : 400,
                color: isBest ? 'var(--amber)' : 'var(--text-3)', flexShrink: 0,
              }}>
                {lag === 0 ? 'Same day' : `+${lag} day${lag > 1 ? 's' : ''}`}
                {isBest && <span style={{ marginLeft: 4 }}>⭐</span>}
              </div>
              <div style={{ flex: 1, background: 'var(--border)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                <div style={{
                  width: `${maxAbsR > 0 ? (absR / maxAbsR) * 100 : 0}%`, height: '100%',
                  background: isBest ? 'var(--amber)' : barColor,
                  borderRadius: 99, transition: 'width 0.8s ease',
                }} />
              </div>
              <div style={{ width: 48, fontSize: '0.75rem', fontWeight: 600, color: isBest ? 'var(--amber)' : 'var(--text-2)', textAlign: 'right' }}>
                {r !== null ? (r > 0 ? '+' : '') + r.toFixed(3) : '—'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Best lag callout */}
      {best && best.lag > 0 && Math.abs(best.r ?? 0) > Math.abs(lagResults[0]?.r ?? 0) + 0.05 && (
        <div style={{ marginTop: 18, padding: '12px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.6 }}>
          ⚡ <strong style={{ color: 'var(--amber)' }}>Delayed effect detected!</strong> {varA?.name} today correlates more strongly with {varB?.name} {best.lag} day{best.lag > 1 ? 's' : ''} later (r = {(best.r > 0 ? '+' : '') + best.r.toFixed(3)}) than on the same day (r = {(lagResults[0].r > 0 ? '+' : '') + lagResults[0].r.toFixed(3)}).
        </div>
      )}
      {best && best.lag === 0 && (
        <div style={{ marginTop: 18, padding: '12px 14px', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 10, fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.6 }}>
          ✅ Same-day correlation is the strongest. {varA?.name} and {varB?.name} appear to move together <strong>immediately</strong>, with no meaningful delay.
        </div>
      )}
    </div>
  );
};

// ─── AI Section ───────────────────────────────────────────────────────────────

const AiSection = ({ chain, logs }) => {
  const [aiInsight, setAiInsight] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const handleAskAI = async () => {
    setAiLoading(true);
    try {
      const insight = await generateAiInsight(chain, logs);
      setAiInsight(insight);
    } catch (e) {
      setAiInsight('Failed to reach AI. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-1)' }}>✨ AI Recommendations</div>
        {!aiInsight && !aiLoading && (
          <button className="btn btn-amber" style={{ padding: '6px 14px', fontSize: '0.75rem' }} onClick={handleAskAI}>
            Ask AI
          </button>
        )}
      </div>
      {aiLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.8rem', color: 'var(--text-2)' }}>
          <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Analyzing your data...
        </div>
      )}
      {aiInsight && !aiLoading && (
        <div className="insight-card fade-in" style={{ background: 'rgba(56,189,248,0.05)', borderColor: 'rgba(56,189,248,0.2)', color: 'var(--text-1)' }}>
          <div style={{ marginBottom: 12, fontSize: '1.2rem' }}>🤖 <strong>Gemini says:</strong></div>
          {aiInsight.split('\n\n').map((para, i) => (
            <p key={i} style={{ marginBottom: 12, lineHeight: 1.6, fontSize: '0.9rem' }}>
              {para.split(/(\*\*.*?\*\*)/).map((part, j) =>
                part.startsWith('**') && part.endsWith('**')
                  ? <strong key={j} style={{ color: 'var(--emerald)' }}>{part.slice(2, -2)}</strong>
                  : part
              )}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const NerdModeStats = ({ rValue, n, chain, logs, selectedPair = [0, 1], isExport = false, isAllThree = false }) => {
  const [activeTab, setActiveTab] = useState(0);

  let xVals = [], yVals = [];
  if (logs) {
    xVals = logs.map(l => l.values[selectedPair[0]]);
    yVals = logs.map(l => l.values[selectedPair[1]]);
  }
  const pattern = logs ? analyzePattern(xVals, yVals) : { type: 'linear', linearR: rValue };

  if (isExport) {
    return (
      <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
        {!isAllThree && (
          <div style={{ padding: '20px', background: 'rgba(255,252,245,0.02)', border: '1px solid rgba(255,252,245,0.08)', borderRadius: '16px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f59e0b', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ⚛ Statistical Breakdown
            </div>
            <StatsTab rValue={rValue} n={n} chain={chain} pattern={pattern} selectedPair={selectedPair} />
          </div>
        )}
        <div style={{ padding: '20px', background: 'rgba(255,252,245,0.02)', border: '1px solid rgba(255,252,245,0.08)', borderRadius: '16px' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f59e0b', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📅 Time Patterns
          </div>
          <TimePatternsTab logs={logs} chain={chain} selectedPair={selectedPair} />
        </div>
        <div style={{ padding: '20px', background: 'rgba(255,252,245,0.02)', border: '1px solid rgba(255,252,245,0.08)', borderRadius: '16px' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f59e0b', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ⏳ Lag Analysis
          </div>
          <LagTab logs={logs} chain={chain} selectedPair={selectedPair} />
        </div>
      </div>
    );
  }

  return (
    <div className="card nerd-panel">
      <div className="nerd-header">
        <span>⚛</span>
        <span>Statistical Breakdown</span>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)} style={{
            padding: '7px 14px', fontSize: '0.78rem', fontWeight: 600,
            borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
            background: activeTab === i ? 'var(--surface)' : 'transparent',
            color: activeTab === i ? 'var(--text-1)' : 'var(--text-3)',
            borderBottom: activeTab === i ? '2px solid var(--amber)' : '2px solid transparent',
            transition: 'all 0.2s',
          }}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 0 && <StatsTab rValue={rValue} n={n} chain={chain} pattern={pattern} selectedPair={selectedPair} />}
      {activeTab === 1 && <TimePatternsTab logs={logs} chain={chain} selectedPair={selectedPair} />}
      {activeTab === 2 && <LagTab logs={logs} chain={chain} selectedPair={selectedPair} />}

      <AiSection chain={chain} logs={logs} />
    </div>
  );
};

export default NerdModeStats;
