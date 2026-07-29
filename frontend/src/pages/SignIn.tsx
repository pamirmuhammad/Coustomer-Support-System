import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import './Auth.css';

// SignIn — authentication page with language toggle and password visibility
export default function SignIn() {
  // Username input value
  const [username, setUsername] = useState('');
  // Password input value
  const [password, setPassword] = useState('');
  // Login error message to display
  const [error, setError] = useState('');
  // Loading state for the submit button
  const [loading, setLoading] = useState(false);
  // Toggle password visibility
  const [showPassword, setShowPassword] = useState(false);
  // Current UI language (English/Dari/Pashto)
  const [language, setLanguage] = useState(() => {
    const savedLanguage = localStorage.getItem('selectedLanguage');
    return savedLanguage || 'English';
  });
  const navigate = useNavigate();
  const { login } = useAuth();
  const { i18n, t } = useTranslation();

  // Sync language with i18n on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem('selectedLanguage');
    if (savedLanguage) {
      const langCode = savedLanguage === 'English' ? 'en' : savedLanguage === 'Dari' ? 'fa' : 'ps';
      i18n.changeLanguage(langCode);
      document.documentElement.dir = langCode === 'en' ? 'ltr' : 'rtl';
      document.documentElement.lang = langCode;
    }
  }, [i18n]);

  // Switch interface language and persist preference
  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    const langCode = lang === 'English' ? 'en' : lang === 'Dari' ? 'fa' : 'ps';
    i18n.changeLanguage(langCode);
    document.documentElement.dir = langCode === 'en' ? 'ltr' : 'rtl';
    document.documentElement.lang = langCode;
    // Save language preference to localStorage
    localStorage.setItem('selectedLanguage', lang);
  };

  // Authenticate user via login API and navigate to dashboard
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const userData = await login(username, password);
      navigate(userData.passwordChangeRequired ? '/force-password-change' : '/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const errorMessage = err instanceof Error ? (axiosErr.response?.data?.message || err.message) : t('invalidCredentials');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Header */}
      <div className="auth-header-bar" style={{ position: 'absolute', top: '0', left: '0', right: '0', padding: '12px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: '10', backgroundColor: '#2b51b1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="auth-logo" style={{ width: '50px', height: '40px', margin: '0' }}>
            <img src="/logo.gif" alt={t('logo')} />
          </div>
          <span className="auth-title" style={{ color: 'white', fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap' }}>{t('ticketManagementSystem')}</span>
        </div>
        <div className="language-selector">
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="lang-select"
            style={{ background: 'rgba(255, 255, 255, 0.2)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '14px', cursor: 'pointer', outline: 'none' }}
          >
            <option value="English" style={{ background: 'white', color: '#333' }}>{t('english')}</option>
            <option value="Dari" style={{ background: 'white', color: '#333' }}>{t('dari')}</option>
            <option value="Pashto" style={{ background: 'white', color: '#333' }}>{t('pashto')}</option>
          </select>
        </div>
      </div>

      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
           <img src="/logo.gif" alt={t('logo')} />
          </div>
          <h1 className="font-bold text-gray-900" style={{ whiteSpace: 'nowrap' }}>{t('welcomeTitle')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('welcomeSubtitle')}</p>
        </div>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false">
          <div className="form-group">
            <label className={username ? 'visible' : ''}>{t('email')}:</label>
            <input
              type="text"
              name="user-field-random-123"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              placeholder={t('enterYourEmail')}
            />
            <div className="input-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="form-group">
            <label className={password ? 'visible' : ''}>{t('password')}:</label>
            <input
              type={showPassword ? 'text' : 'password'}
              name="pass-field-random-456"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              placeholder={t('password')}
              style={{ paddingRight: '30px' }}
            />
            <div className="input-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="password-toggle-btn"
            >
              {showPassword ? (
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              )}
            </button>
            <Link to="/forgot-password" className="forgot-password">{t('forgotPassword')}</Link>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? t('signingIn') : t('login')}
          </button>
        </form>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          margin: '20px 0', 
          gap: '10px' 
        }}>
          <div style={{ 
            flex: 1, 
            height: '1px', 
            background: '#e2e8f0' 
          }}></div>
          <span style={{ 
            color: '#64748b', 
            fontSize: '14px', 
            fontWeight: '500' 
          }}>{t('or')}</span>
          <div style={{ 
            flex: 1, 
            height: '1px', 
            background: '#e2e8f0' 
          }}></div>
        </div>
        <p className="auth-link">
          {t('dontHaveAccount')} <Link to="/signup">{t('signUp')}</Link>
        </p>
      </div>
    </div>
  );
}
