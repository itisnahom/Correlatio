import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast, ToastPortal } from './Toast';

const VAR_COLORS = ['#f59e0b', '#10b981', '#f43f5e', '#38bdf8', '#a78bfa'];

const normalizeThread = (ch) => {
  if (ch.variables) return ch;
  return { ...ch, variables: [
    { name: ch.var1Name, typeId: ch.var1TypeId, icon: ch.var1Icon || '📊', unit: ch.var1Unit },
    { name: ch.var2Name, typeId: ch.var2TypeId, icon: ch.var2Icon || '📈', unit: ch.var2Unit }
  ]};
};

const normalizeLog = (log) => {
  if (log.values) return log;
  return { ...log, values: [log.val1, log.val2] };
};

const todayStr = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
};

const Tree = ({ user }) => {
  const [threads, setThreads] = useState([]);
  const [todayLogs, setTodayLogs] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Shared variable values (the Trunks)
  const [sharedValues, setSharedValues] = useState({});
  // Branch-specific missing variables
  const [branchValues, setBranchValues] = useState({});
  const [submitting, setSubmitting] = useState('');
  
  const { toasts, showToast } = useToast();
  const today = todayStr();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users/' + user.uid + '/chains'));
      const fetched = [];
      snap.forEach(d => fetched.push({ id: d.id, ...normalizeThread(d.data()) }));
      setThreads(fetched);
      
      const todayMap = {};
      for (const ch of fetched) {
        const logSnap = await getDocs(collection(db, 'users/' + user.uid + '/chains/' + ch.id + '/logs'));
        logSnap.forEach(d => {
          const log = normalizeLog(d.data());
          if (log.dateString === today) todayMap[ch.id] = { id: d.id, ...log };
        });
      }
      setTodayLogs(todayMap);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const trunks = useMemo(() => {
    const map = new Map();
    threads.forEach(ch => {
      (ch.variables || []).forEach((v, vi) => {
        const key = (v.name || '').toLowerCase().trim();
        if (!key) return;
        if (!map.has(key)) map.set(key, { variable: v, branches: [] });
        map.get(key).branches.push({ thread: ch, varIndex: vi });
      });
    });
    return [...map.values()].filter(t => t.branches.length >= 2);
  }, [threads]);

  const handleLogThread = async (thread, trunkVarName, trunkVarIndex) => {
    setSubmitting(thread.id);
    try {
      const finalValues = [];
      let missing = false;
      
      for (let i = 0; i < thread.variables.length; i++) {
        let val;
        if (i === trunkVarIndex) {
          val = sharedValues[trunkVarName];
        } else {
          val = branchValues[`${thread.id}_${i}`];
        }
        
        if (val === undefined || val === null || val === '') {
          missing = true;
          break;
        }
        finalValues.push(Number(val));
      }

      if (missing) {
        showToast('Please fill all variables before logging', 'error');
        setSubmitting('');
        return;
      }

      await addDoc(collection(db, 'users/' + user.uid + '/chains/' + thread.id + '/logs'), {
        values: finalValues, note: '', createdAt: serverTimestamp(), dateString: today
      });
      
      showToast(`Logged entry to ${thread.name}`, 'success');
      
      // Clear the local branch states so they don't persist incorrectly
      setBranchValues(prev => {
        const next = { ...prev };
        for (let i = 0; i < thread.variables.length; i++) {
          delete next[`${thread.id}_${i}`];
        }
        return next;
      });
      
      fetchData(); // refresh to show it's logged
    } catch (err) {
      console.error(err);
      showToast('Failed to log', 'error');
    } finally {
      setSubmitting('');
    }
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /><span>Loading tree…</span></div>;

  return (
    <div className="fade-up" style={{ maxWidth: '860px', margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ marginBottom: '36px' }}>
        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🌳</div>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', marginBottom: '8px' }}>
          Variable Tree
        </h1>
        <p style={{ color: 'var(--text-2)', maxWidth: '560px' }}>
          Set a value for a shared variable temporarily. Then, fill in the missing pieces for each connected thread to finalize the logs. Incomplete logs are no longer allowed!
        </p>
      </div>

      {trunks.length === 0 ? (
        <div className="card" style={{ padding: '64px 24px', textAlign: 'center' }}>
          <div className="float" style={{ fontSize: '3rem', marginBottom: '16px' }}>🌱</div>
          <h3>No shared variables yet</h3>
          <p style={{ maxWidth: '400px', margin: '8px auto 0', fontSize: '0.9rem' }}>
            Create at least two threads that share a variable name.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {trunks.map(({ variable: v, branches }) => {
            const isBool = v.typeId === 'boolean' || v.unit === 'bool';
            const sharedVal = sharedValues[v.name] ?? '';
            const allLoggedToday = branches.every(b => todayLogs[b.thread.id]);

            return (
              <div key={v.name}>
                <div className="card" style={{ padding: '24px', borderColor: 'var(--amber)', boxShadow: '0 0 20px rgba(245,158,11,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ fontSize: '1.8rem' }}>{v.icon}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-1)' }}>{v.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--amber)', fontWeight: 500 }}>
                        Shared across {branches.length} threads
                      </div>
                    </div>
                    {allLoggedToday && (
                      <div style={{ marginLeft: 'auto', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', padding: '4px 10px', fontSize: '0.78rem', color: 'var(--emerald)', fontWeight: 500 }}>
                        ✅ All logged today
                      </div>
                    )}
                  </div>

                  {!allLoggedToday && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '24px', background: 'rgba(245,158,11,0.05)', padding: '16px', borderRadius: '12px', border: '1px dashed rgba(245,158,11,0.3)' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-2)', marginRight: 'auto' }}>
                        <strong>1.</strong> Set {v.name} temporarily:
                      </div>
                      {isBool ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="btn btn-ghost"
                            style={{ borderColor: sharedVal === 1 ? 'var(--emerald)' : 'var(--border)', color: sharedVal === 1 ? 'var(--emerald)' : 'var(--text-2)' }}
                            onClick={() => setSharedValues(prev => ({ ...prev, [v.name]: 1 }))}
                          >✓ Yes</button>
                          <button
                            className="btn btn-ghost"
                            style={{ borderColor: sharedVal === 0 ? 'var(--rose)' : 'var(--border)', color: sharedVal === 0 ? 'var(--rose)' : 'var(--text-2)' }}
                            onClick={() => setSharedValues(prev => ({ ...prev, [v.name]: 0 }))}
                          >✗ No</button>
                        </div>
                      ) : (
                        <input
                          className="input"
                          type="number"
                          placeholder={`Enter ${v.unit || v.name}…`}
                          value={sharedVal}
                          onChange={e => setSharedValues(prev => ({ ...prev, [v.name]: e.target.value }))}
                          style={{ maxWidth: '200px' }}
                        />
                      )}
                    </div>
                  )}

                  <div style={{ position: 'relative', paddingLeft: '24px' }}>
                    <div style={{
                      position: 'absolute', left: '8px', top: '8px',
                      bottom: '8px', width: '2px',
                      background: 'linear-gradient(to bottom, var(--amber), rgba(245,158,11,0.1))',
                      borderRadius: '2px',
                    }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {branches.map(({ thread, varIndex }) => {
                        const todayLog = todayLogs[thread.id];
                        const isLoggedToday = !!todayLog;

                        return (
                          <div key={thread.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <div style={{ width: '16px', height: '2px', background: 'rgba(245,158,11,0.35)', marginTop: '20px', flexShrink: 0 }} />
                            
                            {isLoggedToday ? (
                              <div style={{
                                flex: 1, background: 'var(--surface)', border: '1px solid var(--emerald)',
                                borderRadius: '10px', padding: '10px 14px',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                              }}>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '4px' }}>{thread.name}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Logged today</div>
                                </div>
                                <div style={{ fontSize: '1.2rem' }}>✅</div>
                              </div>
                            ) : (
                              <div style={{
                                flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
                                borderRadius: '10px', padding: '16px',
                              }}>
                                <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>{thread.name}</span>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 400 }}><strong>2.</strong> Complete variables</span>
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                                  {thread.variables.map((tVar, i) => {
                                    const isTrunk = (i === varIndex);
                                    const vIsBool = tVar.typeId === 'boolean' || tVar.unit === 'bool';
                                    
                                    if (isTrunk) {
                                      // Render read-only view of trunk value
                                      return (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(245,158,11,0.05)', borderRadius: '8px' }}>
                                          <span style={{ fontSize: '0.85rem' }}>{tVar.icon} {tVar.name}</span>
                                          <span style={{ fontWeight: 600, color: 'var(--amber)' }}>
                                            {sharedVal !== '' ? (vIsBool ? (sharedVal === 1 ? 'Yes' : 'No') : sharedVal) : <span style={{ opacity: 0.5 }}>Pending…</span>}
                                          </span>
                                        </div>
                                      );
                                    } else {
                                      // Render input for missing branch variable
                                      const bVal = branchValues[`${thread.id}_${i}`] ?? '';
                                      return (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                                          <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>{tVar.icon} {tVar.name}</span>
                                          {vIsBool ? (
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                              <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '0.75rem', borderColor: bVal === 1 ? 'var(--emerald)' : 'var(--border)', color: bVal === 1 ? 'var(--emerald)' : 'var(--text-2)' }} onClick={() => setBranchValues(prev => ({ ...prev, [`${thread.id}_${i}`]: 1 }))}>Yes</button>
                                              <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '0.75rem', borderColor: bVal === 0 ? 'var(--rose)' : 'var(--border)', color: bVal === 0 ? 'var(--rose)' : 'var(--text-2)' }} onClick={() => setBranchValues(prev => ({ ...prev, [`${thread.id}_${i}`]: 0 }))}>No</button>
                                            </div>
                                          ) : (
                                            <input
                                              className="input" type="number" placeholder={tVar.unit || tVar.name}
                                              value={bVal} onChange={e => setBranchValues(prev => ({ ...prev, [`${thread.id}_${i}`]: e.target.value }))}
                                              style={{ padding: '6px 10px', fontSize: '0.85rem', maxWidth: '120px' }}
                                            />
                                          )}
                                        </div>
                                      );
                                    }
                                  })}
                                </div>
                                
                                <button
                                  className="btn btn-amber"
                                  disabled={submitting === thread.id}
                                  onClick={() => handleLogThread(thread, v.name, varIndex)}
                                  style={{ width: '100%', padding: '10px' }}
                                >
                                  {submitting === thread.id ? 'Saving…' : 'Save Thread Log'}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ToastPortal toasts={toasts} />
    </div>
  );
};

export default Tree;
