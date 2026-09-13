import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { calculatePearsonCorrelation } from '../utils/statistics';

const Basket = ({ user }) => {
  const navigate = useNavigate();
  const [threads, setThreads] = useState([]);
  const [allLogs, setAllLogs] = useState({});
  const [loading, setLoading] = useState(true);

  // Drag and drop state
  const [basketEggs, setBasketEggs] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const snap = await getDocs(collection(db, `users/${user.uid}/chains`));
      const fetched = [];
      snap.forEach(d => fetched.push({ id: d.id, ...d.data() }));
      setThreads(fetched);

      const logsMap = {};
      for (const ch of fetched) {
        const logsSnap = await getDocs(collection(db, `users/${user.uid}/chains/${ch.id}/logs`));
        const logs = [];
        logsSnap.forEach(d => {
          const log = normalizeLog({ id: d.id, ...d.data() });
          logs.push(log);
        });
        logsMap[ch.id] = logs;
      }
      setAllLogs(logsMap);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

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

  const getLogValue = (log, index) => {
    return log.values[index];
  };

  // Extract all unique variables (eggs)
  const eggs = useMemo(() => {
    const map = new Map();
    threads.forEach(ch => {
      const chNormalized = normalizeThread(ch);
      const vars = chNormalized.variables;
      vars.forEach((v, index) => {
        const key = v.name?.toLowerCase();
        if (key && !map.has(key)) {
          map.set(key, { ...v, sources: [{ threadId: ch.id, threadName: ch.name, index }] });
        } else if (key) {
          map.get(key).sources.push({ threadId: ch.id, threadName: ch.name, index });
        }
      });
    });
    return Array.from(map.values());
  }, [threads]);

  // Drag and Drop handlers
  const handleDragStart = (e, egg) => {
    e.dataTransfer.setData('application/json', JSON.stringify(egg));
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const data = e.dataTransfer.getData('application/json');
    if (data) {
      const egg = JSON.parse(data);
      if (!basketEggs.find(e => e.name === egg.name)) {
        setBasketEggs(prev => [...prev, egg]);
      }
    }
  };

  const clearBasket = () => setBasketEggs([]);

  // Compute relations for basket items
  const basketResult = useMemo(() => {
    if (basketEggs.length < 2) return null;

    // 1. Gather all data points for these eggs keyed by Date
    const dateMap = {}; // { '2023-10-01': { 'Sleep': 8, 'Focus': 4 } }
    
    basketEggs.forEach(egg => {
      egg.sources.forEach(src => {
        const logs = allLogs[src.threadId] || [];
        logs.forEach(log => {
          if (!log.dateString) return;
          const val = getLogValue(log, src.index);
          if (val !== null) {
            if (!dateMap[log.dateString]) dateMap[log.dateString] = {};
            if (dateMap[log.dateString][egg.name] === undefined) {
              dateMap[log.dateString][egg.name] = val;
            }
          }
        });
      });
    });

    // 2. Find intersecting dates
    const validDates = Object.keys(dateMap).filter(date => 
      basketEggs.every(egg => dateMap[date][egg.name] !== undefined)
    ).sort();

    if (validDates.length >= 3) {
      // Calculate matrix
      const matrix = [];
      for (let i = 0; i < basketEggs.length; i++) {
        for (let j = i + 1; j < basketEggs.length; j++) {
          const eggA = basketEggs[i];
          const eggB = basketEggs[j];
          const xData = validDates.map(d => dateMap[d][eggA.name]);
          const yData = validDates.map(d => dateMap[d][eggB.name]);
          const r = calculatePearsonCorrelation(xData, yData);
          matrix.push({ eggA, eggB, r });
        }
      }
      return { type: 'found', count: validDates.length, matrix, validDates, dateMap };
    } else {
      return { type: 'suggest', count: validDates.length, validDates, dateMap };
    }
  }, [basketEggs, allLogs]);

  const getStrengthColor = (r) => {
    if (r === null) return 'var(--text-3)';
    const a = Math.abs(r);
    if (a >= 0.6) return r > 0 ? 'var(--emerald)' : 'var(--rose)';
    if (a >= 0.3) return r > 0 ? 'var(--corr-pos-text)' : 'var(--corr-neg-text)';
    return 'var(--text-3)';
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /><span>Gathering your habits…</span></div>;

  return (
    <div className="basket-page fade-up">
      {/* Interactive Dropzone Hero */}
      <div 
        className={`basket-hero dropzone ${isDragOver ? 'drag-over' : ''} ${basketEggs.length > 0 ? 'has-items' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          position: 'relative',
          padding: '60px 20px',
          textAlign: 'center',
          background: 'var(--bg-2)',
          borderRadius: '24px',
          border: isDragOver ? '2px dashed var(--emerald)' : '2px dashed var(--border)',
          transition: 'all 0.3s ease',
          marginBottom: '40px',
          overflow: 'hidden'
        }}
      >
        <div style={{ position: 'relative', zIndex: 2 }}>
          <img src="/basket.svg" alt="Basket" style={{ width: '120px', height: '120px', objectFit: 'contain', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))' }} />
          <h1 className="basket-title" style={{ marginTop: '16px' }}>The Basket</h1>
          
          {basketEggs.length === 0 ? (
            <p className="basket-subtitle">Drag and drop habits (eggs) here to discover their hidden connections.</p>
          ) : (
            <div style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {basketEggs.map((egg, i) => (
                  <div key={i} className="egg-card slide-in-bottom" style={{ width: 'auto', padding: '8px 16px', background: 'rgba(255,255,255,0.1)' }}>
                    {egg.icon} {egg.name}
                  </div>
                ))}
              </div>
              <button className="btn btn-ghost" style={{ marginTop: '16px', fontSize: '0.8rem' }} onClick={clearBasket}>Clear Basket</button>
            </div>
          )}
        </div>
      </div>

      {/* Basket Results */}
      {basketResult && (
        <div className="card fade-up" style={{ marginBottom: '40px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
          {basketResult.type === 'found' ? (
            <div>
              <h3 style={{ color: 'var(--emerald)', fontSize: '1.2rem', marginBottom: '8px' }}>Connection Found!</h3>
              <p style={{ color: 'var(--text-2)', marginBottom: '20px' }}>Based on {basketResult.count} overlapping days across your tracking history, here is how they correlate.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', marginBottom: '24px' }}>
                {basketResult.matrix.map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg)', padding: '12px 24px', borderRadius: '12px' }}>
                    <span>{m.eggA.icon} {m.eggA.name}</span>
                    <span style={{ color: getStrengthColor(m.r), fontWeight: 'bold' }}>
                      {m.r !== null && !isNaN(m.r) ? (m.r > 0 ? '+' : '') + m.r.toFixed(2) : 'No Data'}
                    </span>
                    <span>{m.eggB.icon} {m.eggB.name}</span>
                  </div>
                ))}
              </div>
              <button 
                className="btn btn-amber" 
                onClick={() => navigate('/', { state: { prefillVariables: basketEggs, prefillLogs: basketResult } })}
              >
                Track these together →
              </button>
            </div>
          ) : (
            <div>
              <h3 style={{ color: 'var(--amber)', fontSize: '1.2rem', marginBottom: '8px' }}>Uncharted Territory!</h3>
              <p style={{ color: 'var(--text-2)', marginBottom: '20px' }}>
                {basketResult.count > 0 
                  ? `You only have ${basketResult.count} overlapping data point(s) for these habits. We need at least 3 to run the correlation algorithm.` 
                  : `You haven't tracked these habits on the same day yet.`}
              </p>
              <button 
                className="btn btn-amber" 
                onClick={() => navigate('/', { state: { prefillVariables: basketEggs, prefillLogs: basketResult } })}
              >
                + Track this Relationship
              </button>
            </div>
          )}
        </div>
      )}

      {/* Eggs Grid (Draggable) */}
      <div className="basket-section">
        <div className="basket-section-header">
          <span className="section-eyebrow">Your Habits</span>
          <span className="basket-count">Drag these into the basket</span>
        </div>
        
        <div className="eggs-grid">
          {eggs.map((egg, i) => (
            <div 
              key={egg.name} 
              className="egg-card fade-up"
              draggable
              onDragStart={(e) => handleDragStart(e, egg)}
              onDragEnd={handleDragEnd}
              style={{ cursor: 'grab' }}
            >
              <div className="egg-icon">{egg.icon}</div>
              <div className="egg-name">{egg.name}</div>
              <div className="egg-unit">{egg.unit}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Basket;
