import { useEffect, useState, useRef } from 'react';
import { serviceAPI, extractArrayData } from '../services/api';
import { useSimpleToast } from '../components/SimpleToast';
import SkeletonLoader from '../components/SkeletonLoader';
import { useTranslation } from 'react-i18next';
import '../components/CommentModal.css';

interface Service {
  id: number;
  name: string;
  description?: string;
  createdAt?: string;
}

// ServiceManagement — CRUD for support services with pagination
export default function ServiceManagement() {
  const { show, ToastContainer } = useSimpleToast();
  const { t } = useTranslation();
  // Service list and loading state
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  // Modal and form state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [modalMessage, setModalMessage] = useState('');
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Fetch all services sorted by creation date
  const loadServices = async () => {
    try {
      const response = await serviceAPI.getAll();
      const data = extractArrayData<Service>(response.data);
      data.sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setServices(data);
    } finally {
      setLoading(false);
    }
  };

  const loaded = useRef(false);

  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      loadServices().catch(() => {});
    }
  }, []);



  // Create or update a service with validation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate name is not empty
    if (!formData.name.trim()) {
      setModalMessage(t('pleaseEnterServiceName'));
      return;
    }

    // Validate name length (max 100 characters)
    if (formData.name.trim().length > 100) {
      setModalMessage(t('serviceNameMaxLength'));
      return;
    }

    // Validate description length (max 500 characters)
    if (formData.description.trim().length > 500) {
      setModalMessage(t('descriptionMaxLength'));
      return;
    }

    // Prevent duplicate name before submit (check against existing services)
    const duplicateExists = services.some(
      (s) => s.name.toLowerCase() === formData.name.trim().toLowerCase() &&
             (!editingService || s.id !== editingService.id)
    );
    if (duplicateExists) {
      setModalMessage(t('serviceAlreadyExists'));
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingService) {
        await serviceAPI.update(editingService.id, { 
        name: formData.name.trim() || editingService.name,
        description: formData.description.trim()
      });
      } else {
        await serviceAPI.create({
        name: formData.name.trim(),
        description: formData.description.trim()
      });
      }
      show('success', t('success'), editingService ? t('serviceUpdatedSuccessfully') : t('serviceAddedSuccessfully'));
      setShowModal(false);
      setEditingService(null);
      setFormData({ name: '', description: '' });
      setModalMessage('');
      setCurrentPage(1);
      await loadServices();
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      let errorMsg = t('operationFailedCheckConnection');

      if (err.response) {
        if (err.response.data?.message) {
          errorMsg = err.response.data.message;
        } else {
          errorMsg = err.message || t('operationFailed');
        }
      }

      if (err.response?.status === 404) {
        serviceAPI.clearCache?.();
        await loadServices();
      }

      show('error', t('error'), errorMsg);
      setModalMessage(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Populate form with service data for editing
  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({ name: service.name, description: service.description || '' });
    setShowModal(true);
  };

  // Open delete confirmation modal
  const handleDelete = (service: Service) => {
    setSelectedService(service);
    setShowDeleteModal(true);
  };

  
  // Confirm and execute service deletion
  const handleDeleteConfirm = async () => {
    if (!selectedService) return;

    setIsSubmitting(true);
    try {
      await serviceAPI.delete(selectedService.id);
      show('success', t('success'), t('serviceDeletedSuccessfully'));
      setShowDeleteModal(false);
      setSelectedService(null);
      await loadServices();
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: unknown } };
      let message = t('deleteFailed');
      const responseData = err.response?.data;

      if (err.response?.status === 404) {
        serviceAPI.clearCache();
        await loadServices();
        show('error', t('error'), t('deleteFailed'));
      } else {
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
        message = message.replace(/^\d+\s+[A-Z_]+\s*/i, '').trim();
        show('error', t('error'), message);
      }
      setShowDeleteModal(false);
      setSelectedService(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Close service modal and reset form
  const handleCancel = () => {
    setShowModal(false);
    setEditingService(null);
    setFormData({ name: '', description: '' });
    setModalMessage('');
  };

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = services.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(services.length / itemsPerPage);

  // Ensure pagination recalculates when itemsPerPage changes
  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage]);

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

  // Open modal in add mode with empty form
  const openAddModal = () => {
    setEditingService(null);
    setFormData({ name: '', description: '' });
    setShowModal(true);
  };

  if (loading) {
    return <SkeletonLoader type="table" />;
  }

  return (
    <div className="min-h-screen flex flex-col overflow-y-auto">
      <ToastContainer />
      {/* Main Content */}
      <div className="w-full px-2 py-2 overflow-x-auto">
        {/* Services Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-5 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md flex items-center justify-center shrink-0">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-gray-800">{t('serviceManagement')}</h2>
              </div>
              <div className="flex items-center gap-3">
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
                    boxShadow: '0 4px 12px rgba(43, 81, 177, 0.15), inset 0 1px 0 rgba(255,255,255,0.8)',
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
                  {t('addService')}
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
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 " style={{ width: '10%' }}>{t('serviceId')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 " style={{ width: '25%' }}>{t('serviceName')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 " style={{ width: '30%' }}>{t('description')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 " style={{ width: '20%' }}>{t('createdAt')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  whitespace-nowrap" style={{ width: '15%' }}>{t('actions')}</th>
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
                          <p className="text-gray-500">{t('noServicesFound')}. Click "{t('addService')}" to create one.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentItems.map((service, index) => (
                      <tr key={service.id} className="border-b border-gray-300 hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap text-center">
                          <span className="text-sm font-semibold text-gray-900">{indexOfFirstItem + index + 1}</span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-center">
                          <span className="text-sm font-medium text-gray-900">{service.name}</span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className="text-sm font-medium text-gray-900 break-words" title={service.description || t('notAvailable')}>
                            {service.description || t('notAvailable')}
                          </span>
                        </td>
                        <td className="px-4 py-2 whitespace-normal sm:whitespace-nowrap text-center">
                          <span className="text-sm font-medium text-gray-900">
                            {service.createdAt ? new Date(service.createdAt).toLocaleString('en-US', {
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
                              onClick={() => handleEdit(service)}
                              className="text-2xl hover:scale-110 transition-transform duration-200 text-amber-600 shrink-0"
                              title={t('edit')}
                              aria-label={t('edit')}
                            >
                              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.586-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.414-8.586z" /></svg>
                            </button>
                            <button
                              onClick={() => handleDelete(service)}
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

          {/* Pagination (always visible to show per-page selector) */}
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
                  {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, services.length)} {t('of')} {services.length} {t('items')}
                </span>
              </div>
            </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-transparent overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-auto animate-fadeIn">
            <div className="px-4 py-3 rounded-t-2xl" style={{ background: '#2b51b1', position: 'relative' }}>
              <div className="flex items-center gap-2">
                {editingService ? (
                  <span style={{ fontSize: '20px', color: 'white' }}><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.586-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.414-8.586z" /></svg></span>
                ) : (
                  <span style={{ fontSize: '20px', color: 'white' }}><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></span>
                )}
                <h3 className="text-lg font-bold text-white">{editingService ? t('editService') : t('addService')}</h3>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('serviceName')} *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('enterServiceName')}
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
                  placeholder={t('enterDescription')}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 resize-none"
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
                  {isSubmitting ? t('submitting') : (editingService ? t('update') : t('save'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedService && (
        <div className="fixed inset-0 bg-transparent overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-auto animate-fadeIn">
            <div className="px-4 py-3 rounded-t-2xl" style={{ background: '#dc2626', position: 'relative' }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: '20px', color: 'white' }}><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-7 0h8" /></svg></span>
                <h3 className="text-lg font-bold text-white">{t('deleteService')}</h3>
              </div>
              <button className="comment-modal-close" onClick={() => { setShowDeleteModal(false); setSelectedService(null); }} aria-label={t('close')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="p-4 text-center">
              <div className="mb-4">
              </div>
              <p className="text-gray-600 mb-2">{t('confirmDeleteService')}</p>
              <div className="font-semibold text-gray-900 mb-2">
                "{selectedService.name}"
              </div>
              <p className="text-sm text-gray-500 mb-6">{t('actionCannotBeUndone')}</p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedService(null);
                  }}
                    className="w-24 px-3 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all duration-200 font-medium text-sm flex items-center justify-center gap-1"
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
                  {isSubmitting ? t('submitting') : t('delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

          </div>
  );
}
