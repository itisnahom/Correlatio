import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { logout } from './firebase';
import { CorrelatioLogo } from './components/Auth';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import ChainDetail from './components/ChainDetail';
import Basket from './components/Basket';
import Tree from './components/Tree';
import './App.css';

function Navbar({ user }) {
  const [showMenu, setShowMenu] = useState(false);
  const handleLogout = async () => { try { await logout(); } catch (e) { console.error(e); } };

  return (
    <nav className="navbar">
      <div className="nav-left">
        <Link to="/" className="nav-brand">
          <CorrelatioLogo size={18} />
          <span className="nav-brand-name">Correlatio.</span>
        </Link>
        <span className="nav-sep" />
        <Link to="/" className="nav-link">Threads</Link>
        <Link to="/basket" className="nav-link">🧺 Basket</Link>
        <Link to="/tree" className="nav-link">🌳 Tree</Link>
      </div>
      <div className="nav-user-wrap">
        <button className="nav-avatar-btn" onClick={() => setShowMenu(!showMenu)}>
          <img src={user.photoURL} alt="" className="nav-avatar" referrerPolicy="no-referrer" />
        </button>
        {showMenu && (
          <>
            <div className="nav-menu-overlay" onClick={() => setShowMenu(false)} />
            <div className="nav-dropdown scale-in">
              <div className="nav-dropdown-user">
                <img src={user.photoURL} alt="" className="nav-dropdown-avatar" referrerPolicy="no-referrer" />
                <div>
                  <div className="nav-dropdown-name">{user.displayName}</div>
                  <div className="nav-dropdown-email">{user.email}</div>
                </div>
              </div>
              <div className="nav-dropdown-divider" />
              <button className="nav-dropdown-item" onClick={handleLogout}>
                <span>🚪</span> Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </nav>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
    return () => unsub();
  }, []);

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
      <span>Loading…</span>
    </div>
  );

  return (
    <Router>
      <div className="app-shell">
        {user && <Navbar user={user} />}
        <div className="app-content">
          <Routes>
            <Route path="/" element={user ? <Dashboard user={user} /> : <Navigate to="/login" />} />
            <Route path="/login" element={!user ? <Auth user={user} /> : <Navigate to="/" />} />
            <Route path="/chain/:chainId" element={user ? <ChainDetail user={user} /> : <Navigate to="/login" />} />
            <Route path="/basket" element={user ? <Basket user={user} /> : <Navigate to="/login" />} />
            <Route path="/tree" element={user ? <Tree user={user} /> : <Navigate to="/login" />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
