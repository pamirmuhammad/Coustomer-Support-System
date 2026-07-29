import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI, roleAPI, organizationAPI, extractArrayData } from '../services/api';
import { useTranslation } from 'react-i18next';
import { useSimpleToast } from '../components/SimpleToast';
import './Auth.css';

interface Role {
  id: number;
  name: string;
}

interface Organization {
  id: number;
  name: string;
}

// SignUp — user registration with role selection, org search, and language toggle
export default function SignUp() {
  // Registration form fields
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    roleId: '',
    organizationId: '',
  });
  // Available roles and organizations from API
  const [roles, setRoles] = useState<Role[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  // Organization search and dropdown visibility
  const [orgSearch, setOrgSearch] = useState('');
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  // Error message display
  const [error, setError] = useState('');
  const { show, ToastContainer } = useSimpleToast();
  // Loading state for submit button
  const [loading, setLoading] = useState(false);
  // Toggle password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // Current UI language (English/Dari/Pashto)
  const [language, setLanguage] = useState(() => {
    const savedLanguage = localStorage.getItem('selectedLanguage');
    return savedLanguage || 'English';
  });
  const navigate = useNavigate();
  const { i18n, t } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  // Filtered org list based on search text
  const filteredOrgs = useMemo(() => {
    if (!orgSearch.trim()) return organizations;
    const q = orgSearch.trim().toLowerCase();
    return organizations.filter(org => org.name.toLowerCase().includes(q));
  }, [organizations, orgSearch]);

  useEffect(() => {
  }, []);

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
    localStorage.setItem('selectedLanguage', lang);
  };

  // Ensure data loads only once on mount
  const loaded = useRef(false);

  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      // Fetch roles and organizations on mount
      const loadData = async () => {
        try {
          const [rolesRes, orgsRes] = await Promise.all([
            roleAPI.getAll(),
            organizationAPI.getAll(),
          ]);
          const allRoles = extractArrayData<Role>(rolesRes.data);
          const clientRole = allRoles.find(r => r.name.toLowerCase() === 'mcit clients');
          setRoles(clientRole ? [clientRole] : []);
          setOrganizations(extractArrayData<Organization>(orgsRes.data));
          if (clientRole) {
            setFormData(prev => ({ ...prev, roleId: String(clientRole.id) }));
          }
        } catch (err) {
          }
      };
      loadData();
    }
  }, []);

  // Register a new user with password validation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (!formData.organizationId) {
      setError('Please select an organization');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        fullName: formData.fullName,
        username: formData.username,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        roleId: formData.roleId ? parseInt(formData.roleId) : undefined,
        organizationId: formData.organizationId ? parseInt(formData.organizationId) : undefined,
      };
        await authAPI.signup(payload);
      show('success', t('success'), t('registrationSuccess'));
      setTimeout(() => navigate('/signin'), 2000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: Record<string, unknown> | string } };
      const data = axiosErr.response?.data;
      let message = typeof data === 'string' ? data : undefined;
      if (!message && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        message = obj.message as string;
        if (!message) {
          const fieldErrors = Object.entries(obj)
            .filter(([k]) => k !== 'timestamp' && k !== 'status' && k !== 'error' && k !== 'path')
            .map(([k, v]) => `${k}: ${v}`);
          if (fieldErrors.length > 0) {
            message = fieldErrors.join('; ');
          }
        }
      }
      setError(message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s',
    color: '#1e293b',
  };

  const toggleBtnStyle = {
    position: 'absolute' as const,
    [isRtl ? 'left' : 'right']: '8px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#6b7280',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
  };

  const rowStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '16px',
  };

  const fieldStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  };

  const labelStyle = {
    fontSize: '13px',
    fontWeight: '500' as const,
    color: '#374151',
  };

  const PasswordEyeIcon = ({ visible }: { visible: boolean }) => (
    visible
      ? <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
      : <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
  );

  return (
    <div className="auth-container">
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

      <div className="auth-card" style={{ maxWidth: '800px' }}>
        <div className="auth-header">
          <div className="auth-logo">
            <img src="/logo.gif" alt={t('logo')} />
          </div>
          <h1>{t('signUpPage')}</h1>
        </div>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit} autoComplete="off">
          {/* Row 1: Full Name & Username */}
          <div className="signup-row" style={rowStyle}>
            <div style={fieldStyle}>
              <label style={labelStyle}>{t('fullName')}</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
                placeholder={t('Enter Full Name')}
                style={inputStyle}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>{t('username')}</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                placeholder={t('Enter User Name')}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Row 2: Email & Phone */}
          <div className="signup-row" style={rowStyle}>
            <div style={fieldStyle}>
              <label style={labelStyle}>{t('email')}</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                placeholder={t('Enter Email')}
                style={inputStyle}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>{t('phone')}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9+]/g, '').slice(0, 15);
                    setFormData({ ...formData, phone: val });
                  }}
                  placeholder={t('+93')}
                  style={{ ...inputStyle, textAlign: isRtl ? 'right' : 'left' }}
                />
              </div>
            </div>
          </div>

          {/* Row 3: Password & Confirm Password */}
          <div className="signup-row" style={rowStyle}>
            <div style={fieldStyle}>
              <label style={labelStyle}>{t('password')}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  placeholder={t('enterPassword')}
                  minLength={8}
                  autoComplete="new-password"
                  style={{ ...inputStyle, [isRtl ? 'paddingLeft' : 'paddingRight']: '36px' }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={toggleBtnStyle}>
                  <PasswordEyeIcon visible={showPassword} />
                </button>
              </div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>{t('confirmPassword') || 'Confirm Password'}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  placeholder={t('confirmPassword') || 'Confirm Password'}
                  autoComplete="new-password"
                  style={{ ...inputStyle, [isRtl ? 'paddingLeft' : 'paddingRight']: '36px' }}
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={toggleBtnStyle}>
                  <PasswordEyeIcon visible={showConfirmPassword} />
                </button>
              </div>
            </div>
          </div>

          {/* Row 4: Role & Organization */}
          <div className="signup-row" style={rowStyle}>
            <div style={fieldStyle}>
              <label style={labelStyle}>{t('role')}</label>
              <select
                value={formData.roleId}
                disabled
                style={{ ...inputStyle, backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
              >
                {roles.map((role: Role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>{t('organizations')}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={orgSearch}
                  onChange={(e) => { setOrgSearch(e.target.value); setShowOrgDropdown(true); setFormData({ ...formData, organizationId: '' }); }}
                  onFocus={() => setShowOrgDropdown(true)}
                  onBlur={() => setTimeout(() => setShowOrgDropdown(false), 200)}
                  required
                  placeholder={t('selectOrganization') || 'Select Organization'}
                  style={inputStyle}
                />
                {showOrgDropdown && (
                  <div style={{ position: 'absolute', zIndex: 10, width: '100%', marginTop: '4px', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: '200px', overflowY: 'auto' }}>
                    {filteredOrgs.length > 0 ? filteredOrgs.map((org: Organization) => (
                      <div
                        key={org.id}
                        onMouseDown={() => {
                          setFormData({ ...formData, organizationId: String(org.id) });
                          setOrgSearch(org.name);
                          setShowOrgDropdown(false);
                        }}
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '14px', color: formData.organizationId === String(org.id) ? '#1d4ed8' : '#000000', backgroundColor: formData.organizationId === String(org.id) ? '#dbeafe' : 'transparent' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2b51b1'; e.currentTarget.style.color = '#ffffff'; }}
                        onMouseLeave={(e) => {
                          const isSelected = formData.organizationId === String(org.id);
                          e.currentTarget.style.backgroundColor = isSelected ? '#dbeafe' : 'transparent';
                          e.currentTarget.style.color = isSelected ? '#1d4ed8' : '#000000';
                        }}
                      >
                        {org.name}
                      </div>
                    )) : (
                      <div style={{ padding: '8px 12px', fontSize: '14px', color: '#6b7280' }}>{t('noOrganizationsMatch') || 'No organizations found'}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: '8px' }}>
            {loading ? t('creatingAccount') : t('signUp')}
          </button>
        </form>
        <p className="auth-link">
          {t('alreadyHaveAccount')} <Link to="/signin">{t('signIn')}</Link>
        </p>
      </div>
      <ToastContainer />
    </div>
  );
}
