import { useEffect, useState, useRef } from 'react';
import { organizationAPI, extractArrayData } from '../services/api';
import { useSimpleToast } from '../components/SimpleToast';
import SkeletonLoader from '../components/SkeletonLoader';
import { useTranslation } from 'react-i18next';
import '../components/CommentModal.css';

interface Organization {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  createdAt?: string;
}

// OrganizationManagement — CRUD for organizations with search, pagination, and stats view
export default function OrganizationManagement() {
  const { show, ToastContainer } = useSimpleToast();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'fa' || i18n.language === 'ps';
  // Organization data and loading state
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  // Modal visibility flags
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [viewOrg, setViewOrg] = useState<Organization | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [orgStats, setOrgStats] = useState<{ ticketCount: number; serviceCount: number } | null>(null);
  // Search, form data, and pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Fetch all organizations sorted newest-first
  const loadOrganizations = async () => {
    try {
      const response = await organizationAPI.getAll();
      const sortedOrgs = extractArrayData<Organization>(response.data).sort((a, b) => b.id - a.id);
      setOrganizations(sortedOrgs);
    } finally {
      setLoading(false);
    }
  };

  const loaded = useRef(false);

  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      loadOrganizations().catch(() => {});
    }
  }, []);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);



  // Create or update an organization with validation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      show('error', t('error'), t('pleaseEnterOrganizationName'));
      return;
    }

    // Validate name - allow letters, spaces, and common special characters
    const nameRegex = /^[a-zA-Z0-9\s\-+*&@#.,()/[\]{}'":;!?]+$/;
    if (!nameRegex.test(formData.name.trim())) {
      show('error', t('error'), t('organizationNameLettersOnly'));
      return;
    }

    // Validate phone - must be between 8 and 15 characters
    if (formData.phone.trim() && (formData.phone.trim().length < 8 || formData.phone.trim().length > 15)) {
      show('error', t('error'), t('phoneNumberMustBe9Digits'));
      return;
    }

    setIsSubmitting(true);
    try {
      const phoneToSave = formData.phone.trim();
      if (editingOrg) {
        await organizationAPI.update(editingOrg.id, {
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: phoneToSave,
          address: formData.address.trim()
        });
      } else {
        await organizationAPI.create({
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: phoneToSave,
          address: formData.address.trim()
        });
      }
      await loadOrganizations();
      show('success', t('success'), editingOrg ? t('organizationUpdatedSuccessfully') : t('organizationAddedSuccessfully'));
      setShowModal(false);
      setEditingOrg(null);
      setFormData({ name: '', email: '', phone: '', address: '' });
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      let errorMsg = t('operationFailedCheckConnection');
      if (err.response) {
        if (err.response.status === 403 || err.response.status === 409) {
          errorMsg = t('organizationAlreadyExists');
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

  // Populate form with org data for editing
  const handleEdit = (org: Organization) => {
    setEditingOrg(org);
    setFormData({
      name: org.name,
      email: org.email || '',
      phone: org.phone || '',
      address: org.address || '',
    });
    setShowModal(true);
  };

  // Open delete confirmation modal
  const handleDelete = (org: Organization) => {
    setSelectedOrg(org);
    setShowDeleteModal(true);
  };

  // Open view-only details modal and fetch org stats
  const handleView = (org: Organization) => {
    setViewOrg(org);
    setShowViewModal(true);
    organizationAPI.getStats(org.id).then(res => {
      setOrgStats(res.data);
    }).catch(() => {
      setOrgStats(null);
    });
  };

  // Close view details modal
  const closeViewModal = () => {
    setShowViewModal(false);
    setViewOrg(null);
    setOrgStats(null);
  };

  // Confirm and execute organization deletion
  const handleDeleteConfirm = async () => {
    if (!selectedOrg) return;

    setIsSubmitting(true);
    try {
      await organizationAPI.delete(selectedOrg.id);
      show('success', t('success'), t('organizationDeletedSuccessfully'));
      setShowDeleteModal(false);
      setSelectedOrg(null);
      loadOrganizations();
    } catch (error: unknown) {
      const err = error as { response?: { data?: unknown } };
      let errorMsg = t('deleteFailed');
      const responseData = err.response?.data;
      
      if (responseData && typeof responseData === 'object') {
        errorMsg = (responseData as { message?: string }).message || t('deleteFailed');
      } else if (typeof responseData === 'string') {
        try {
          const parsed = JSON.parse(responseData);
          errorMsg = parsed.message || responseData;
        } catch {
          errorMsg = responseData;
        }
      }
      
      errorMsg = errorMsg.replace(/^\d+\s+[A-Z_]+\s*/i, '').trim();
      
      show('error', t('error'), errorMsg);
      setShowDeleteModal(false);
      setSelectedOrg(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Close organization modal and reset form
  const handleCancel = () => {
    setShowModal(false);
    setEditingOrg(null);
    setFormData({ name: '', email: '', phone: '', address: '' });
  };

  // Open modal in add mode with empty form
  const openAddModal = () => {
    setEditingOrg(null);
    setFormData({ name: '', email: '', phone: '', address: '' });
    setShowModal(true);
  };

  // Filter organizations based on search query
  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredOrganizations.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredOrganizations.length / itemsPerPage);

  // Go to next page
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  // Go to previous page
  const handlePrevPage = () => {
    if (currentPage > 1) {
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
        {/* Organizations Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-5 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md flex items-center justify-center shrink-0">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-gray-800">{t('organizationManagement')}</h2>
              </div>
              <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap w-full sm:w-auto">
                {/* Search Input */}
                <input
                  type="text"
                  placeholder={t('searchOrganizations')}
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
                    padding: '12px 24px',
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
                  {t('addOrganization')}
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="w-full">
            <div className="overflow-auto" style={{ maxHeight: '520px' }}>
              <table className="w-full" style={{ minWidth: '900px' }}>
                <thead className="bg-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider">{t('userId')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider">{t('organizationName')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider">{t('email')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider">{t('phone')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider">{t('address')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="text-center">
                          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <p className="text-gray-500">{searchQuery ? t('noOrganizationsFoundForSearch') : `${t('noOrganizationsFound')}. Click "${t('addOrganization')}" to create one.`}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentItems.map((org, index) => (
                      <tr key={org.id} className="border-b border-gray-300 hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap text-center">
                          <span className="text-sm font-semibold text-gray-900">{indexOfFirstItem + index + 1}</span>
                        </td>
                        <td className="px-4 py-2 text-center" style={{ maxWidth: '200px' }}>
                          <span className="text-sm font-semibold text-gray-900 break-words">{org.name}</span>
                        </td>
                        <td className="px-4 py-2 text-center" style={{ maxWidth: '180px' }}>
                          <span className="text-sm font-semibold text-gray-900 break-words">{org.email || '-'}</span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-center">
                          <span className="text-sm font-semibold text-gray-900">{org.phone || '-'}</span>
                        </td>
                        <td className="px-4 py-2 text-center" style={{ maxWidth: '200px' }}>
                          <span className="text-sm font-semibold text-gray-900 break-words">{org.address || '-'}</span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-center shrink-0">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleView(org)}
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
                              onClick={() => handleEdit(org)}
                              className="text-2xl hover:scale-110 transition-transform duration-200 text-amber-600 shrink-0"
                              title={t('edit')}
                              aria-label={t('edit')}
                            >
                              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.586-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.414-8.586z" /></svg>
                            </button>
                            <button
                              onClick={() => handleDelete(org)}
                              className="text-2xl hover:scale-110 transition-transform duration-200 text-red-600 shrink-0"
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
          {organizations.length > 0 && (
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
                  {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, organizations.length)} {t('of')} {organizations.length} {t('items')}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Organization Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-transparent overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-fadeIn" style={{ minHeight: '400px' }}>
            <div className="px-4 py-3 rounded-t-2xl" style={{ background: '#2b51b1', position: 'relative' }}>
              <div className="flex items-center gap-2">
                {editingOrg ? (
                  <span style={{ fontSize: '20px', color: 'white' }}><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.586-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.414-8.586z" /></svg></span>
                ) : (
                  <span style={{ fontSize: '20px', color: 'white' }}><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></span>
                )}
                <h3 className="text-lg font-bold text-white">{editingOrg ? t('editOrganization') : t('addOrganization')}</h3>
              </div>
              <button className="comment-modal-close" onClick={handleCancel} aria-label={t('close')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4">
              {/* Row 1: Organization Name + Email */}
              <div className="flex gap-4 mb-4">
                <div className="w-3/5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('organizationName')} *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^a-zA-Z0-9\s\-+*&@#.,()/[\]{}'":;!?]/g, '');
                      setFormData({ ...formData, name: value });
                    }}
                    placeholder={t('enterOrganizationName')}
                    required
                    autoFocus
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}
                  />
                </div>
                <div className="w-2/5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('email')}</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder={t('enterEmail')}
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}
                  />
                </div>
              </div>

              {/* Row 2: Phone + Address (Address full width) */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('phone')}</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d+]/g, '');
                    if (value.length <= 15) {
                      setFormData({ ...formData, phone: value });
                    }
                  }}
                  placeholder="+93"
                  maxLength={13}
                  className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('address')}</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder={t('enterAddress')}
                  rows={3}
                  className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}
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
                  {isSubmitting ? t('submitting') : (editingOrg ? t('update') : t('save'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedOrg && (
        <div className="fixed inset-0 bg-transparent overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-auto animate-fadeIn">
            <div className="px-4 py-3 rounded-t-2xl" style={{ background: '#dc2626', position: 'relative' }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: '20px', color: 'white' }}><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-7 0h8" /></svg></span>
                <h3 className="text-lg font-bold text-white">{t('deleteOrganization')}</h3>
              </div>
              <button className="comment-modal-close" onClick={() => { setShowDeleteModal(false); setSelectedOrg(null); }} aria-label={t('close')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="p-4 text-center">
              <div className="mb-4">
              </div>
              <p className="text-gray-600 mb-2">{t('confirmDeleteOrganization')}</p>
              <div className="font-semibold text-gray-900 mb-2">
                "{selectedOrg.name}"
              </div>
              <p className="text-sm text-gray-500 mb-6">{t('actionCannotBeUndone')}</p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedOrg(null);
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
                  disabled={isSubmitting}
                  className="min-w-24 shrink-0 px-3 py-2 text-white rounded-lg hover:opacity-90 transition-all duration-200 shadow-md font-medium text-sm flex items-center justify-center gap-1 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#dc2626' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {isSubmitting ? t('deleting') : t('delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Organization Modal */}
      {showViewModal && viewOrg && (
        <div className="fixed inset-0 bg-transparent overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-auto animate-fadeIn" style={{ minHeight: '400px' }}>
            <div className="px-4 py-3 rounded-t-2xl" style={{ background: '#2b51b1', position: 'relative' }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: '20px', color: 'white' }}><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg></span>
                <h3 className="text-lg font-bold text-white">{t('organizationDetails')}</h3>
              </div>
              <button className="comment-modal-close" onClick={closeViewModal} aria-label={t('close')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="p-4">
              {/* Row 1: Organization ID + Organization Name */}
              <div className="flex gap-4 mb-4">
                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">{t('organizationId')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">{viewOrg.id}</p>
                </div>
                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">{t('organizationName')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">{viewOrg.name}</p>
                </div>
              </div>
              
              {/* Row 2: Email + Phone */}
              <div className="flex gap-4 mb-4">
                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">{t('email')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">{viewOrg.email || '-'}</p>
                </div>
                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">{t('phone')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">{viewOrg.phone || '-'}</p>
                </div>
              </div>
              
              {/* Row 3: Address + Created At */}
              <div className="flex gap-4 mb-4">
                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">{t('address')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">{viewOrg.address || '-'}</p>
                </div>
                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">{t('createdAt')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">
                    {viewOrg.createdAt ? new Date(viewOrg.createdAt).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                  </p>
                </div>
              </div>

              {/* Row 4: Ticket Count + Service Count */}
              <div className="flex gap-4 mb-4">
                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">{t('ticket Count')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">{orgStats?.ticketCount ?? '-'}</p>
                </div>
                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">{t('service Count')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">{orgStats?.serviceCount ?? '-'}</p>
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
