import React from 'react';
import { signInWithGoogle, logout } from '../firebase';

const GoogleIcon = () => (
  <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
    <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

// Correlation logo SVG — two crossing sine curves
export const CorrelatioLogo = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M2 14 C5 14, 6 8, 9 8 S13 14, 16 14 S20 8, 22 8"
      stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"
    />
    <path
      d="M2 10 C5 10, 6 16, 9 16 S13 10, 16 10 S20 16, 22 16"
      stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.8"
    />
  </svg>
);

const Auth = ({ user }) => {
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try { 
      await signInWithGoogle(); 
    } catch (e) { 
      console.error(e); 
    } finally {
      setIsLoggingIn(false);
    }
  };
  const handleLogout = async () => {
    try { await logout(); } catch (e) { console.error(e); }
  };

  // Compact nav version
  if (user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="profile-chip">
          <img src={user.photoURL} alt="" className="profile-avatar" referrerPolicy="no-referrer" />
          <span className="profile-name">{user.displayName?.split(' ')[0]}</span>
        </div>
        <button className="btn btn-ghost" style={{ padding: '7px 14px', fontSize: '0.8rem' }} onClick={handleLogout}>
          Sign out
        </button>
      </div>
    );
  }

  // Full page login
  return (
    <div className="login-page">
      <div className="login-hero">
        <div className="fade-up">
          <div className="login-logo-hover-zone floating-logo-assembly" style={{ position: 'relative', display: 'inline-block', marginBottom: '28px' }}>
            <div className="login-logo-wrap" style={{ position: 'relative', zIndex: 10, marginBottom: 0 }}>
              <CorrelatioLogo size={32} />
            </div>
            
            <div className="features-emitter">
              <div className="emitted-card card-tr">
                <div className="emitted-icon">📊</div>
                <div className="emitted-text">
                  <div className="emitted-title">Pearson correlation</div>
                  <div className="emitted-desc">Find hidden links</div>
                </div>
              </div>
              <div className="emitted-card card-br">
                <div className="emitted-icon">🔗</div>
                <div className="emitted-text">
                  <div className="emitted-title">Habit chains</div>
                  <div className="emitted-desc">Connect variables</div>
                </div>
              </div>
              <div className="emitted-card card-bl">
                <div className="emitted-icon">📈</div>
                <div className="emitted-text">
                  <div className="emitted-title">Trend analysis</div>
                  <div className="emitted-desc">Visualize progress</div>
                </div>
              </div>
              <div className="emitted-card card-tl">
                <div className="emitted-icon">🤓</div>
                <div className="emitted-text">
                  <div className="emitted-title">Nerd mode</div>
                  <div className="emitted-desc">Deep insights</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <h1 className="login-title">Correlatio.</h1>
        <p className="login-subtitle">
          Discover the hidden patterns in your daily life. Log your habits and let the data reveal what's really driving your mood, focus, and energy.
        </p>
      </div>

      <div className="card login-card">
        <h3>Get started for free</h3>
        <p>Sign in to create and track your first Habit Chain</p>
        <button className="btn-google" onClick={handleLogin} disabled={isLoggingIn} style={{ opacity: isLoggingIn ? 0.7 : 1, cursor: isLoggingIn ? 'not-allowed' : 'pointer' }}>
          <GoogleIcon />
          {isLoggingIn ? 'Opening popup...' : 'Continue with Google'}
        </button>
      </div>
    </div>
  );
};

export default Auth;
