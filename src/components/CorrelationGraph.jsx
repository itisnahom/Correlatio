import React, { useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Area, AreaChart, ComposedChart, Line,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';

import { analyzePattern, calculatePearsonCorrelation } from '../utils/statistics';

/* ---- Animated scatter dot with glow ---- */
const Dot = (props) => {
  const { cx, cy, fill, index, payload, is3D, zMin, zMax } = props;
  const hasNote = !!payload?.note;
  
  let baseR = 6;
  if (is3D && payload?.z !== undefined) {
    const range = (zMax - zMin) || 1;
    const ratio = Math.max(0, Math.min(1, (payload.z - zMin) / range));
    baseR = 6 + (ratio * 12); // Scale between 6px and 18px
  }
  
  const glowR = hasNote ? baseR + 4 : baseR * 1.3;

  return (
    <g>
      <circle cx={cx} cy={cy} r={glowR} fill={hasNote ? 'var(--amber)' : fill} opacity={hasNote ? 0.2 : 0.08}>
        <animate attributeName="r" values={`${glowR};${glowR+6};${glowR}`} dur="3s" repeatCount="indefinite" begin={`${(index || 0) * 0.1}s`} />
      </circle>
      <circle cx={cx} cy={cy} r={baseR} fill={fill} opacity={0.9}>
        <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={baseR * 0.3} fill={hasNote ? 'var(--amber)' : "#faf8f3"} opacity={0.8} />
    </g>
  );
};

/* ---- Enhanced tooltips ---- */
const ScatterTip = ({ active, payload, chain }) => {
  if (!active || !payload?.length) return null;
  const pData = payload[0]?.payload || {};
  return (
    <div style={{
      background: 'rgba(9,9,11,0.95)', border: '1px solid rgba(255,252,245,0.12)',
      borderRadius: 12, padding: '12px 16px', fontSize: '0.8rem', lineHeight: 1.9,
      backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', maxWidth: '280px'
    }}>
      <div style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{chain?.variables[0].icon ?? '📊'}</span>
        {chain?.variables[0].name}: <strong style={{ color: '#faf8f3' }}>{payload[0]?.value} {chain?.variables[0].unit}</strong>
      </div>
      <div style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{chain?.variables[1].icon ?? '📈'}</span>
        {chain?.variables[1].name}: <strong style={{ color: '#faf8f3' }}>{payload[1]?.value} {chain?.variables[1].unit}</strong>
      </div>
      {chain?.variables[2] && payload[2] && (
        <div style={{ color: '#f43f5e', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{chain?.variables[2].icon ?? '🫧'}</span>
          {chain?.variables[2].name}: <strong style={{ color: '#faf8f3' }}>{payload[2]?.value} {chain?.variables[2].unit}</strong>
        </div>
      )}
      {pData.dateString && (
        <div style={{ color: 'rgba(255,252,245,0.3)', fontSize: '0.7rem', marginTop: 4, borderTop: '1px solid rgba(255,252,245,0.06)', paddingTop: 4 }}>
          {pData.dateString}
        </div>
      )}
      {pData.note && (
        <div style={{ color: 'var(--amber)', fontSize: '0.75rem', marginTop: 6, fontStyle: 'italic', lineHeight: 1.4 }}>
          "{pData.note}"
        </div>
      )}
    </div>
  );
};

const LineTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const pData = payload[0]?.payload || {};
  return (
    <div style={{
      background: 'rgba(9,9,11,0.95)', border: '1px solid rgba(255,252,245,0.12)',
      borderRadius: 12, padding: '12px 16px', fontSize: '0.8rem', lineHeight: 1.9,
      backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', maxWidth: '280px'
    }}>
      <div style={{ color: 'rgba(255,252,245,0.4)', marginBottom: 4, fontSize: '0.72rem' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, display: 'flex', alignItems: 'center', gap: 6 }}>
          {p.name}: <strong style={{ color: '#faf8f3' }}>{p.value}</strong>
        </div>
      ))}
      {pData.note && (
        <div style={{ color: 'var(--amber)', fontSize: '0.75rem', marginTop: 6, fontStyle: 'italic', lineHeight: 1.4, borderTop: '1px solid rgba(255,252,245,0.06)', paddingTop: 6 }}>
          "{pData.note}"
        </div>
      )}
    </div>
  );
};

/* ---- Axis styles ---- */
const axisStyle = { fill: '#555047', fontSize: 11, fontFamily: 'Inter, sans-serif' };
const gridStyle = { stroke: 'rgba(255,252,245,0.04)', strokeDasharray: '3 6' };
const axisLine = { stroke: 'rgba(255,252,245,0.06)' };
const boolTick = (v) => v === 1 ? 'Yes' : v === 0 ? 'No' : '';
const isBoolType = (v) => v?.typeId === 'boolean' || v?.unit === 'bool';

/* ---- Heatmap Component (built with CSS, no extra library) ---- */
const HeatMap = ({ logs, allVars, varColors }) => {
  const getLogValue = (log, index) => {
    return log.values[index];
  };

  const matrix = useMemo(() => {
    const result = [];
    for (let i = 0; i < allVars.length; i++) {
      const row = [];
      for (let j = 0; j < allVars.length; j++) {
        if (i === j) { row.push(1); continue; }
        const x = logs.map(l => getLogValue(l, i)).filter(v => v != null);
        const y = logs.map(l => getLogValue(l, j)).filter(v => v != null);
        const minLen = Math.min(x.length, y.length);
        row.push(calculatePearsonCorrelation(x.slice(0, minLen), y.slice(0, minLen)));
      }
      result.push(row);
    }
    return result;
  }, [logs, allVars]);

  const getCellColor = (r) => {
    if (r === null) return 'rgba(255,252,245,0.03)';
    if (r === 1) return 'rgba(255,252,245,0.08)';
    const a = Math.abs(r);
    if (r > 0) return `rgba(16, 185, 129, ${a * 0.5 + 0.05})`;
    return `rgba(244, 63, 94, ${a * 0.5 + 0.05})`;
  };

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `80px repeat(${allVars.length}, 1fr)`,
        gap: 3,
      }}>
        {/* Header row */}
        <div /> {/* empty corner */}
        {allVars.map((v, j) => (
          <div key={`h-${j}`} style={{
            textAlign: 'center', fontSize: '0.7rem', color: varColors?.[j] || 'var(--text-2)',
            padding: '6px 2px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {v.icon} {v.name}
          </div>
        ))}

        {/* Data rows */}
        {allVars.map((v, i) => (
          <React.Fragment key={`row-${i}`}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: '0.7rem', color: varColors?.[i] || 'var(--text-2)',
              fontWeight: 600, paddingRight: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {v.icon} {v.name}
            </div>
            {matrix[i]?.map((r, j) => (
              <div
                key={`cell-${i}-${j}`}
                className="heatmap-cell"
                style={{
                  background: getCellColor(r),
                  borderRadius: 8,
                  padding: '10px 4px',
                  textAlign: 'center',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  fontFamily: "'Space Grotesk', sans-serif",
                  color: i === j ? 'var(--text-3)' : r > 0.1 ? '#34d399' : r < -0.1 ? '#fb7185' : 'var(--text-3)',
                  cursor: i !== j ? 'pointer' : 'default',
                  transition: 'all 0.2s ease',
                  border: i === j ? '1px solid rgba(255,252,245,0.05)' : '1px solid transparent',
                  minHeight: 44,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                title={r !== null ? `r = ${r.toFixed(3)}` : 'N/A'}
              >
                {i === j ? '—' : r !== null ? r.toFixed(2) : '—'}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

const CorrelationGraph = ({ logs, chain, rValue, mode, allLogs, allVars, varColors }) => {
  const lineColor = rValue > 0.1 ? '#10b981' : rValue < -0.1 ? '#f43f5e' : '#a09b8c';

  const var0IsBool = isBoolType(chain?.variables?.[0]);
  const var1IsBool = isBoolType(chain?.variables?.[1]);

  /* ---- Scatter data + trend line; add jitter for boolean axes ---- */
  const scatterData = logs.map(l => ({
    x: var0IsBool ? l.values[0] + (Math.random() - 0.5) * 0.12 : l.values[0],
    y: var1IsBool ? l.values[1] + (Math.random() - 0.5) * 0.12 : l.values[1],
    z: l.values[2], dateString: l.dateString, note: l.note
  }));

  const xVals = scatterData.map(d => d.x);
  const yVals = scatterData.map(d => d.y);
  const zVals = scatterData.map(d => d.z).filter(v => v !== undefined && v !== null);
  
  const xMin = Math.min(...xVals), xMax = Math.max(...xVals);
  const zMin = zVals.length ? Math.min(...zVals) : 0;
  const zMax = zVals.length ? Math.max(...zVals) : 100;

  const pattern = analyzePattern(xVals, yVals);

  let trendData = [];
  if (pattern.type !== 'linear' && pattern.quad) {
    const step = (xMax - xMin) / 50;
    for (let x = xMin; x <= xMax; x += step) {
      trendData.push({ x, y: pattern.quad.a * (x * x) + pattern.quad.b * x + pattern.quad.c });
    }
  } else {
    const n = scatterData.length;
    const meanX = scatterData.reduce((s, d) => s + d.x, 0) / n;
    const meanY = scatterData.reduce((s, d) => s + d.y, 0) / n;
    const ssXX = scatterData.reduce((s, d) => s + (d.x - meanX) ** 2, 0);
    const ssXY = scatterData.reduce((s, d) => s + (d.x - meanX) * (d.y - meanY), 0);
    const slope = ssXX ? ssXY / ssXX : 0;
    const intercept = meanY - slope * meanX;
    trendData = [{ x: xMin, y: slope * xMin + intercept }, { x: xMax, y: slope * xMax + intercept }];
  }

  /* ---- HEATMAP MODE ---- */
  if (mode === 'heatmap') {
    const vars = [
      { name: chain?.variables[0].name, icon: chain?.variables[0].icon || '📊', unit: chain?.variables[0].unit },
      { name: chain?.variables[1].name, icon: chain?.variables[1].icon || '📈', unit: chain?.variables[1].unit }
    ];
    const heatLogs = allLogs || logs;
    return <HeatMap logs={heatLogs} allVars={vars} varColors={varColors} />;
  }

  /* ---- RADAR MODE (Distribution) ---- */
  if (mode === 'radar') {
    const radarVars = allVars || [
      { name: chain?.variables[0].name, icon: chain?.variables[0].icon },
      { name: chain?.variables[1].name, icon: chain?.variables[1].icon },
    ];
    const useLogs = allLogs || logs;
    
    const getVal = (log, idx) => {
      return log.values[idx];
    };

    const radarData = radarVars.map((v, vi) => {
      const vals = useLogs.map(l => getVal(l, vi)).filter(val => val != null);
      const max = Math.max(...vals, 1); // Avoid div by 0
      const avg = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
      return {
        subject: v.name,
        A: (avg / max) * 100, // Normalized to 0-100
        fullMark: 100,
        rawAvg: avg,
        unit: v.unit,
      };
    });

    const CustomRadarTip = ({ active, payload }) => {
      if (!active || !payload?.length) return null;
      const data = payload[0].payload;
      return (
        <div style={{
          background: 'rgba(9,9,11,0.95)', border: '1px solid rgba(255,252,245,0.12)',
          borderRadius: 12, padding: '12px 16px', fontSize: '0.8rem', color: '#faf8f3'
        }}>
          <strong>{data.subject}</strong>
          <div style={{ color: 'var(--amber)', marginTop: '4px' }}>
            Avg: {data.rawAvg.toFixed(1)} {data.unit}
          </div>
        </div>
      );
    };

    return (
      <ResponsiveContainer width="100%" height={340}>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <PolarGrid stroke="rgba(255,252,245,0.1)" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#a09b8c', fontSize: '0.75rem' }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <Tooltip content={<CustomRadarTip />} />
          <Radar name="Average (Normalized)" dataKey="A" stroke="var(--emerald)" fill="var(--emerald)" fillOpacity={0.3} />
        </RadarChart>
      </ResponsiveContainer>
    );
  }

  /* ---- TIMELINE MODE with all variables ---- */
  if (mode === 'timeline') {
    const timeVars = allVars || [
      { name: chain?.variables[0].name, icon: chain?.variables[0].icon },
      { name: chain?.variables[1].name, icon: chain?.variables[1].icon },
    ];
    const useLogs = allLogs || logs;
    const getVal = (log, idx) => {
      return log.values[idx];
    };

    const timelineData = useLogs.map((l, i) => {
      const entry = { day: l.dateString ?? `Day ${i + 1}` };
      timeVars.forEach((v, vi) => { entry[v.name] = getVal(l, vi); });
      return entry;
    });

    const colors = varColors || ['#f59e0b', '#10b981', '#f43f5e', '#38bdf8', '#a78bfa'];

    return (
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={timelineData} margin={{ top: 10, right: 14, bottom: 10, left: -10 }}>
          <defs>
            {timeVars.map((v, vi) => (
              <linearGradient key={vi} id={`tl-grad-${vi}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors[vi]} stopOpacity={0.25} />
                <stop offset="95%" stopColor={colors[vi]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey="day" tick={axisStyle} axisLine={axisLine} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={axisLine} tickLine={false} />
          <Tooltip content={<LineTip />} />
          <Legend
            formatter={(val) => <span style={{ color: '#a09b8c', fontSize: '0.78rem' }}>{val}</span>}
            wrapperStyle={{ paddingTop: 12 }}
          />
          {timeVars.map((v, vi) => {
            const isB = isBoolType(v);
            return (
              <Area
                key={vi}
                type={isB ? 'stepAfter' : 'monotone'}
                dataKey={v.name}
                stroke={colors[vi]}
                strokeWidth={isB ? 2.5 : 2}
                fill={`url(#tl-grad-${vi})`}
                dot={isB ? false : { fill: colors[vi], r: 3, strokeWidth: 0 }}
                animationDuration={800 + vi * 200}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  /* ---- SCATTER MODE (default) ---- */
  return (
    <div style={{ width: '100%', position: 'relative' }}>
      {/* Explicit Y-Axis Label Header */}
      <div style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', paddingLeft: '12px', marginBottom: '4px' }}>
        <span>{chain?.variables[1].icon ?? '📈'}</span> {chain?.variables[1].name} {chain?.variables[1].unit && <span style={{ opacity: 0.6 }}>({chain.variables[1].unit})</span>}
      </div>
      
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 10, right: 14, bottom: 22, left: -10 }}>
        <defs>
          <radialGradient id="scatter-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.15} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
          </radialGradient>
        </defs>
        <CartesianGrid {...gridStyle} />
        <XAxis
          type="number" dataKey="x" name={chain?.variables[0].name}
          tick={axisStyle} axisLine={axisLine} tickLine={false}
          tickFormatter={var0IsBool ? boolTick : undefined}
          ticks={var0IsBool ? [0, 1] : undefined}
          domain={var0IsBool ? [-0.3, 1.3] : ['auto', 'auto']}
          label={{ value: `${chain?.variables[0].icon ?? '📊'} ${chain?.variables[0].name}${var0IsBool ? '' : ` (${chain?.variables[0].unit || ''})`}`, position: 'insideBottom', offset: -14, fill: '#f59e0b', fontSize: 12 }}
        />
        <YAxis
          type="number" dataKey="y" name={chain?.variables[1].name}
          tick={axisStyle} axisLine={axisLine} tickLine={false}
          tickFormatter={var1IsBool ? boolTick : undefined}
          ticks={var1IsBool ? [0, 1] : undefined}
          domain={var1IsBool ? [-0.3, 1.3] : [0, 'auto']}
        />
        {chain?.variables[2] && (
          <ZAxis
            type="number" dataKey="z" name={chain.variables[2].name}
            range={[40, 600]} domain={[zMin, zMax]}
          />
        )}
        <Tooltip content={<ScatterTip chain={chain} />} cursor={false} />

        {/* Trend line with glow (hide if 3D bubble chart) */}
        {!chain?.var3Name && (
          <>
            <Scatter
              name="_trend" data={trendData}
              line={{ stroke: lineColor, strokeWidth: 2, strokeDasharray: '6 4', opacity: 0.6 }}
              shape={() => null} legendType="none"
            />
            {/* Trend line glow shadow */}
            <Scatter
              name="_trendglow" data={trendData}
              line={{ stroke: lineColor, strokeWidth: 6, opacity: 0.1 }}
              shape={() => null} legendType="none"
            />
          </>
        )}
        {/* Data points */}
        <Scatter
          name="Data" data={scatterData}
          shape={(props) => <Dot {...props} fill="#f59e0b" is3D={!!chain?.var3Name} zMin={zMin} zMax={zMax} />}
          animationDuration={1200}
        />
      </ScatterChart>
    </ResponsiveContainer>
    </div>
  );
};

export default CorrelationGraph;
