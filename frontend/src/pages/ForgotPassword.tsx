import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useTranslation } from 'react-i18next';
import './Auth.css';

// ForgotPassword — multi-step password reset flow (email → OTP → new password)
export default function ForgotPassword() {
  // Email address for password reset
  const [email, setEmail] = useState('');
  // OTP code sent to email
  const [otp, setOtp] = useState('');
  // New password to set after OTP verification
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
const [showOTP, setShowOTP] = useState(false);
  // Current step: 1 = email, 2 = otp, 3 = reset
  const [step, setStep] = useState(1);
  // Loading state for async operations
  const [loading, setLoading] = useState(false);
  // Error message to display (translation key or raw server text)
  const [error, setError] = useState<{ key: string } | { raw: string } | null>(null);
  // Success message to display (translation key or raw server text)
  const [message, setMessage] = useState<{ key: string } | { raw: string } | null>(null);
  // Current UI language (English/Dari/Pashto)
  const [language, setLanguage] = useState(() => {
    const savedLanguage = localStorage.getItem('selectedLanguage');
    if (savedLanguage) return savedLanguage;
    const code = localStorage.getItem('language');
    return code === 'fa' ? 'Dari' : code === 'ps' ? 'Pashto' : 'English';
  });
  const navigate = useNavigate();
  const { i18n, t } = useTranslation();

  // Keep i18n language in sync with the dropdown (on mount and on change)
  useEffect(() => {
    const langCode = language === 'English' ? 'en' : language === 'Dari' ? 'fa' : 'ps';
    i18n.changeLanguage(langCode);
    document.documentElement.dir = langCode === 'en' ? 'ltr' : 'rtl';
    document.documentElement.lang = langCode;
    localStorage.setItem('selectedLanguage', language);
  }, [i18n, language]);

  // Switch interface language and persist preference
  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
  };

  // Step 1: Send OTP to the provided email
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await authAPI.forgotPassword(email);
      setMessage({ key: 'otpSentToEmail' });
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? { raw: err.message } : { key: 'errorSendingOTP' });
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify the OTP code
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await authAPI.verifyOTP(email, otp);
      setMessage({ key: 'otpVerified' });
      setStep(3);
    } catch (err: unknown) {
      setError(err instanceof Error ? { raw: err.message } : { key: 'invalidOTP' });
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Set new password after OTP verification
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await authAPI.resetPassword(email, otp, newPassword);
      setMessage({ key: 'passwordResetSuccess' });
      setTimeout(() => {
        navigate('/signin');
      }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? { raw: err.message } : { key: 'errorResettingPassword' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Header */}
      <div style={{ position: 'absolute', top: '0', left: '0', right: '0', padding: '12px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: '10', backgroundColor: '#2b51b1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="auth-logo" style={{ width: '50px', height: '40px', margin: '0' }}>
            <img src="/logo.gif" alt={t('logo')} />
          </div>
          <span style={{ color: 'white', fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap' }}>{t('ticketManagementSystem')}</span>
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
          <h1>{t('forgotPasswordPage')}</h1>
        </div>
        {error && <div className="error-message">{'key' in error ? t(error.key) : error.raw}</div>}
        {message && <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '12px 14px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', border: '1px solid #bbf7d0' }}>{'key' in message ? t(message.key) : message.raw}</div>}
        
        {step === 1 && (
          <form onSubmit={handleSendOTP}>
            <div className="form-group">
              <label className={email ? 'visible' : ''}>{t('email')}:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder={t('email')}
              />
              <div className="input-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? t('sending') : t('sendOTP')}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyOTP}>
            <div className="form-group">
              <label className={otp ? 'visible' : ''}>{t('otpCode')}:</label>
              <input
                type={showOTP ? 'text' : 'password'}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                placeholder={t('EnterOTP')}
                maxLength={6}
                style={{ paddingRight: '30px' }}
              />
              <div className="input-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <button
                type="button"
                onClick={() => setShowOTP(!showOTP)}
                className="password-toggle-btn"
              >
                {showOTP ? (
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
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? t('verifying') : t('verifyOTP')}
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{ marginTop: '10px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px' }}
            >
              {t('backToEmail')}
            </button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleResetPassword}>
            <div className="form-group">
              <label className={newPassword ? 'visible' : ''}>{t('newPassword')}:</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder={t('newPassword')}
                minLength={8}
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
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? t('resetting') : t('resetPassword')}
            </button>
          </form>
        )}

        <p className="auth-link">
          {t('rememberPassword')} <Link to="/signin">{t('signIn')}</Link>
        </p>
        <div style={{ marginTop: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>build v3</div>
      </div>
    </div>
  );
}
