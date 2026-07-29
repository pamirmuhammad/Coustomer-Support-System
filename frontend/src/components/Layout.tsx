/**
 * Layout component providing the app shell for authenticated users.
 *
 * Renders:
 * - A collapsible sidebar with role-based navigation (admin / support / org menus)
 * - A top navbar with language selector, notification bell (with polling), and user profile dropdown
 * - An edit-profile modal for updating name, username, email, photo, and password
 * - The main content area via React Router's Outlet equivalent (props.children)
 *
 * The sidebar highlights the active route and the notification bell polls every 10 seconds.
 */
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { userAPI, notificationAPI, extractArrayData, API_BASE_URL } from '../services/api';
import { useSimpleToast } from '../components/SimpleToast';
import { useModalEscape } from '../hooks/useModalEscape';
import './Layout.css';

// Describes a single notification from the backend API
interface NotificationItem {
  id: number;
  isRead: boolean;
  type: string;
  message: string;
  createdAt: string;
  ticketId?: number;
  ticketSubject?: string;
  actorName?: string;
  serviceName?: string;
}

// Groups notifications by ticketId for the accordion view
interface TicketGroup {
  ticketId: number;
  ticketSubject: string;
  activities: NotificationItem[];
  unreadCount: number;
  latestActivity: string;
  serviceName?: string;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAuthenticated, updateUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'fa' || i18n.language === 'ps';
  const { show, ToastContainer } = useSimpleToast();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showUsersRolesMenu, setShowUsersRolesMenu] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [notificationTab, setNotificationTab] = useState<'all' | 'unread'>('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [language, setLanguage] = useState(i18n.language === 'en' ? 'English' : i18n.language === 'fa' ? 'Dari' : 'Pashto');
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    oldPassword: '',
    newPassword: '',
    photo: '' as string
  });
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [oldPasswordError, setOldPasswordError] = useState('');
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const overflowMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotificationDropdown(false);
      }
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(event.target as Node)) {
        setShowOverflowMenu(false);
      }
    };

    if (showUserMenu || showNotificationDropdown || showOverflowMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu, showNotificationDropdown, showOverflowMenu]);

  // Close modal on Esc key press
  useModalEscape(() => handleCloseEditProfile(), showEditProfileModal);

  // Load notifications from backend
  const loadNotifications = async () => {
    if (user?.id && isAuthenticated) {
      try {
        const response = await notificationAPI.getAll(user.id, 200);
                    setNotifications(extractArrayData<NotificationItem>(response.data));
        const countResponse = await notificationAPI.getUnreadCount(user.id);
              setUnreadCount(countResponse.data || 0);
      } catch (error) {
            }
    }
  };

  const notificationsLoaded = useRef(false);

  // Load notifications on mount and when user changes
  useEffect(() => {
    if (isAuthenticated && user?.id && !notificationsLoaded.current) {
      notificationsLoaded.current = true;
      loadNotifications();
    }
  }, [user?.id, isAuthenticated]);

  const handleMarkAsRead = async (notificationId: number) => {
    try {
      await notificationAPI.markAsRead(notificationId);
      // Optimistically remove from local state so it hides immediately (WhatsApp-like)
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error: unknown) {
      show('error', t('error'), error instanceof Error ? error.message : t('operationFailed'));
      await loadNotifications();
    }
  };

  const handleMarkAllAsRead = async () => {
    if (user?.id) {
      try {
              await notificationAPI.markAllAsRead(user.id);
              // Reload notifications immediately
        await loadNotifications();
      } catch (error: unknown) {
        show('error', t('error'), error instanceof Error ? error.message : t('operationFailed'));
      }
    }
  };

  const handleDeleteNotification = async (notificationId: number) => {
    try {
      await notificationAPI.delete(notificationId);
      loadNotifications();
    } catch (error: unknown) {
        show('error', t('error'), error instanceof Error ? error.message : t('operationFailed'));
      }
  };

  const handleDeleteReadNotifications = async () => {
    const readNotifs = notifications.filter(n => n.isRead);
    for (const n of readNotifs) {
      try { await notificationAPI.delete(n.id); } catch { /* continue */ }
    }
    await loadNotifications();
    setShowOverflowMenu(false);
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const getRelativeTime = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);
    if (diffMin < 1) return t('justNow');
    if (diffMin < 60) return `${diffMin} ${t('minAgo')}`;
    if (diffHr < 24) return `${diffHr} ${t('hourAgo')}`;
    if (diffDay === 1) return `${t('yesterday')} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (diffDay < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getDateGroup = (dateStr: string): 'today' | 'yesterday' | 'thisWeek' | 'earlier' => {
    const now = new Date();
    const date = new Date(dateStr);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - 7);
    if (date >= startOfToday) return 'today';
    if (date >= startOfYesterday) return 'yesterday';
    if (date >= startOfWeek) return 'thisWeek';
    return 'earlier';
  };

  const groupNotificationsByTicket = (items: NotificationItem[]): TicketGroup[] => {
    const map = new Map<number, TicketGroup>();
    items.forEach(n => {
      const key = n.ticketId || n.id;
      if (!map.has(key)) {
        map.set(key, {
          ticketId: key,
          ticketSubject: n.ticketSubject || n.message.replace(/^(New ticket created: |Ticket assigned to you: |New comment on: |Ticket status changed.*: )/, ''),
          activities: [],
          unreadCount: 0,
          latestActivity: n.createdAt,
          serviceName: n.serviceName,
        });
      }
      const group = map.get(key)!;
      group.activities.push(n);
      if (!n.isRead) group.unreadCount++;
      if (new Date(n.createdAt) > new Date(group.latestActivity)) group.latestActivity = n.createdAt;
    });
    return Array.from(map.values()).sort((a, b) => new Date(b.latestActivity).getTime() - new Date(a.latestActivity).getTime());
  };

  const filteredNotifications = notificationTab === 'unread'
    ? notifications.filter(n => !n.isRead)
    : notifications;

  const groupedByDate = {
    today: groupNotificationsByTicket(filteredNotifications.filter(n => getDateGroup(n.createdAt) === 'today')),
    yesterday: groupNotificationsByTicket(filteredNotifications.filter(n => getDateGroup(n.createdAt) === 'yesterday')),
    thisWeek: groupNotificationsByTicket(filteredNotifications.filter(n => getDateGroup(n.createdAt) === 'thisWeek')),
    earlier: groupNotificationsByTicket(filteredNotifications.filter(n => getDateGroup(n.createdAt) === 'earlier')),
  };

  const expandAllGroups = () => {
    const allKeys = new Set<string>();
    (['today', 'yesterday', 'thisWeek', 'earlier'] as const).forEach(group => {
      groupedByDate[group].forEach(tg => allKeys.add(`${group}-${tg.ticketId}`));
    });
    if (allKeys.size === 0) return;
    const allExpanded = allKeys.size > 0 && [...allKeys].every(k => expandedGroups.has(k));
    setExpandedGroups(allExpanded ? new Set() : allKeys);
  };

  const allGroupsExpanded = (() => {
    const allKeys: string[] = [];
    (['today', 'yesterday', 'thisWeek', 'earlier'] as const).forEach(group => {
      groupedByDate[group].forEach(tg => allKeys.push(`${group}-${tg.ticketId}`));
    });
    return allKeys.length > 0 && allKeys.every(k => expandedGroups.has(k));
  })();

  const getActivityLabel = (activity: NotificationItem) => {
    const actor = activity.actorName || '';
    switch (activity.type) {
      case 'NEW_TICKET': return actor ? `${actor} ${t('openedTicket')}` : t('notificationNewTicket');
      case 'ASSIGNMENT': return actor ? `${t('assignedBy')} ${actor}` : t('notificationAssignment');
      case 'STATUS_CHANGE': return actor ? `${actor} ${t('changedStatus')}` : t('notificationStatusChange');
      case 'NEW_COMMENT': return actor ? `${actor} ${t('commented')}` : t('notificationComment');
      default: return activity.type;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'NEW_TICKET': return '#3b82f6';
      case 'ASSIGNMENT': return '#f59e0b';
      case 'STATUS_CHANGE': return '#10b981';
      case 'NEW_COMMENT': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const getServiceIcon = (serviceName: string | undefined, color: string, size: number = 20) => {
    const name = (serviceName || '').toLowerCase();
    if (name.includes('email') || name.includes('mail') || name.includes('smtp')) {
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"></rect><polyline points="22,7 12,13 2,7"></polyline></svg>;
    }
    if (name.includes('domain') || name.includes('dns')) {
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>;
    }
    if (name.includes('host')) {
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><rect x="2" y="2" width="20" height="8" rx="2"></rect><rect x="2" y="14" width="20" height="8" rx="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>;
    }
    if (name.includes('vm') || name.includes('virtual') || name.includes('server')) {
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><rect x="2" y="2" width="20" height="8" rx="2"></rect><rect x="2" y="14" width="20" height="8" rx="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>;
    }
    if (name.includes('ssl') || name.includes('cert')) {
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>;
    }
    if (name.includes('database') || name.includes('db') || name.includes('sql')) {
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>;
    }
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>;
  };

  const handleLogout = () => {
    logout();
    navigate('/signin');
  };

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    const langCode = lang === 'English' ? 'en' : lang === 'Dari' ? 'fa' : 'ps';
    i18n.changeLanguage(langCode);
    // Set document direction based on language
    document.documentElement.dir = langCode === 'en' ? 'ltr' : 'rtl';
    document.documentElement.lang = langCode;
  };

  // Set initial direction on mount
  useEffect(() => {
    const langCode = i18n.language;
    document.documentElement.dir = langCode === 'en' ? 'ltr' : 'rtl';
    document.documentElement.lang = langCode;
    }, [i18n.language]);

  const handleOpenEditProfile = () => {
    setEditFormData({
      fullName: user?.fullName || '',
      username: user?.username || '',
      email: user?.email || '',
      oldPassword: '',
      newPassword: '',
      photo: user?.photo || ''
    });
    setSelectedPhotoFile(null);
    setShowEditProfileModal(true);
    setShowUserMenu(false);
  };

  const handleCloseEditProfile = () => {
    setShowEditProfileModal(false);
    setEditFormData({
      fullName: user?.fullName || '',
      username: user?.username || '',
      email: user?.email || '',
      oldPassword: '',
      newPassword: '',
      photo: user?.photo || ''
    });
    setSelectedPhotoFile(null);
    setShowOldPassword(false);
    setShowNewPassword(false);
    setOldPasswordError('');
  };

  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (user?.id) {
        // Validate password fields if new password is provided
        if (editFormData.newPassword) {
          if (!editFormData.oldPassword && user?.role !== 'ADMIN') {
            setOldPasswordError(t('pleaseEnterOldPassword'));
            show('error', t('error'), t('pleaseEnterOldPassword'));
            return;
          }
          if (editFormData.newPassword.length < 8) {
            show('error', t('error'), t('newPasswordMinLength'));
            return;
          }
          // Change password using old password verification
          try {
            await userAPI.changePassword(user.id, editFormData.oldPassword || '', editFormData.newPassword);
          } catch (passwordError: unknown) {
            setOldPasswordError(t('oldPasswordIncorrect'));
            show('error', t('error'), t('oldPasswordIncorrect'));
            return;
          }
        }

        // Upload profile picture if a new file was selected
        let photoUrl = editFormData.photo;
        if (selectedPhotoFile) {
            const uploadRes = await userAPI.updateProfilePicture(user.id, selectedPhotoFile);
            photoUrl = uploadRes.data?.url || uploadRes.data?.photo || uploadRes.data || photoUrl;
            if (photoUrl && !photoUrl.startsWith('data:') && !photoUrl.startsWith('http')) {
              photoUrl = API_BASE_URL + photoUrl;
            }
          }

        // Update fullName, username, email, and photo
        await userAPI.update(user.id, {
          fullName: editFormData.fullName,
          username: editFormData.username,
          email: editFormData.email,
          photo: photoUrl
        });

        updateUser({
          fullName: editFormData.fullName,
          username: editFormData.username,
          email: editFormData.email,
          photo: photoUrl
        });

        show('success', t('success'), t('updateProfile'));
        handleCloseEditProfile();
      }
    } catch (error: unknown) {
          const message = error instanceof Error ? (error as any).response?.data?.message || error.message : t('somethingWentWrong');
          show('error', t('error'), message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  const isAdmin = user?.role === 'ADMIN';
  const isSupport = user?.role?.includes('SUPPORT') || isAdmin || (user?.role && user?.role !== 'ORGANIZATION' && user?.role !== 'USER');
  const isOrg = user?.role === 'ORGANIZATION' || user?.role === 'USER';

  return (
    <>
    <div className="layout">
      <a href="#main-content" className="skip-to-content">
        {t('skipToContent')}
      </a>
      <div className="layout-body">
        {/* Mobile Sidebar Overlay */}
        {showSidebar && (
          <div
            className="sidebar-overlay"
            onClick={() => setShowSidebar(false)}
          />
        )}

        {/* Left Sidebar */}
        <aside id="sidebar" className={`sidebar ${showSidebar ? 'open' : ''}`}>
          {/* Sidebar Header with Logo */}
          <div className="sidebar-header">
            <div className="logo">
              <img src="/logo.gif" alt={t('logo')} style={{ width: '32px', height: '32px', display: 'block' }} />
              <h2>{t('ticketSystem')}</h2>
            </div>
          </div>

          <nav className="nav">
            {isAdmin && (
              <>
                <Link to="/admin/dashboard" className={location.pathname === '/admin/dashboard' ? 'active' : ''} onClick={() => setShowSidebar(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                  {t('dashboard')}
                </Link>
                <Link to="/admin/services" className={location.pathname === '/admin/services' ? 'active' : ''} onClick={() => setShowSidebar(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                  </svg>
                  {t('services')}
                </Link>
                <div className="nav-group">
                  <button 
                    className="nav-group-toggle"
                    onClick={() => setShowUsersRolesMenu(!showUsersRolesMenu)}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: 'inherit', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px 24px',
                      width: '100%',
                      textAlign: isRtl ? 'right' : 'left',
                      fontSize: '15px',
                      fontWeight: 700,
                      letterSpacing: '0.3px'
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    {t('users')}
                    <svg 
                      width="12" 
                      height="12" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2"
                      style={{ 
                        marginInlineStart: 'auto',
                        transform: showUsersRolesMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s'
                      }}
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                  {showUsersRolesMenu && (
                    <div className="nav-submenu" style={{ paddingLeft: '44px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <Link 
                        to="/admin/create-role" 
                        className={location.pathname === '/admin/create-role' ? 'active' : ''}
                        style={{ fontSize: '13px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
                        onClick={() => setShowSidebar(false)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        </svg>
                        {t('addRole')}
                      </Link>
                      <Link 
                        to="/admin/create-user" 
                        className={location.pathname === '/admin/create-user' ? 'active' : ''}
                        style={{ fontSize: '13px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
                        onClick={() => setShowSidebar(false)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                          <circle cx="8.5" cy="7" r="4"></circle>
                          <line x1="20" y1="8" x2="20" y2="14"></line>
                          <line x1="23" y1="11" x2="17" y2="11"></line>
                        </svg>
                        {t('addUser')}
                      </Link>
                    </div>
                  )}
                </div>
                <Link to="/admin/organizations" className={location.pathname === '/admin/organizations' ? 'active' : ''} onClick={() => setShowSidebar(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>
                  {t('organizations')}
                </Link>
                <Link to="/admin/my-tickets" className={location.pathname === '/admin/my-tickets' ? 'active' : ''} onClick={() => setShowSidebar(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  {t('adminTickets')}
                </Link>
                <Link to="/admin/tickets" className={location.pathname === '/admin/tickets' ? 'active' : ''} onClick={() => setShowSidebar(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  {t('ticketManagement')}
                </Link>
                <Link to="/admin/reports" className={location.pathname === '/admin/reports' ? 'active' : ''} onClick={() => setShowSidebar(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  {t('reports')}
                </Link>
              </>
            )}
            {isSupport && !isAdmin && (
              <>
                <Link to="/support/dashboard" className={location.pathname === '/support/dashboard' ? 'active' : ''} onClick={() => setShowSidebar(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                  {t('dashboard')}
                </Link>
                <Link to="/support/my-tickets" className={location.pathname === '/support/my-tickets' ? 'active' : ''} onClick={() => setShowSidebar(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  {t('myAssignedTickets')}
                </Link>
              </>
            )}
            {isOrg && (
              <>
                <Link to="/org/dashboard" className={location.pathname === '/org/dashboard' ? 'active' : ''} onClick={() => setShowSidebar(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                  {t('dashboard')}
                </Link>
                <Link to="/org/tickets" className={location.pathname === '/org/tickets' ? 'active' : ''} onClick={() => setShowSidebar(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  {t('myTickets')}
                </Link>
              </>
            )}
          </nav>
        </aside>

        {/* Content Wrapper - contains header and main content */}
        <div className="content-wrapper">
          {/* Top Header */}
          <header className="top-navbar">
            <button
              className="mobile-menu-toggle"
              onClick={() => setShowSidebar(!showSidebar)}
              aria-label={showSidebar ? 'Close sidebar menu' : 'Open sidebar menu'}
              aria-expanded={showSidebar}
              aria-controls="sidebar"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <div className="navbar-right" ref={null} style={{ width: 'auto', minWidth: '300px', overflow: 'visible' }}>
              {/* Language Selector */}
              <div className="language-selector">
                <select
                  value={language}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="lang-select"
                >
                  <option value="English">{t('english')}</option>
                  <option value="Dari">{t('dari')}</option>
                  <option value="Pashto">{t('pashto')}</option>
                </select>
              </div>

              {/* Notifications */}
              <div className="notification-bell" ref={notificationRef}>
                <button
                  className="bell-btn"
                  onClick={() => { setShowNotificationDropdown(!showNotificationDropdown); if (!showNotificationDropdown) loadNotifications(); }}
                  aria-label={t('notifications')}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                  </svg>
                  {unreadCount > 0 && (
                    <span className="notification-badge">{unreadCount}</span>
                  )}
                </button>

                {/* Notification Dropdown - Enterprise Panel */}
                {showNotificationDropdown && (
                  <div className="notification-panel" onClick={(e) => e.stopPropagation()}>
                    {/* Header */}
                    <div className="np-header">
                      <div className="np-header-left">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                        </svg>
                        <h3>{t('notifications')}</h3>
                      </div>
                      <div className="np-header-right" style={{ position: 'relative' }} ref={overflowMenuRef}>
                        <button className="np-overflow-btn" onClick={() => setShowOverflowMenu(!showOverflowMenu)} aria-label="More options">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                            <circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="19" r="1"></circle>
                          </svg>
                        </button>
                        {showOverflowMenu && (
                          <div className="np-overflow-menu">
                            <button onClick={() => { handleMarkAllAsRead(); setShowOverflowMenu(false); }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                              {t('markAllAsRead')}
                            </button>
                            <button onClick={handleDeleteReadNotifications}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                              {t('clearReadNotifications')}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tabs */}
                    <div className="np-tabs">
                      <button className={`np-tab ${notificationTab === 'all' ? 'active' : ''}`} onClick={() => setNotificationTab('all')}>
                        {t('all')} <span className="np-tab-badge">{notifications.length}</span>
                      </button>
                      <button className={`np-tab ${notificationTab === 'unread' ? 'active' : ''}`} onClick={() => setNotificationTab('unread')}>
                        {t('unread')} <span className="np-tab-badge unread">{unreadCount}</span>
                      </button>
                    </div>

                    {/* Content */}
                    <div className="np-content">
                      {notifications.length === 0 ? (
                        <div className="np-empty">
                          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                          </svg>
                          <p className="np-empty-title">{t('noNotifications')}</p>
                          <p className="np-empty-sub">{t('allCaughtUp')}</p>
                        </div>
                      ) : (
                        (['today', 'yesterday', 'thisWeek', 'earlier'] as const).map(group => {
                          const groups = groupedByDate[group];
                          if (groups.length === 0) return null;
                          return (
                            <div key={group} className="np-date-group">
                              <div className="np-date-label">{t(`dateGroup_${group}`)}</div>
                              {groups.map((ticketGroup) => {
                                const groupKey = `${group}-${ticketGroup.ticketId}`;
                                const isExpanded = expandedGroups.has(groupKey);
                                const latestActivity = [...ticketGroup.activities].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                                const latestType = latestActivity?.type || 'NEW_TICKET';
                                const typeColor = getActivityColor(latestType);
                                const latestServiceName = latestActivity?.serviceName;
                                return (
                                <div key={groupKey} className={`np-ticket-card ${ticketGroup.unreadCount > 0 ? 'unread' : ''}`}>
                                  <div className="np-ticket-header" onClick={() => toggleGroup(groupKey)} role="button" tabIndex={0} aria-expanded={isExpanded}>
                                    {ticketGroup.unreadCount > 0 && <div className="np-unread-dot"></div>}
                                    <div className="np-ticket-icon" style={{ background: `${typeColor}10`, color: typeColor }}>
                                      {getServiceIcon(latestServiceName, typeColor, 20)}
                                    </div>
                                    <div className="np-ticket-info">
                                      <div className="np-ticket-subject">{ticketGroup.ticketSubject}</div>
                                      <div className="np-ticket-meta">
                                        <span className="np-ticket-id">TKT-{String(ticketGroup.ticketId).padStart(4, '0')}</span>
                                        <span className="np-separator">·</span>
                                        <span>{latestActivity ? getActivityLabel(latestActivity) : ''}</span>
                                        <span className="np-separator">·</span>
                                        <span>{getRelativeTime(ticketGroup.latestActivity)}</span>
                                      </div>
                                    </div>
                                    <div className="np-ticket-right">
                                      {ticketGroup.unreadCount > 0 && <span className="np-unread-badge">{ticketGroup.unreadCount}</span>}
                                      <svg className={`np-chevron ${isExpanded ? 'expanded' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                      </svg>
                                    </div>
                                  </div>
                                  <div className={`np-ticket-timeline-wrapper ${isExpanded ? 'expanded' : ''}`}>
                                    <div className="np-ticket-timeline">
                                      {ticketGroup.activities.map((activity, idx) => (
                                        <div key={activity.id} className={`np-timeline-item ${!activity.isRead ? 'unread' : ''}`}>
                                          <div className="np-timeline-line">
                                            <div className="np-timeline-dot" style={{ background: getActivityColor(activity.type) }}></div>
                                            {idx < ticketGroup.activities.length - 1 && <div className="np-timeline-connector"></div>}
                                          </div>
                                          <div className="np-timeline-content">
                                            <div className="np-timeline-label">{getActivityLabel(activity)}</div>
                                            <div className="np-timeline-msg">{activity.message}</div>
                                            <div className="np-timeline-time">{getRelativeTime(activity.createdAt)}</div>
                                          </div>
                                          <div className="np-timeline-actions">
                                            {!activity.isRead && (
                                              <button className="np-action-btn" onClick={(e) => { e.stopPropagation(); handleMarkAsRead(activity.id); }} title={t('markAsRead')}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                              </button>
                                            )}
                                            <button className="np-action-btn" onClick={(e) => { e.stopPropagation(); handleDeleteNotification(activity.id); }} title={t('delete')}>
                                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                );
                              })}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                      <div className="np-footer">
                        <button className="np-footer-btn" onClick={() => { setNotificationTab('all'); expandAllGroups(); }}>
                          {allGroupsExpanded ? t('collapseAll') : t('viewAllNotifications')} <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: allGroupsExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* User Profile */}
              <div className="user-profile" ref={userMenuRef}>
                <button
                  className="profile-btn"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                >
                  <div className="avatar">
                    {user?.photo ? (
                      <img src={user.photo} alt={t('profile')} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    ) : (
                      <span>{user?.username?.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>{user?.username}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>

                {showUserMenu && (
                  <div className="user-dropdown">
                    <div className="dropdown-divider" style={{ margin: 0 }}></div>
                    <button className="dropdown-item" onClick={handleOpenEditProfile}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      {t('editProfile')}
                    </button>
                    <button className="dropdown-item" onClick={handleLogout}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                      </svg>
                      {t('logout')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main id="main-content" className="main-content" tabIndex={-1}>
          {children}
        </main>
        </div>

        {/* Edit Profile Modal */}
        {showEditProfileModal && (
          <div className="fixed inset-0 bg-transparent bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-auto animate-fadeIn" onClick={(e) => e.stopPropagation()}>
              <div className="px-4 py-3 rounded-t-2xl" style={{ background: '#2b51b1', position: 'relative' }}>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: '20px', color: 'white' }}>
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </span>
                  <h3 className="text-lg font-bold text-white">{t('changePassword')}</h3>
                </div>
                <button
                  type="button"
                  onClick={handleCloseEditProfile}
                  style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: isRtl ? 'auto' : '12px', left: isRtl ? '12px' : 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'white', padding: '4px' }}
                  aria-label={t('close')}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <form onSubmit={handleEditProfile} className="p-4">
                {/* Clickable Profile Picture */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                  <div
                    onClick={() => document.getElementById('photo-input')?.click()}
                    style={{ cursor: 'pointer', position: 'relative' }}
                  >
                    {editFormData.photo ? (
                      <img
                        src={editFormData.photo}
                        alt={t('profile')}
                        style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #3b82f6', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}
                      />
                    ) : (
                      <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', color: 'white', fontWeight: 'bold', border: '3px solid #3b82f6', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>
                        {user?.username?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ position: 'absolute', bottom: '0', right: '0', width: '36px', height: '36px', background: '#3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                        <circle cx="12" cy="13" r="4"></circle>
                      </svg>
                    </div>
                  </div>
                  <input
                    type="file"
                    id="photo-input"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
                        if (!validTypes.includes(file.type)) {
                          show('error', t('error'), t('imageTypeNotSupported'));
                          e.target.value = '';
                          return;
                        }
                        setSelectedPhotoFile(file);
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setEditFormData({ ...editFormData, photo: reader.result as string });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </div>

                {/* Full Name field */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('fullName')}</label>
                  <input
                    type="text"
                    value={editFormData.fullName}
                    onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                  />
                </div>

                {/* Two fields in one row */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="username" style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>{t('username')}</label>
                    <input
                      type="text"
                      id="username"
                      value={editFormData.username}
                      onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                      required
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="email" style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>{t('email')}</label>
                    <input
                      type="email"
                      id="email"
                      value={editFormData.email}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="oldPassword" style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>{t('currentPassword')}</label>
                    <div className="relative">
                      <input
                        type={showOldPassword ? 'text' : 'password'}
                        id="oldPassword"
                        value={editFormData.oldPassword}
                        onChange={(e) => {
                          setEditFormData({ ...editFormData, oldPassword: e.target.value });
                          setOldPasswordError('');
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                        placeholder={t('enterCurrentPassword')}
                        style={{ paddingRight: isRtl ? '12px' : '40px', paddingLeft: isRtl ? '40px' : '12px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowOldPassword(!showOldPassword)}
                        className="absolute top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        style={{ right: isRtl ? 'auto' : '12px', left: isRtl ? '12px' : 'auto', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        {showOldPassword ? (
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        ) : (
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        )}
                      </button>
                    </div>
                    {oldPasswordError && (
                      <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{oldPasswordError}</p>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="newPassword" style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>{t('newPassword')}</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        id="newPassword"
                        value={editFormData.newPassword}
                        onChange={(e) => setEditFormData({ ...editFormData, newPassword: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                        placeholder={t('enterNewPassword')}
                        minLength={8}
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
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={handleCloseEditProfile}
                    className="w-24 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 font-medium text-sm flex items-center justify-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-24 px-3 py-2 text-white rounded-lg hover:opacity-90 transition-all duration-200 shadow-md font-medium text-sm flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: '#2b51b1' }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {isSubmitting ? t('submitting') : t('save')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
    <ToastContainer />
    </>
  );
}
