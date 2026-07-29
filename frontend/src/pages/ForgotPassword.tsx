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
  // Current step: 1 = email, 2 = otp, 3 = reset
  const [step, setStep] = useState(1);
  // Loading state for async operations
  const [loading, setLoading] = useState(false);
  // Error message to display
  const [error, setError] = useState('');
  // Success message to display
  const [message, setMessage] = useState('');
  // Current UI language (English/Dari/Pashto)
  const [language, setLanguage] = useState(() => {
    const savedLanguage = localStorage.getItem('selectedLanguage');
    return savedLanguage || 'English';
  });
  const navigate = useNavigate();
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

  // Step 1: Send OTP to the provided email
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      await authAPI.forgotPassword(email);
      setMessage(t('otpSentToEmail'));
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('errorSendingOTP'));
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify the OTP code
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      await authAPI.verifyOTP(email, otp);
      setMessage(t('otpVerified'));
      setStep(3);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('invalidOTP'));
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Set new password after OTP verification
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      await authAPI.resetPassword(email, otp, newPassword);
      setMessage(t('passwordResetSuccess'));
      setTimeout(() => {
        navigate('/signin');
      }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('errorResettingPassword'));
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
        {error && <div className="error-message">{error}</div>}
        {message && <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '12px 14px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', border: '1px solid #bbf7d0' }}>{message}</div>}
        
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
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                placeholder={t('enterOTP')}
                maxLength={6}
              />
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
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder={t('newPassword')}
                minLength={8}
              />
              <div className="input-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? t('resetting') : t('resetPassword')}
            </button>
          </form>
        )}

        <p className="auth-link">
          {t('rememberPassword')} <Link to="/signin">{t('signIn')}</Link>
        </p>
      </div>
    </div>
  );
}
