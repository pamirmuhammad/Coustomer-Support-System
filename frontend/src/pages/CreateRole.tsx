import { useEffect, useState, useRef } from 'react';
import { roleAPI, extractArrayData } from '../services/api';
import { useSimpleToast } from '../components/SimpleToast';
import SkeletonLoader from '../components/SkeletonLoader';
import { useTranslation } from 'react-i18next';
import '../components/CommentModal.css';

interface Role {
  id: number;
  name: string;
  description?: string;
  createdAt?: string;
}

// CreateRole — CRUD management for user roles with pagination
export default function CreateRole() {
  const { show, ToastContainer } = useSimpleToast();
  const { t } = useTranslation();
  // Role data and loading state
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  // Modal visibility flags
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  // Form fields for creating/editing a role
  const [formData, setFormData] = useState({ name: '', description: '' });
  // Pagination state
  const [modalMessage, setModalMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  // Submission and deletion loading flags
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loaded = useRef(false);

  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      loadRoles().catch(() => {});
    }
  }, []);

  // Fetch all roles and sort newest-first
  const loadRoles = async () => {
    try {
      const response = await roleAPI.getAll();
      const sortedRoles = extractArrayData<Role>(response.data).sort((a, b) => b.id - a.id);
      setRoles(sortedRoles);
    } finally {
      setLoading(false);
    }
  };

  // Create or update a role via the API
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setModalMessage(t('roleNameRequired'));
      return;
    }
    
    setIsSubmitting(true);
    try {
      if (editingRole) {
        await roleAPI.update(editingRole.id, { name: formData.name.trim(), description: formData.description.trim() });
      } else {
        await roleAPI.create({ name: formData.name.trim(), description: formData.description.trim() });
      }
      await loadRoles();
      show('success', t('success'), editingRole ? t('roleUpdatedSuccessfully') : t('roleAddedSuccessfully'));
      setShowModal(false);
      setEditingRole(null);
      setFormData({ name: '', description: '' });
      setModalMessage('');
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      let errorMsg = t('operationFailedCheckConnection');
      
      if (err.response) {
        if (err.response.status === 403 || err.response.status === 409) {
          errorMsg = t('roleAlreadyExists');
        } else if (err.response.data?.message) {
          errorMsg = err.response.data.message;
        } else {
          errorMsg = err.message || t('operationFailed');
        }
      }
      
      setModalMessage(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Populate form with role data for editing
  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({ name: role.name, description: role.description || '' });
    setShowModal(true);
  };

  // Open delete confirmation modal
  const handleDelete = (role: Role) => {
    setSelectedRole(role);
    setShowDeleteModal(true);
  };

  // Confirm and execute role deletion
  const handleDeleteConfirm = async () => {
    if (!selectedRole) return;

    setIsDeleting(true);
    try {
      await roleAPI.delete(selectedRole.id);
      show('success', t('success'), t('roleDeletedSuccessfully'));
      setShowDeleteModal(false);
      setSelectedRole(null);
      loadRoles();
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
      setSelectedRole(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Close modal and reset form
  const handleCancel = () => {
    setShowModal(false);
    setEditingRole(null);
    setFormData({ name: '', description: '' });
    setModalMessage('');
  };

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = roles.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(roles.length / itemsPerPage);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handlePageClick = (page: number) => {
    setCurrentPage(page);
  };

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
        {/* Roles Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-5 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md flex items-center justify-center shrink-0">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-gray-800">{t('roleManagement')}</h2>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setEditingRole(null);
                    setFormData({ name: '', description: '' });
                    setModalMessage('');
                    setShowModal(true);
                  }}
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
                    minWidth: '160px',
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
                  {t('addRole')}
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="w-full overflow-x-auto" style={{ overflowX: 'auto' }}>
            <div className="overflow-y-auto" style={{ maxHeight: '520px' }}>
              <table className="w-full" style={{ tableLayout: 'fixed', minWidth: '700px' }}>
                <thead className="bg-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider whitespace-nowrap" style={{ width: '15%' }}>{t('roleId')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider" style={{ width: '40%' }}>{t('roleName')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider" style={{ width: '40%' }}>{t('description')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider" style={{ width: '30%' }}>{t('createdAt')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider" style={{ width: '15%' }}>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <div className="text-center">
                          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                          </svg>
                          <p className="text-gray-500">{t('noRolesFoundAdd')}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentItems.map((role, index) => (
                      <tr key={role.id} className="border-b border-gray-300 hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap text-center">
                          <span className="text-sm font-semibold text-gray-900">{indexOfFirstItem + index + 1}</span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-center">
                          <span className="text-sm font-medium text-gray-900">{role.name}</span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className="text-sm font-semibold text-gray-900" style={{ overflowWrap: 'break-word' }}>{role.description || '-'}</span>
                        </td>
                        <td className="px-4 py-2 whitespace-normal sm:whitespace-nowrap text-center">
                          <span className="text-sm font-medium text-gray-900">
                            {role.createdAt ? new Date(role.createdAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : t('notAvailable')}
                          </span>
                        </td>
                       <td className="px-4 py-2 whitespace-nowrap text-center shrink-0">
                          <div className="flex items-center justify-center gap-1">

                            <button
                              onClick={() => handleEdit(role)}
                              disabled={role.name === 'ADMIN' || role.name === 'MCIT Clients'}
                              className={`text-2xl hover:scale-110 transition-transform duration-200 shrink-0 ${role.name === 'ADMIN' || role.name === 'MCIT Clients' ? 'text-amber-200 cursor-not-allowed' : 'text-amber-600'}`}
                              title={t('edit')}
                              aria-label={t('edit')}
                            >
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.586-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.414-8.586z" /></svg>

                            </button>
                            <button
                              onClick={() => handleDelete(role)}
                              disabled={role.name === 'ADMIN' || role.name === 'MCIT Clients'}
                              className={`text-2xl hover:scale-110 transition-transform duration-200 shrink-0 ${role.name === 'ADMIN' || role.name === 'MCIT Clients' ? 'text-red-200 cursor-not-allowed' : 'text-red-600'}`}
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
          {roles.length > 0 && (
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
                  {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, roles.length)} {t('of')} {roles.length} {t('items')}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-transparent overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-auto animate-fadeIn">
            <div className="px-4 py-3 rounded-t-2xl" style={{ background: '#2b51b1', position: 'relative' }}>
              <div className="flex items-center gap-2">
                {editingRole ? (
            <span style={{ fontSize: '20px', color: 'white' }}><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.586-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.414-8.586z" /></svg></span>
                ) : (
                  <span style={{ fontSize: '20px', color: 'white' }}><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></span>
                )}
                <h3 className="text-lg font-bold text-white">{editingRole ? t('editRole') : t('addRole')}</h3>
              </div>
              <button className="comment-modal-close" onClick={handleCancel} aria-label={t('close')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4">
              {modalMessage && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm">{modalMessage}</p>
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('roleName')} *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('enterRoleName')}
                  required
                  autoFocus
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('description')}</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('enterRoleDescription')}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="min-w-24 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 font-medium text-sm flex items-center justify-center gap-1 shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-w-24 shrink-0 px-3 py-2 text-white rounded-lg hover:opacity-90 transition-all duration-200 shadow-md font-medium text-sm flex items-center justify-center gap-1 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#2b51b1' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {isSubmitting ? (editingRole ? t('updating') : t('saving')) : (editingRole ? t('update') : t('save'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedRole && (
        <div className="fixed inset-0 bg-transparent overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-auto animate-fadeIn">
            <div className="px-4 py-3 rounded-t-2xl" style={{ background: '#dc2626', position: 'relative' }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: '20px', color: 'white' }}><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-7 0h8" /></svg></span>
                <h3 className="text-lg font-bold text-white">{t('deleteRole')}</h3>
              </div>
              <button className="comment-modal-close" onClick={() => { setShowDeleteModal(false); setSelectedRole(null); }} aria-label={t('close')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="p-4 text-center">
              <div className="mb-4">
              </div>
              <p className="text-gray-600 mb-2">{t('confirmDeleteRole')}</p>
              <div className="font-semibold text-gray-900 mb-2">
                "{selectedRole.name}"
              </div>
              <p className="text-sm text-gray-500 mb-6">{t('actionCannotBeUndone')}</p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedRole(null);
                  }}
                  className="min-w-24 px-3 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all duration-200 font-medium text-sm flex items-center justify-center gap-1 shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {t('cancel')}
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="min-w-24 shrink-0 px-3 py-2 text-white rounded-lg hover:opacity-90 transition-all duration-200 shadow-md font-medium text-sm flex items-center justify-center gap-1 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#dc2626' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {isDeleting ? t('deleting') : t('delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

          </div>
  );
}
