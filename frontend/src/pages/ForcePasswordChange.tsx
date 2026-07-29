import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import { useSimpleToast } from '../components/SimpleToast';
import { useTranslation } from 'react-i18next';
import './Auth.css';

export default function ForcePasswordChange() {
  const { t, i18n } = useTranslation();
  const { user, updateUser } = useAuth();
  const { show, ToastContainer } = useSimpleToast();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRtl = i18n.language === 'fa' || i18n.language === 'ps';
  const [language, setLanguage] = useState(() => {
    const savedLanguage = localStorage.getItem('selectedLanguage');
    return savedLanguage || 'English';
  });

  useEffect(() => {
    const savedLanguage = localStorage.getItem('selectedLanguage');
    if (savedLanguage) {
      const langCode = savedLanguage === 'English' ? 'en' : savedLanguage === 'Dari' ? 'fa' : 'ps';
      i18n.changeLanguage(langCode);
      document.documentElement.dir = langCode === 'en' ? 'ltr' : 'rtl';
      document.documentElement.lang = langCode;
    }
  }, [i18n]);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    const langCode = lang === 'English' ? 'en' : lang === 'Dari' ? 'fa' : 'ps';
    i18n.changeLanguage(langCode);
    document.documentElement.dir = langCode === 'en' ? 'ltr' : 'rtl';
    document.documentElement.lang = langCode;
    localStorage.setItem('selectedLanguage', lang);
  };

  useEffect(() => {
    if (user && !user.passwordChangeRequired) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      show('error', t('error'), t('newPasswordMinLength'));
      return;
    }
    if (newPassword !== confirmPassword) {
      show('error', t('error'), t('passwordsDoNotMatch'));
      return;
    }
    setIsSubmitting(true);
    try {
      await authAPI.forcePasswordChange(newPassword);
      updateUser({ passwordChangeRequired: false });
      show('success', t('success'), t('updatePassword'));
      navigate('/dashboard');
    } catch {
      show('error', t('error'), t('operationFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user?.passwordChangeRequired) {
    return null;
  }

  return (
    <div className="auth-container">
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
          <h1>{t('changePassword')}</h1>
        </div>
        <p className="text-gray-500 text-sm mb-6 text-center" style={{ marginTop: '0' }}>
          {t('forcePasswordChangeDescription') || 'You must change your password before continuing.'}
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className={newPassword ? 'visible' : ''}>{t('newPassword')}:</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder={t('enterNewPassword')}
                minLength={8}
                autoFocus
                style={{ paddingRight: isRtl ? '12px' : '40px', paddingLeft: isRtl ? '40px' : '12px' }}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                style={{ right: isRtl ? 'auto' : '12px', left: isRtl ? '12px' : 'auto', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {showNewPassword ? (
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                ) : (
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                )}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label className={confirmPassword ? 'visible' : ''}>{t('confirmPassword')}:</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder={t('confirmNewPassword') || t('confirmPassword')}
                style={{ paddingRight: isRtl ? '12px' : '40px', paddingLeft: isRtl ? '40px' : '12px' }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                style={{ right: isRtl ? 'auto' : '12px', left: isRtl ? '12px' : 'auto', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {showConfirmPassword ? (
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                ) : (
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                )}
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ width: '100%', textAlign: 'center' }}>
            {isSubmitting ? t('changing') || t('submitting') : t('changePassword')}
          </button>
        </form>
      </div>
      <ToastContainer />
    </div>
  );
}
