import { useEffect, useState, useRef } from 'react';
import { userAPI, roleAPI, organizationAPI, API_BASE_URL, extractArrayData } from '../services/api';
import { apiCache } from '../utils/apiCache';
import { useSimpleToast } from '../components/SimpleToast';
import SkeletonLoader from '../components/SkeletonLoader';
import { useTranslation } from 'react-i18next';
import '../components/CommentModal.css';

interface User {
  id: number;
  username: string;
  email: string;
  fullName?: string;
  phone?: string;
  role?: string;
  roleId?: number;
  organization?: string;
  organizationId?: number;
  active: boolean;
  photo?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Role {
  id: number;
  name: string;
}

interface Organization {
  id: number;
  name: string;
}

// CreateUser — CRUD management for user accounts with search, pagination, and photo upload
export default function CreateUser() {
  const { show, ToastContainer } = useSimpleToast();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'fa' || i18n.language === 'ps';
  // Lists fetched from API
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  // Modal visibility flags
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [viewUser, setViewUser] = useState<User | null>(null);
  // Search and form data
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    oldPassword: '',
    roleId: '',
    organizationId: '',
    active: true,
    photo: '' as string
  });
  // Password field visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [, setShowOldPassword] = useState(false);
  const [, setOldPasswordError] = useState('');
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  // Organization and role search/dropdown state
  const [orgSearch, setOrgSearch] = useState('');
  const [roleSearch, setRoleSearch] = useState('');
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  // Validation and submission state
  const [emailError, setEmailError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showToggleActiveModal, setShowToggleActiveModal] = useState(false);
  const [isTogglingActive, setIsTogglingActive] = useState(false);
  // Photo file for upload
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);

  const loaded = useRef(false);

  useEffect(() => {
    const doInitialLoad = () => {
      loaded.current = true;
      loadUsers().catch(() => {});
      loadRoles().catch(() => {});
      loadOrganizations().catch(() => {});
    };

    if (!loaded.current) {
      doInitialLoad();
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        apiCache.invalidate('users');
        apiCache.invalidate('roles');
        apiCache.invalidate('organizations');
        loadUsers().catch(() => {});
        loadRoles().catch(() => {});
        loadOrganizations().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Fetch users, roles, and orgs on mount
  const loadUsers = async () => {
    try {
      const response = await userAPI.getAll();
      const sortedUsers = extractArrayData<User>(response.data).sort((a, b) => b.id - a.id);
      setUsers(sortedUsers);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all roles
  const loadRoles = async () => {
    try {
      const response = await roleAPI.getAll();
      setRoles(extractArrayData<Role>(response.data));
    } catch (error) {
    }
  };

  // Fetch all organizations
  const loadOrganizations = async () => {
    try {
      const response = await organizationAPI.getAll();
      setOrganizations(extractArrayData<Organization>(response.data));
    } catch (error) {
    }
  };



  // Create or update a user with validation, photo upload, and error handling
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.email.trim()) {
      show('error', t('error'), t('pleaseEnterUsernameAndEmail'));
      return;
    }

    // Validate password length
    if (!editingUser && formData.password && formData.password.length < 8) {
      show('error', t('error'), t('passwordMinLength'));
      return;
    }

    // Validate password match
    if (!editingUser && formData.password !== formData.confirmPassword) {
      show('error', t('error'), t('passwordsDoNotMatch'));
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingUser) {
        let photoUrl = formData.photo || undefined;

        if (selectedPhotoFile) {
          const uploadRes = await userAPI.updateProfilePicture(editingUser.id, selectedPhotoFile);
          photoUrl = uploadRes.data?.url || uploadRes.data?.photo || uploadRes.data || photoUrl;
          if (photoUrl && !photoUrl.startsWith('data:') && !photoUrl.startsWith('http')) {
            photoUrl = API_BASE_URL + photoUrl;
          }
        } else if (formData.photo && !formData.photo.startsWith('data:image/')) {
          photoUrl = formData.photo;
        } else {
          photoUrl = undefined;
        }

        const updatePayload: {
          fullName?: string; username: string; email: string; phone?: string;
          roleId?: number; organizationId?: number; active?: boolean; photo?: string
        } = {
          fullName: formData.fullName.trim(),
          username: formData.username.trim(),
          email: formData.email.trim(),
          phone: formData.phone,
          roleId: formData.roleId ? parseInt(formData.roleId) : undefined,
          organizationId: formData.organizationId ? parseInt(formData.organizationId) : undefined,
          active: formData.active
        };
          if (photoUrl !== undefined) updatePayload.photo = photoUrl;

        await userAPI.update(editingUser.id, updatePayload);
      } else {
        if (!formData.password) {
          show('error', t('error'), t('pleaseEnterPassword'));
          return;
        }
        await userAPI.create({
          fullName: formData.fullName.trim(),
          username: formData.username.trim(),
          email: formData.email.trim(),
          phone: formData.phone,
          password: formData.password,
          roleId: formData.roleId ? parseInt(formData.roleId) : undefined,
          organizationId: formData.organizationId ? parseInt(formData.organizationId) : undefined,
          active: formData.active,
          photo: formData.photo || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSI+PHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTIgMTJaIiBmaWxsPSIjOUNBM0FGIi8+PHBhdGggZD0iTTEyIDE0QzcuNTkgMTQgNCAxNy41OSA0IDIySDIwQzIwIDE3LjU5IDE2LjQxIDE0IDEyIDE0WiIgZmlsbD0iIzlDQTNBRiIvPjwvc3ZnPg=='
        });
      }
      await loadUsers();
      show('success', t('success'), editingUser ? t('userUpdatedSuccessfully') : t('userAddedSuccessfully'));
      setShowModal(false);
      setEditingUser(null);
      setFormData({ fullName: '', username: '', email: '', phone: '', password: '', confirmPassword: '', oldPassword: '', roleId: '', organizationId: '', active: true, photo: '' });
      setSelectedPhotoFile(null);
      setShowPassword(false);
      setShowConfirmPassword(false);
      setShowOldPassword(false);
      setOldPasswordError('');
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      let errorMsg = t('operationFailedCheckConnection');
        if (err.response) {
        if (err.response.status === 409) {
          errorMsg = t('userAlreadyExists');
        } else if (err.response.status === 403) {
          errorMsg = err.response.data?.message || t('operationFailed');
        } else if (err.response.data?.message) {
          errorMsg = err.response.data.message;
        } else {
          errorMsg = err.message || t('operationFailed');
        }
      }
      show('error', t('error'), errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Populate form with user data for editing
  const handleEdit = (user: User) => {
    setEditingUser(user);
    setSelectedPhotoFile(null);
    setFormData({
      fullName: user.fullName || '',
      username: user.username,
      email: user.email,
      phone: user.phone || '',
      password: '',
      confirmPassword: '',
      oldPassword: '',
      roleId: user.roleId?.toString() || '',
      organizationId: user.organizationId?.toString() || '',
      active: user.active,
      photo: user.photo || ''
    });
    setOrgSearch(user.organization || '');
    setRoleSearch(user.role || '');
    setEmailError('');
    setShowModal(true);
  };

  // Open delete confirmation modal
  const handleDelete = (user: User) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

// Open toggle-active confirmation modal
const handleToggleActiveClick = (user: User) => {
  setSelectedUser(user);
  setShowToggleActiveModal(true);
};

// Toggle user active/inactive status
const handleToggleActiveConfirm = async () => {
  if (!selectedUser) return;
  setIsTogglingActive(true);
  try {
    await userAPI.update(selectedUser.id, {
      username: selectedUser.username,
      email: selectedUser.email,
      active: !selectedUser.active,
      roleId: selectedUser.roleId,
      organizationId: selectedUser.organizationId
    });
    await loadUsers();
    show('success', t('success'), selectedUser.active ? t('userDeactivated') : t('userActivated'));
    setShowToggleActiveModal(false);
    setSelectedUser(null);
  } catch (error: unknown) {
    show('error', t('error'), t('failedToToggleStatus'));
  } finally {
    setIsTogglingActive(false);
  }
};

  // Confirm and execute user deletion with error parsing
  const handleDeleteConfirm = async () => {
    if (!selectedUser) return;

    setIsDeleting(true);
    try {
      await userAPI.delete(selectedUser.id);
      show('success', t('success'), t('userDeletedSuccessfully'));
      setShowDeleteModal(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error: unknown) {
      const err = error as { response?: { data?: unknown } };
      let message = t('deleteFailed');
      const responseData = err.response?.data;
      
      if (responseData && typeof responseData === 'object') {
        message = (responseData as { message?: string }).message || t('deleteFailed');
      } else if (typeof responseData === 'string') {
        try {
          const parsed = JSON.parse(responseData);
          message = parsed.message || responseData;
        } catch {
          message = responseData;
        }
      }
      
      // Remove any status code prefix if present
      message = message.replace(/^\d+\s+[A-Z_]+\s*/i, '').trim();
      
      show('error', t('error'), message);
      setShowDeleteModal(false);
      setSelectedUser(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Close user modal and reset all form fields
  const handleCancel = () => {
    setShowModal(false);
    setEditingUser(null);
    setSelectedPhotoFile(null);
    setFormData({ fullName: '', username: '', email: '', phone: '', password: '', confirmPassword: '', oldPassword: '', roleId: '', organizationId: '', active: true, photo: '' });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setShowOldPassword(false);
    setOldPasswordError('');
    setOrgSearch('');
    setRoleSearch('');
    setEmailError('');
  };

  // Open modal in add mode with empty form
  const openAddModal = () => {
    setEditingUser(null);
    setSelectedPhotoFile(null);
    setFormData({ fullName: '', username: '', email: '', phone: '', password: '', confirmPassword: '', oldPassword: '', roleId: '', organizationId: '', active: true, photo: '' });
    setOrgSearch('');
    setRoleSearch('');
    setShowModal(true);
  };

  // Open view-only user details modal
  const handleView = (user: User) => {
    setViewUser(user);
    setShowViewModal(true);
  };

  // Close view-only user details modal
  const closeViewModal = () => {
    setShowViewModal(false);
    setViewUser(null);
  };

  // Validate email format on blur
  const handleEmailBlur = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      setEmailError(t('pleaseEnterValidEmail'));
    } else {
      setEmailError('');
    }
  };

  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
  (user.role && user.role.toLowerCase().includes(searchQuery.toLowerCase())) ||
  (user.organization && user.organization.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredOrgs = organizations.filter((org) =>
    org.name.toLowerCase().includes(orgSearch.toLowerCase())
  );

  const filteredRoles = roles.filter((role) =>
    role.name.toLowerCase().includes(roleSearch.toLowerCase())
  );

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  // Go to next page
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  // Go to previous page
  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  };

  // Jump to specific page
  const handlePageClick = (page: number) => {
    setCurrentPage(page);
  };

  // Build page number list with ellipsis for large pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  if (loading) {
    return <SkeletonLoader type="table" />;
  }

  return (
    <div className="min-h-screen flex flex-col overflow-y-auto">
      <ToastContainer />
      {/* Main Content */}
      <div className="w-full px-2 py-2 overflow-x-auto">
        {/* Users Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-5 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md flex items-center justify-center shrink-0">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-gray-800">{t('userManagement')}</h2>
              </div>
              <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap w-full sm:w-auto">
                <input
                  type="text"
                  placeholder={t('searchUsers')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-4 pr-4 py-2.5 rounded-lg border-2 outline-none text-sm text-gray-700 w-full sm:w-48 transition-all duration-200"
                  style={{
                    background: '#ffffff',
                    border: '2px solid #2b51b1'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.border = '2px solid #2b51b1';
                    e.currentTarget.style.color = '#1e293b';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.border = '2px solid #2b51b1';
                    e.currentTarget.style.color = '#1e293b';
                  }}
                />
                <button
                  onClick={openAddModal}
                  style={{
                    appearance: 'none',
                    padding: '12px 18px',
                    borderRadius: '12px',
                    border: '2px solid transparent',
                    background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%) padding-box, #2b51b1 border-box',
                    fontSize: '14px',
                    color: '#1e293b',
                    cursor: 'pointer',
                    outline: 'none',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15), inset 0 1px 0 rgba(255,255,255,0.8)',
                    fontWeight: 600,
                    minWidth: '200px',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#2b51b1';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%) padding-box, #2b51b1 border-box';
                    e.currentTarget.style.color = '#1e293b';
                  }}
                >
                  <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t('addUser')}
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="w-full">
            <div className="overflow-y-auto" style={{ maxHeight: '520px' }}>
              <table className="w-full" style={{ minWidth: '800px' }}>
                <thead className="bg-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider">{t('userId')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider">{t('username')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider">{t('email')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider">{t('role')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider">{t('organization')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="text-center">
                          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                          </svg>
                          <p className="text-gray-500">{searchQuery ? t('noUsersFoundSearch') : t('noUsersFoundAdd')}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentItems.map((user, index) => (
                      <tr key={user.id} className="border-b border-gray-300 hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap text-center">
                          <span className="text-sm font-semibold text-gray-900">{indexOfFirstItem + index + 1}</span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-center">
                          <span className="text-sm font-semibold text-gray-900">{user.username}</span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-center">
                          <span className="text-sm font-semibold text-gray-900">{user.email || '-'}</span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-center">
                          <span className="text-sm font-semibold text-gray-900">{user.role || '-'}</span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-center">
                          <span className="text-sm font-semibold text-gray-900">{user.organization || '-'}</span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-center shrink-0">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleView(user)}
                              className="text-2xl hover:scale-110 transition-transform duration-200 text-slate-600 shrink-0"
                              title={t('view')}
                              aria-label={t('view')}
                            >
                              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            </button>
                            <button
                              onClick={() => handleEdit(user)}
                              disabled={user.username === 'admin'}
                              className={`text-2xl hover:scale-110 transition-transform duration-200 shrink-0 ${user.username === 'admin' ? 'text-amber-200 cursor-not-allowed' : 'text-amber-600'}`}
                              title={user.username === 'admin' ? t('cannotEditAdmin') || 'Cannot edit admin user' : t('edit')}
                              aria-label={t('edit')}
                            >
                              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.586-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.414-8.586z" /></svg>
                            </button>
                            <button
                              onClick={() => handleToggleActiveClick(user)}
                              disabled={user.username === 'admin'}
                              className={`text-2xl hover:scale-110 transition-transform duration-200 shrink-0 ${user.username === 'admin' ? (user.active ? 'text-green-200' : 'text-gray-300') + ' cursor-not-allowed' : user.active ? 'text-green-500' : 'text-gray-400'}`}
                              title={user.username === 'admin' ? t('cannotToggleAdminStatus') || 'Cannot change admin status' : (user.active ? t('deactivate') : t('activate'))}
                              aria-label={user.active ? t('deactivate') : t('activate')}
                            >
                              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </button>
                            <button
                              onClick={() => handleDelete(user)}
                              disabled={user.username === 'admin'}
                              className={`text-2xl hover:scale-110 transition-transform duration-200 shrink-0 ${user.username === 'admin' ? 'text-red-200 cursor-not-allowed' : 'text-red-600'}`}
                              title={t('delete')}
                              aria-label={t('delete')}
                            >
                              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-7 0h8" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {filteredUsers.length > 0 && (
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-t border-gray-100">
              <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-1 sm:px-2 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed hidden sm:inline-flex"
                >
                  {'<<'}
                </button>
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className="px-1 sm:px-2 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {'<'}
                </button>
                {getPageNumbers().map((page, index) => (
                  page === '...' ? (
                    <span key={`ellipsis-${index}`} className="text-gray-400 px-1 sm:px-2">...</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => handlePageClick(page as number)}
                      className={`px-1.5 sm:px-2 py-1 text-xs sm:text-sm rounded-full ${
                        currentPage === page
                          ? 'text-white'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      style={currentPage === page ? { background: '#2b51b1' } : {}}
                    >
                      {page}
                    </button>
                  )
                ))}
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="px-1 sm:px-2 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {'>'}
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-1 sm:px-2 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed hidden sm:inline-flex"
                >
                  {'>>'}
                </button>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    const newItemsPerPage = Number(e.target.value);
                                  setItemsPerPage(newItemsPerPage);
                    setCurrentPage(1);
                  }}
                  className="px-1 sm:px-2 py-1 border border-gray-300 rounded text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                  <option value={25}>25</option>
                  <option value={30}>30</option>
                  <option value={35}>35</option>
                  <option value={40}>40</option>
                  <option value={45}>45</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-xs sm:text-sm text-gray-700 whitespace-nowrap">
                  {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredUsers.length)} {t('of')} {filteredUsers.length} {t('items')}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-transparent overflow-y-auto h-full w-full z-[1001] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-auto animate-fadeIn">
            <div className="px-4 py-3 rounded-t-2xl" style={{ background: '#2b51b1', position: 'relative' }}>
              <div className="flex items-center gap-2">
                {editingUser ? (
                  <span style={{ fontSize: '20px', color: 'white' }}><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.586-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.414-8.586z" /></svg></span>
                ) : (
                  <span style={{ fontSize: '20px', color: 'white' }}><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></span>
                )}
                <h3 className="text-lg font-bold text-white">{editingUser ? t('editUser') : t('addUser')}</h3>
              </div>
              <button className="comment-modal-close" onClick={handleCancel} aria-label={t('close')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4" autoComplete="off">
              {/* Clickable Profile Picture */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <div
                  onClick={() => document.getElementById('createuser-photo-input')?.click()}
                  style={{ cursor: 'pointer', position: 'relative' }}
                >
                  {formData.photo ? (
                    <img
                      src={formData.photo}
                      alt={t('profile')}
                      style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #3b82f6', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}
                    />
                  ) : (
                    <img
                      src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSI+PHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTIgMTJaIiBmaWxsPSIjOUNBM0FGIi8+PHBhdGggZD0iTTEyIDE0QzcuNTkgMTQgNCAxNy41OSA0IDIySDIwQzIwIDE3LjU5IDE2LjQxIDE0IDEyIDE0WiIgZmlsbD0iIzlDQTNBRiIvPjwvc3ZnPg=="
                      alt={t('defaultAvatar')}
                      style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #3b82f6', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}
                    />
                  ) }
                  <div style={{ position: 'absolute', bottom: '0', right: '0', width: '36px', height: '36px', background: '#3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                      <circle cx="12" cy="13" r="4"></circle>
                    </svg>
                  </div>
                </div>
                <input
                  type="file"
                  id="createuser-photo-input"
                  accept="image/png,image/jpeg,image/gif"
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
                        setFormData({ ...formData, photo: reader.result as string });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </div>

              {/* Row 1: Full Name & Username */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>{t('fullName')} *</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder={t('Enter Full Name')}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>{t('username')} *</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder={t('Enter User Name')}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                  />
                </div>
              </div>

              {/* Row 2: Email & Phone */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>{t('email')} *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => { setFormData({ ...formData, email: e.target.value }); if (emailError) setEmailError(''); }}
                    onBlur={handleEmailBlur}
                    placeholder={t('Enter Email')}
                    required
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 ${emailError ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {emailError && <p className="text-red-500 text-xs mt-1">{emailError}</p>}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>{t('phone')}</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9+]/g, '').slice(0, 15);
                        setFormData({ ...formData, phone: val });
                      }}
                      placeholder={t('enterPhone')}
                      autoComplete="off"
                      className="w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      style={{ padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box', color: '#1e293b', textAlign: isRTL ? 'right' : 'left' }}
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Password & Confirm Password (only for new users) */}
              {!editingUser && (
                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>{t('password')} *</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder={t('enterPassword')}
                        required
                        autoComplete="new-password"
                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 ${isRTL ? 'pl-10' : 'pr-10'}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={`absolute top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 ${isRTL ? 'left-3' : 'right-3'}`}
                      >
                        {showPassword ? (
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        ) : (
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>{t('confirmPassword')} *</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        placeholder={t('confirmPassword')}
                        required
                        autoComplete="new-password"
                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 ${isRTL ? 'pl-10' : 'pr-10'}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className={`absolute top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 ${isRTL ? 'left-3' : 'right-3'}`}
                      >
                        {showConfirmPassword ? (
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        ) : (
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Row 4: Organization and Role */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>{t('organization')} *</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={t('searchOrganizations')}
                      value={orgSearch}
                      onChange={(e) => { setOrgSearch(e.target.value); setShowOrgDropdown(true); }}
                      onFocus={() => setShowOrgDropdown(true)}
                      onBlur={() => setTimeout(() => setShowOrgDropdown(false), 200)}
                      className="w-full border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                      style={{ padding: '10px 12px', fontSize: '14px', color: '#1e293b', transition: 'border-color 0.2s' }}
                    />
                    {showOrgDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
                        {filteredOrgs.length > 0 ? filteredOrgs.map((org) => (
                          <div
                            key={org.id}
                            className={`px-3 py-2 cursor-pointer text-sm transition-colors ${formData.organizationId === org.id.toString() ? 'font-semibold' : ''}`}
                            style={{ color: formData.organizationId === org.id.toString() ? '#1d4ed8' : '#000000', backgroundColor: formData.organizationId === org.id.toString() ? '#dbeafe' : 'transparent' }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2b51b1'; e.currentTarget.style.color = '#ffffff'; }}
                            onMouseLeave={(e) => {
                              const isSelected = formData.organizationId === org.id.toString();
                              e.currentTarget.style.backgroundColor = isSelected ? '#dbeafe' : 'transparent';
                              e.currentTarget.style.color = isSelected ? '#1d4ed8' : '#000000';
                            }}
                            onMouseDown={() => {
                              setFormData({ ...formData, organizationId: org.id.toString() });
                              setOrgSearch(org.name);
                              setShowOrgDropdown(false);
                            }}
                          >
                            {org.name}
                          </div>
                        )) : (
                          <div className="px-3 py-2 text-sm text-gray-500">{t('noOrganizationsMatch')}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>{t('role')} *</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={t('searchRoles')}
                      value={roleSearch}
                      onChange={(e) => { setRoleSearch(e.target.value); setShowRoleDropdown(true); }}
                      onFocus={() => setShowRoleDropdown(true)}
                      onBlur={() => setTimeout(() => setShowRoleDropdown(false), 200)}
                      className="w-full border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                      style={{ padding: '10px 12px', fontSize: '14px', color: '#1e293b', transition: 'border-color 0.2s' }}
                    />
                    {showRoleDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
                        {filteredRoles.length > 0 ? filteredRoles.map((role) => (
                          <div
                            key={role.id}
                            className={`px-3 py-2 cursor-pointer text-sm transition-colors ${formData.roleId === role.id.toString() ? 'font-semibold' : ''}`}
                            style={{ color: formData.roleId === role.id.toString() ? '#1d4ed8' : '#000000', backgroundColor: formData.roleId === role.id.toString() ? '#dbeafe' : 'transparent' }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2b51b1'; e.currentTarget.style.color = '#ffffff'; }}
                            onMouseLeave={(e) => {
                              const isSelected = formData.roleId === role.id.toString();
                              e.currentTarget.style.backgroundColor = isSelected ? '#dbeafe' : 'transparent';
                              e.currentTarget.style.color = isSelected ? '#1d4ed8' : '#000000';
                            }}
                            onMouseDown={() => {
                              setFormData({ ...formData, roleId: role.id.toString() });
                              setRoleSearch(role.name);
                              setShowRoleDropdown(false);
                            }}
                          >
                            {role.name}
                          </div>
                        )) : (
                          <div className="px-3 py-2 text-sm text-gray-500">{t('noRolesMatch')}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit and Cancel Buttons */}
              <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="min-w-24 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 font-medium text-sm flex items-center justify-center gap-1 shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-w-24 shrink-0 px-3 py-2 text-white rounded-lg hover:opacity-90 transition-all duration-200 shadow-md font-medium text-sm flex items-center justify-center gap-1 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#2b51b1' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {isSubmitting ? t('submitting') : (editingUser ? t('update') : t('save'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toggle Active Confirmation Modal */}
      {showToggleActiveModal && selectedUser && (
        <div className="fixed inset-0 bg-transparent overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-auto animate-fadeIn">
            <div className="px-4 py-3 rounded-t-2xl" style={{ background: '#2b51b1', position: 'relative' }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: '20px', color: 'white' }}>
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                <h3 className="text-lg font-bold text-white">{selectedUser.active ? t('deactivate') : t('activate')}</h3>
              </div>
              <button className="comment-modal-close" onClick={() => { setShowToggleActiveModal(false); setSelectedUser(null); }} aria-label={t('close')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="p-4 text-center">
              <div className="mb-4"></div>
              <p className="text-gray-600 mb-2">{selectedUser.active ? t('confirmDeactivateUser') : t('confirmActivateUser')}</p>
              <div className="font-semibold text-gray-900 mb-2">
                "{selectedUser.username}"
              </div>
              <p className="text-sm text-gray-500 mb-6">{t('actionCannotBeUndone')}</p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowToggleActiveModal(false);
                    setSelectedUser(null);
                  }}
                  className="w-24 px-3 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all duration-200 font-medium text-sm flex items-center justify-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  {t('cancel')}
                </button>
                <button
                  onClick={handleToggleActiveConfirm}
                  disabled={isTogglingActive}
                  className="min-w-24 shrink-0 px-3 py-2 text-white rounded-lg hover:opacity-90 transition-all duration-200 shadow-md font-medium text-sm flex items-center justify-center gap-1 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#2b51b1' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {selectedUser.active ? t('deactivate') : t('activate')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

     {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-transparent overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-auto animate-fadeIn">
            {/* Red Danger Header */}
            <div className="px-4 py-3 rounded-t-2xl" style={{ background: '#dc2626', position: 'relative' }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: '20px', color: 'white' }}><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-7 0h8" /></svg></span>
                <h3 className="text-lg font-bold text-white">{t('deleteUser')}</h3>
              </div>
              <button className="comment-modal-close" onClick={() => { setShowDeleteModal(false); if (typeof setSelectedUser === 'function') setSelectedUser(null); }} aria-label={t('close')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {/* Centered Content Body */}
            <div className="p-4 text-center">
              <div className="mb-4"></div>
              <p className="text-gray-600 mb-2">{t('confirmDeleteUser')}</p>
              <div className="font-semibold text-gray-900 mb-2">
                "{selectedUser.username}"
              </div>
              <p className="text-sm text-gray-500 mb-6">{t('actionCannotBeUndone')}</p>

              {/* Centered Action Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    if (typeof setSelectedUser === 'function') setSelectedUser(null);
                  }}
                  className="min-w-24 px-3 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all duration-200 font-medium text-sm flex items-center justify-center gap-1 shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  {t('cancel')}
                  </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="min-w-24 shrink-0 px-3 py-2 text-white rounded-lg hover:opacity-90 transition-all duration-200 shadow-md font-medium text-sm flex items-center justify-center gap-1 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#dc2626' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  {isDeleting ? t('deleting') : t('delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    {/* View User Modal */}
      {showViewModal && viewUser && (
        <div className="fixed inset-0 bg-transparent overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-auto animate-fadeIn" style={{ minHeight: '400px' }}>
            <div className="px-4 py-3 rounded-t-2xl" style={{ background: '#2b51b1', position: 'relative' }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: '20px', color: 'white' }}><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg></span>
                <h3 className="text-lg font-bold text-white">{t('userDetails')}</h3>
              </div>
              <button className="comment-modal-close" onClick={closeViewModal} aria-label={t('close')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="p-4">
              {/* Profile Image & Status Header */}
              <div className="flex flex-col items-center mb-3">
                <img
                  src={viewUser.photo || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSI+PHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTIgMTJaIiBmaWxsPSIjOUNBM0FGIi8+PHBhdGggZD0iTTEyIDE0QzcuNTkgMTQgNCAxNy41OSA0IDIySDIwQzIwIDE3LjU5IDE2LjQxIDE0IDEyIDE0WiIgZmlsbD0iIzlDQTNBRiIvPjwvc3ZnPg=='}
                  alt={viewUser.username}
                  className="w-24 h-24 rounded-full border-4 border-blue-500 shadow-md object-cover mb-2"
                />
                <p className="text-lg font-semibold text-gray-900 mt-2">{viewUser.fullName || viewUser.username}</p>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold mt-1 ${viewUser.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {viewUser.active ? t('active') : t('inactive')}
                </span>
              </div>

              {/* Row 1: Full Name + Username */}
              <div className="flex gap-4 mb-4">
                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">{t('fullName')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">{viewUser.fullName || '-'}</p>
                </div>
                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">{t('username')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">{viewUser.username}</p>
                </div>
              </div>
              
              {/* Row 2: Email + Role */}
              <div className="flex gap-4 mb-4">
                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">{t('email')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">{viewUser.email || '-'}</p>
                </div>
                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">{t('role')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">{viewUser.role || '-'}</p>
                </div>
              </div>
              
              {/* Row 3: Phone + Organization */}
              <div className="flex gap-4 mb-4">
                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">{t('phone')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">{viewUser.phone || '-'}</p>
                </div>
                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">{t('organization')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">{viewUser.organization || '-'}</p>
                </div>
              </div>

              {/* Row 4: Created At + Last Modified */}
              <div className="flex gap-4 mb-2">
                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">{t('createdAt')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">
                    {viewUser.createdAt ? new Date(viewUser.createdAt).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                  </p>
                </div>
                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">{t('lastModified')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">
                    {viewUser.updatedAt ? new Date(viewUser.updatedAt).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={closeViewModal}
                  className="min-w-24 shrink-0 px-3 py-2 text-white rounded-lg hover:opacity-90 transition-all duration-200 shadow-md font-medium text-sm flex items-center justify-center gap-1 whitespace-nowrap"
                  style={{ background: '#2b51b1' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {t('close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
