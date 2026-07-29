import { useEffect, useState, useRef } from 'react';
import { ticketAPI, serviceAPI, API_BASE_URL, extractArrayData } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getAttachmentDisplayName } from '../utils/fileUtils';
import { useSimpleToast } from '../components/SimpleToast';
import SkeletonLoader from '../components/SkeletonLoader';
import { useTranslation } from 'react-i18next';
import CommentModal from '../components/CommentModal';

interface Ticket {
  id: number;
  subject: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SOLVED';
  service?: string; serviceId?: number;
  organization?: string; organizationId?: number;
  createdBy?: string; createdById?: number;
  createdAt: string;
  attachmentPath?: string;
  commentCount?: number;
}

interface Service {
  id: number;
  name: string;
}

// MyTickets — full ticket lifecycle for the user's organization: create, view, edit, delete, comment
export default function MyTickets() {
  const { user } = useAuth();
  const { show, ToastContainer } = useSimpleToast();
  const { t } = useTranslation();
  // Tickets and services data
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  // Modal visibility flags
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedCommentTicketId, setSelectedCommentTicketId] = useState<number | null>(null);
  // Unread comment counts per ticket
  const [unreadComments, setUnreadComments] = useState<Record<number, number>>({});
  // Track last-read comment counts per ticket, persisted in localStorage
  const [lastReadComments, setLastReadComments] = useState<Record<number, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('lastReadComments') || '{}');
    } catch {
      return {};
    }
  });
  // Form fields for create/edit ticket
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    serviceId: '',
    attachment: null as File | null
  });
  // Filter and pagination state
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'IN_PROGRESS' | 'SOLVED'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  // Action loading flags
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch tickets created by the current user
  const loadData = async () => {
    try {
      const [ticketsRes, servicesRes] = await Promise.all([
        ticketAPI.getAll(),
        serviceAPI.getAll(),
      ]);

      let allTickets = extractArrayData<Ticket>(ticketsRes.data);
      if (user?.id) {
        allTickets = allTickets.filter(ticket => ticket.createdById === user.id);
      }

      const sortedTickets = allTickets.sort((a: Ticket, b: Ticket) => b.id - a.id);
      setTickets(sortedTickets);
      setServices(extractArrayData<Service>(servicesRes.data));
      // Use commentCount from the DTO instead of individual API calls
      const counts: Record<number, number> = {};
      sortedTickets.forEach(ticket => {
        const total = ticket.commentCount || 0;
        const read = lastReadComments[ticket.id] || 0;
        if (total > read) counts[ticket.id] = total - read;
      });
      setUnreadComments(counts);
    } catch (error: unknown) {
      setTickets([]);
      setServices([]);
      show('error', t('error'), t('errorFetchingTickets'));
    } finally {
      setLoading(false);
    }
  };

  const loaded = useRef(false);

  useEffect(() => {
    if (user?.id && !loaded.current) {
      loaded.current = true;
      loadData();
    }
  }, [user?.id]);



  useEffect(() => {
    localStorage.setItem('lastReadComments', JSON.stringify(lastReadComments));
  }, [lastReadComments]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setStatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Download ticket attachment via API with error handling
  const handleDownloadAttachment = async (ticketId: number, attachmentPath?: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tickets/download/${ticketId}`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        let errorMessage = t('downloadFailed');

        if (response.status === 403) {
          errorMessage = t('accessDeniedDownload');
        } else if (response.status === 404) {
          errorMessage = t('fileNotFoundDownload');
        } else if (response.status === 401) {
          errorMessage = t('authExpiredDownload');
        } else {
          errorMessage = `${t('downloadFailed')}: ${response.status} ${response.statusText}`;
        }

        show('error', t('error'), errorMessage);
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const downloadLink = document.createElement('a');
      downloadLink.href = url;

      let filename = `attachment-${ticketId}`;
      if (attachmentPath) {
        const parts = attachmentPath.split('_');
        if (parts.length > 1) {
          filename = parts.slice(1).join('_');
        }
      } else {
        const contentDisposition = response.headers.get('Content-Disposition');
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
          if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1];
          }
        }
      }

      downloadLink.download = filename;
      downloadLink.style.display = 'none';
      document.body.appendChild(downloadLink);
      downloadLink.click();

      setTimeout(() => {
        document.body.removeChild(downloadLink);
        window.URL.revokeObjectURL(url);
        show('success', t('success'), t('attachmentDownloadedSuccessfully'));
      }, 100);

    } catch (error) {
      show('error', t('error'), t('downloadNetworkError'));
    }
  };

  // Submit ticket edits via FormData with attachment support
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    setIsEditing(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('subject', formData.subject);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('serviceId', formData.serviceId);
      formDataToSend.append('organizationId', (user?.organizationId || 1).toString());

      if (formData.attachment) {
        formDataToSend.append('attachment', formData.attachment);
      }

      if (removeAttachment) {
        formDataToSend.append('removeAttachment', 'true');
      }

      const response = await ticketAPI.updateWithAttachment(selectedTicket.id, formDataToSend);
      const updatedTicket = response.data;
      setTickets(tickets.map(t => t.id === selectedTicket.id ? updatedTicket : t));
      setShowEditModal(false);
      setSelectedTicket(null);
      setFormData({ subject: '', description: '', serviceId: '', attachment: null });
      setRemoveAttachment(false);

      show('success', t('success'), t('ticketUpdatedSuccessfully'));
    } catch (error) {
      show('error', t('error'), t('errorUpdatingTicket'));
    } finally {
      setIsEditing(false);
    }
  };

  // Confirm and execute ticket deletion
  const handleDeleteConfirm = async () => {
    if (!selectedTicket) return;
    setIsDeleting(true);

    try {
      await ticketAPI.delete(selectedTicket.id);
      setTickets(tickets.filter(ticket => ticket.id !== selectedTicket.id));
      setShowDeleteModal(false);
      show('success', t('success'), t('ticketDeletedSuccessfully'));
    } catch (error) {
      show('error', t('error'), t('errorDeletingTicket'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Create a new ticket via FormData submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('subject', formData.subject);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('serviceId', formData.serviceId);
      formDataToSend.append('organizationId', (user?.organizationId || 1).toString());

      if (formData.attachment) {
        formDataToSend.append('attachment', formData.attachment);
      }

      const response = await ticketAPI.create(formDataToSend);
      const newTicket = response.data;
      setTickets([newTicket, ...tickets]);
      setShowSubmitModal(false);
      setFormData({ subject: '', description: '', serviceId: '', attachment: null });
      show('success', t('success'), t('ticketSubmittedSuccessfully'));
    } catch (error) {
      show('error', t('error'), t('errorSubmittingTicket'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Count tickets per status for filter display
  const pendingCount = tickets.filter(t => t.status === 'PENDING').length;
  const inProgressCount = tickets.filter(t => t.status === 'IN_PROGRESS').length;
  const solvedCount = tickets.filter(t => t.status === 'SOLVED').length;

  const filteredTickets = statusFilter === 'ALL'
    ? [...tickets].sort((a, b) => b.id - a.id)
    : [...tickets.filter(ticket => ticket.status === statusFilter)].sort((a, b) => b.id - a.id);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTickets = filteredTickets.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);

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
      <CommentModal
        ticketId={selectedCommentTicketId || 0}
        isOpen={showCommentModal}
        onClose={() => setShowCommentModal(false)}
        onCommentsRead={(count) => {
          if (selectedCommentTicketId) {
            setLastReadComments(prev => ({ ...prev, [selectedCommentTicketId]: count }));
            setUnreadComments(prev => ({ ...prev, [selectedCommentTicketId]: 0 }));
          }
        }}
      />
{/* Main Content */}
      <div className="w-full px-2 py-2 overflow-x-auto">
         {/* My Assigned Tickets Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-white px-4 py-4 lg:px-6 lg:py-5 border-b border-gray-100">
            <div className="flex items-center justify-between flex-col lg:flex-row gap-4">
              <div className="flex items-center gap-3 w-full lg:w-auto">
                <div className="p-1.5 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl shadow-md flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-gray-800 font-bold text-lg lg:text-xl">{t('myTickets')}</h2>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full lg:w-auto justify-center lg:justify-end">
                <div ref={statusDropdownRef} style={{ position: 'relative' }}>
                  <div
                    onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                    style={{
                      padding: '12px 44px 12px 18px',
                      borderRadius: '12px',
                      border: '2px solid transparent',
                      background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%) padding-box, linear-gradient(135deg, #2b51b1 0%, #2b51b1 100%) border-box',
                      fontSize: '14px',
                      color: '#1e293b',
                      cursor: 'pointer',
                      outline: 'none',
                      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15), inset 0 1px 0 rgba(255,255,255,0.8)',
                      fontWeight: 600,
                      minWidth: '140px',
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      userSelect: 'none'
                    }}
                  >
                    {statusFilter === 'ALL' && (
                      <svg width="16" height="16" fill="none" stroke="#2b51b1" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    )}
                    {statusFilter === 'PENDING' && (
                      <svg width="16" height="16" fill="none" stroke="#eab308" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    )}
                    {statusFilter === 'IN_PROGRESS' && (
                      <svg width="16" height="16" fill="none" stroke="#3b82f6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    )}
                    {statusFilter === 'SOLVED' && (
                      <svg width="16" height="16" fill="none" stroke="#22c55e" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    )}
                    <span>
                      {statusFilter === 'ALL' && `${t('all')} (${tickets.length})`}
                      {statusFilter === 'PENDING' && `${t('pending')} (${pendingCount})`}
                      {statusFilter === 'IN_PROGRESS' && `${t('inProgressText')} (${inProgressCount})`}
                      {statusFilter === 'SOLVED' && `${t('solved')} (${solvedCount})`}
                    </span>
                  </div>
                  <div style={{
                    position: 'absolute',
                    right: '4px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '32px',
                    height: '32px',
                    background: '#2b51b1',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
                  }}>
                    <svg style={{ width: '16px', height: '16px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  {statusDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: '0',
                      right: '0',
                      marginTop: '4px',
                      background: '#ffffff',
                      border: '2px solid #2b51b1',
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(43, 81, 177, 0.15)',
                      zIndex: 50,
                      overflow: 'hidden'
                    }}>
                      <div
                        onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); setStatusDropdownOpen(false); }}
                        style={{
                          padding: '10px 18px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '14px',
                          fontWeight: statusFilter === 'ALL' ? 600 : 400,
                          color: '#1e293b',
                          background: statusFilter === 'ALL' ? '#f0f4ff' : '#ffffff',
                          borderBottom: '1px solid #f0f0f0'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f4ff'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = statusFilter === 'ALL' ? '#f0f4ff' : '#ffffff'; }}
                      >
                        <svg width="16" height="16" fill="none" stroke="#2b51b1" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                        <span>{t('all')} ({tickets.length})</span>
                      </div>
                      <div
                        onClick={() => { setStatusFilter('PENDING'); setCurrentPage(1); setStatusDropdownOpen(false); }}
                        style={{
                          padding: '10px 18px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '14px',
                          fontWeight: statusFilter === 'PENDING' ? 600 : 400,
                          color: '#1e293b',
                          background: statusFilter === 'PENDING' ? '#fefce8' : '#ffffff',
                          borderBottom: '1px solid #f0f0f0'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#fefce8'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = statusFilter === 'PENDING' ? '#fefce8' : '#ffffff'; }}
                      >
                        <svg width="16" height="16" fill="none" stroke="#eab308" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span>{t('pending')} ({pendingCount})</span>
                      </div>
                      <div
                        onClick={() => { setStatusFilter('IN_PROGRESS'); setCurrentPage(1); setStatusDropdownOpen(false); }}
                        style={{
                          padding: '10px 18px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '14px',
                          fontWeight: statusFilter === 'IN_PROGRESS' ? 600 : 400,
                          color: '#1e293b',
                          background: statusFilter === 'IN_PROGRESS' ? '#eff6ff' : '#ffffff',
                          borderBottom: '1px solid #f0f0f0'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = statusFilter === 'IN_PROGRESS' ? '#eff6ff' : '#ffffff'; }}
                      >
                        <svg width="16" height="16" fill="none" stroke="#3b82f6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        <span>{t('inProgressText')} ({inProgressCount})</span>
                      </div>
                      <div
                        onClick={() => { setStatusFilter('SOLVED'); setCurrentPage(1); setStatusDropdownOpen(false); }}
                        style={{
                          padding: '10px 18px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '14px',
                          fontWeight: statusFilter === 'SOLVED' ? 600 : 400,
                          color: '#1e293b',
                          background: statusFilter === 'SOLVED' ? '#f0fdf4' : '#ffffff'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#f0fdf4'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = statusFilter === 'SOLVED' ? '#f0fdf4' : '#ffffff'; }}
                      >
                        <svg width="16" height="16" fill="none" stroke="#22c55e" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        <span>{t('solved')} ({solvedCount})</span>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowSubmitModal(true);
                    setFormData({ subject: '', description: '', serviceId: '', attachment: null });
                  }}
                  style={{
                    appearance: 'none',
                    padding: '12px 18px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                    border: '2px solid #2b51b1',
                    background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%) padding-box, #2b51b1 border-box',
                    fontSize: '14px',
                    color: '#1e293b',
                    cursor: 'pointer',
                    outline: 'none',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15), inset 0 1px 0 rgba(255,255,255,0.8)',
                    fontWeight: 600
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
                  <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t('submitNewTicket')}
                </button>
              </div>
            </div>
          </div>
                    {/* Table */}
<div className="w-full overflow-x-auto">
  <div className="overflow-y-auto" style={{ maxHeight: '540px' }}>
    <table className="w-full" style={{ minWidth: '800px' }}>

      <thead className="bg-gray-100 sticky top-0 z-10">
        <tr>
          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider whitespace-nowrap">{t('ticketId')} </th>
          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider whitespace-nowrap" style={{ width: '25%' }}>{t('subject')}</th>
          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider">{t('serviceText')}</th>
          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider">{t('organization')}</th>
          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider whitespace-nowrap">{t('status')}</th>
          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider whitespace-nowrap"> {t('actions')}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-300">

        {currentTickets.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-6 py-12 text-center">
              <p className="text-gray-500">{t('noTicketsFound')}</p>
            </td>
          </tr>
        ) : (
          currentTickets.map((ticket, index) => {

            const displayNumber = indexOfFirstItem + index + 1;

            const isPending = ticket.status === 'PENDING';
            const isInProgress = ticket.status === 'IN_PROGRESS';

            const canEditDelete = isPending;
            const canComment = true;

            return (
              <tr key={ticket.id} className="hover:bg-gray-50 transition-colors duration-150">

                {/* ID */}
                <td className="px-4 py-2 text-center">
                  <span className="text-sm font-semibold text-gray-900">
                    {displayNumber}
                  </span>
                </td>

                {/* Subject */}
                <td className="px-4 py-2 text-center">
                  <span className="text-sm font-semibold text-gray-900">
                    {ticket.subject}
                  </span>
                </td>

                {/* Service */}
                <td className="px-4 py-2 text-center">
                  <span className="text-sm font-semibold text-gray-900">
                    {ticket.service || t('unknownService')}
                  </span>
                </td>

                {/* Org */}
                <td className="px-4 py-2 text-center">
                  <span className="text-sm font-semibold text-gray-900">
                    {ticket.organization || t('unknown')}
                  </span>
                </td>

                {/* STATUS */}
                <td className="px-4 py-2 text-center">
                  <span
                    className={`inline-flex items-center justify-center px-3 rounded-lg text-xs font-semibold shadow-sm min-w-[110px] border ${
                      isPending
                        ? 'bg-amber-100 text-amber-700 border-amber-100'
                        : isInProgress
                        ? 'bg-blue-100 text-blue-700 border-blue-200 opacity-100'
                        : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {isPending
                      ? t('pending')
                      : isInProgress
                      ? t('inProgress')
                      : t('solved')}
                  </span>
                </td>

                {/* ACTIONS */}
                <td className="px-4 py-2 text-center">
                  <div className="flex items-center justify-center gap-1 flex-nowrap">

                    {/* VIEW */}
                    <button
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setShowViewModal(true);
                      }}
                      className="shrink-0 text-2xl hover:scale-110 transition-transform duration-200 text-slate-600"
                      title={t('view')}
                      aria-label={t('view')}
                    >
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    </button>

                    {/* EDIT */}
                    <button
                      onClick={() => {
                        if (!canEditDelete) return;

                        setSelectedTicket(ticket);
                        setShowEditModal(true);
                        setFormData({
                          subject: ticket.subject,
                          description: ticket.description,
                          serviceId: ticket.serviceId?.toString() || '',
                          attachment: null
                        });
                        setRemoveAttachment(false);
                      }}
                      disabled={!canEditDelete}
                      className={`shrink-0 transition hover:scale-110 ${
                        canEditDelete
                          ? 'text-amber-600 hover:text-amber-600'
                          : 'text-amber-300 cursor-not-allowed'
                      }`}
                      title={t('edit')}
                      aria-label={t('edit')}
                    >
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.586-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.414-8.586z"
                        />
                      </svg>
                    </button>

                    {/* DELETE */}
                    <button
                      onClick={() => {
                        if (!canEditDelete) return;

                        setSelectedTicket(ticket);
                        setShowDeleteModal(true);
                      }}
                      disabled={!canEditDelete}
                      className={`shrink-0 text-2xl hover:scale-110 transition-transform duration-200 ${
                        canEditDelete
                          ? 'text-red-600 hover:text-red-600'
                          : 'text-red-200 cursor-not-allowed'
                      }`}
                      title={t('delete')}
                      aria-label={t('delete')}
                    >
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-7 0h8"
                        />
                      </svg>
                    </button>

                    {/* COMMENT */}
                    <button
                      onClick={() => {
                        if (!canComment) return;

                        setSelectedCommentTicketId(ticket.id);
                        setShowCommentModal(true);
                      }}
                      className="relative shrink-0 text-2xl hover:scale-110 transition-transform duration-200 text-teal-600"
                      title={t('comment')}
                      aria-label={t('comment')}
                    >
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                      </svg>

                      {unreadComments[ticket.id] > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                          {unreadComments[ticket.id] > 9 ? '9+' : unreadComments[ticket.id]}
                        </span>
                      )}
                    </button>

                    </div>
                  </td>
                  </tr>
                  );

                  })

                  )}

                </tbody>
                </table>
                 </div>
              </div>
          {filteredTickets.length > 0 && (
            <div className="px-3 sm:px-6 py-4 border-t border-gray-100">
              <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="hidden sm:inline-flex px-2 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {'<<'}
                </button>
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {'<'}
                </button>
                {getPageNumbers().map((page, index) => (
                  page === '...' ? (
                    <span key={`ellipsis-${index}`} className="text-gray-400 px-2">...</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => handlePageClick(page as number)}
                      className={`px-2 py-1 text-sm rounded-full ${
                        currentPage === page
                          ? 'bg-blue-500 text-white'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {page}
                    </button>
                  )
                ))}
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {'>'}
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="hidden sm:inline-flex px-2 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <span className="text-sm text-gray-700">
                  {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredTickets.length)} {t('of')} {filteredTickets.length} {t('items')}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Submit New Ticket Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-transparent overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-fadeIn">
            {/* Header */}
            <div className="px-4 py-3 rounded-t-2xl" style={{ background: '#2b51b1', position: 'relative' }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: '20px', color: 'white' }}><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></span>
                <h3 className="text-lg font-bold text-white">{t('submitNewTicket')}</h3>
              </div>
              <button className="comment-modal-close" onClick={() => { setShowSubmitModal(false); setFormData({ subject: '', description: '', serviceId: '', attachment: null }); }} aria-label={t('close')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {/* Body */}
            <form key={showSubmitModal ? 'submit' : 'none'} onSubmit={handleSubmit} className="p-4">
              {/* Service + Subject */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '30px',
                  marginBottom: '28px'
                }}
              >
                {/* Service */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '10px',
                      fontSize: '15px',
                      fontWeight: 600,
                      color: '#374151'
                    }}
                  >
                    {t('serviceText')} *
                  </label>

                  <select
                    value={formData.serviceId}
                    onChange={(e) =>
                      setFormData(prev => ({
                        ...prev,
                        serviceId: e.target.value
                      }))
                    }
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                  >
                    <option value="">{t('selectService')}</option>

                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subject */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '10px',
                      fontSize: '15px',
                      fontWeight: 600,
                      color: '#374151'
                    }}
                  >
                    {t('subject')} *
                  </label>

                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) =>
                      setFormData(prev => ({
                        ...prev,
                        subject: e.target.value
                      }))
                    }
                    required
                    placeholder={t('enterTicketSubject')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                  />
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: '28px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#374151'
                  }}
                >
                  {t('description')} *
                </label>

                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData(prev => ({
                      ...prev,
                      description: e.target.value
                    }))
                  }
                  required
                  placeholder={t('describeYourIssueInDetail')}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 resize-none"
                />
              </div>

              {/* Attachment */}
              <div style={{ marginBottom: '20px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#374151'
                  }}
                >
                  {t('attachmentOptional')}
                </label>

                <input
                  type="file"
                  id="submit-file-input"
                  accept="*/*"
                  onChange={(e) =>
                    setFormData(prev => ({
                      ...prev,
                      attachment: e.target.files?.[0] || null
                    }))
                  }
                  style={{ display: 'none' }}
                />
                <label
                  htmlFor="submit-file-input"
                  className="w-full px-4 py-2 rounded-lg border-2 border-blue-300 bg-blue-50 hover:bg-blue-100 transition-all duration-200 outline-none flex items-center justify-center cursor-pointer gap-2"
                  style={{ color: '#1d4ed8', fontWeight: 600 }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  {formData.attachment ? formData.attachment.name : t('chooseFile')}
                </label>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowSubmitModal(false);
                    setFormData({ subject: '', description: '', serviceId: '', attachment: null });
                  }}
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
                  {isSubmitting ? t('submitting') : t('submitTicket')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Ticket Modal */}
      {showViewModal && selectedTicket && (
        <div className="fixed inset-0 bg-transparent overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-auto animate-fadeIn"
          >
            {/* Header */}
            <div
              className="px-4 py-3 rounded-t-2xl" style={{ background: '#2b51b1', position: 'relative' }}
            >
              <div className="flex items-center gap-2">
                 <span style={{ fontSize: '20px', color: 'white' }}><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg></span>
                <h3 className="text-lg font-bold text-white">
                  {t('ticketDetails')}
                </h3>
              </div>
              <button className="comment-modal-close" onClick={() => setShowViewModal(false)} aria-label={t('close')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">

              {/* Row 1: Service + Subject */}
              <div className="flex gap-4 mb-4">
                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                    {t('serviceText')}
                  </label>

                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">
                    {selectedTicket.service || t('unknown')}
                  </p>
                </div>

                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                    {t('subject')}
                  </label>

                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">
                    {selectedTicket.subject}
                  </p>
                </div>
              </div>

              {/* Row 2: Organization + Status */}
              <div className="flex gap-4 mb-4">
                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                    {t('organization')}
                  </label>

                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">
                    {selectedTicket.organization || t('noOrganization')}
                  </p>
                </div>

                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                    {t('status')}
                  </label>

                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold shadow-sm ${
                        selectedTicket.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-700'
                          : selectedTicket.status === 'IN_PROGRESS'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {selectedTicket.status.replace('_', ' ')}
                    </span>
                  </p>
                </div>
              </div>

              {/* Row 3: Created By + Created At */}
              <div className="flex gap-4 mb-4">
                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                    {t('createdBy')}
                  </label>

                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">
                    {selectedTicket.createdBy || t('createdBy')}
                  </p>
                </div>

                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                    {t('createdAt')}
                  </label>

                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">
                    {new Date(selectedTicket.createdAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                  {t('description')}
                </label>

                <p
                  className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200"
                  style={{ minHeight: '80px', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}
                >
                  {selectedTicket.description}
                </p>
              </div>

              {/* Attachment */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                  {t('attachment')}
                </label>

                <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 pl-3 pr-0 py-2 rounded border border-gray-200 flex items-center">
                  {selectedTicket.attachmentPath ? (
                    <div className="flex items-center w-full">
                      <span className="text-gray-700 truncate flex-1 mr-3">
                        {getAttachmentDisplayName(selectedTicket.attachmentPath)}
                      </span>

                      <div className="flex items-center gap-1">
                        {/* View */}
                        <a
                          href={`${API_BASE_URL}/uploads/${selectedTicket.attachmentPath}`}
                          target="_blank"
                          rel="noopener noreferrer"
                      className="shrink-0 text-2xl hover:scale-110 transition-transform duration-200 text-slate-600"
                          title={t('viewAttachment')}
                        >
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                        </a>

                        {/* Download */}
                        <button
                          onClick={async (e) => {
                            e.preventDefault();

                            try {
                              const response = await fetch(
                                `${API_BASE_URL}/uploads/${selectedTicket.attachmentPath}`
                              );

                              const blob = await response.blob();

                              const url = window.URL.createObjectURL(blob);

                              const link = document.createElement('a');

                              link.href = url;

                              const displayName = getAttachmentDisplayName(selectedTicket.attachmentPath);
                              link.download = displayName;

                              document.body.appendChild(link);

                              link.click();

                              document.body.removeChild(link);

                              window.URL.revokeObjectURL(url);
                            } catch (error) {
                        
                              const link = document.createElement('a');

                              link.href = `${API_BASE_URL}/uploads/${selectedTicket.attachmentPath}`;

                              link.target = '_blank';

                              document.body.appendChild(link);

                              link.click();

                              document.body.removeChild(link);
                            }
                          }}
                          className="text-2xl hover:scale-110 transition-transform duration-200 text-blue-500 bg-transparent border-none cursor-pointer p-0"
                          title={t('downloadAttachment')}
                        >
                          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-500">
                      {t('noAttachment')}
                    </span>
                  )}
                </p>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="min-w-24 shrink-0 px-3 py-2 text-white rounded-lg hover:opacity-90 transition-all duration-200 shadow-md font-medium text-sm flex items-center justify-center gap-1 whitespace-nowrap"
                  style={{ background: '#2b51b1' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  {t('close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Ticket Modal */}
      {showEditModal && selectedTicket && (
        <div className="fixed inset-0 bg-transparent overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-auto animate-fadeIn"
          >
            {/* Header */}
            <div
              className="px-4 py-3 rounded-t-2xl"style={{ background: '#2b51b1', position: 'relative' }}
            >
              <div className="flex items-center gap-2">
                <span style={{ fontSize: '20px', color: 'white' }}><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.586-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.414-8.586z" /></svg></span>
                <h3 className="text-lg font-bold text-white">
                  {t('editTicket')}
                </h3>
              </div>
              <button className="comment-modal-close" onClick={() => setShowEditModal(false)} aria-label={t('close')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {/* Body */}
            <form key={showEditModal ? 'edit' : 'none'} onSubmit={handleEditSubmit} className="p-4 space-y-3">
              {/* Row 1: Service + Subject */}
              <div className="flex gap-4 mb-4">
                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                    {t('serviceText')} *
                  </label>
                  <select
                    value={formData.serviceId}
                    onChange={(e) => setFormData(prev => ({...prev, serviceId: e.target.value}))}
                    required
                    className="w-full mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t('selectService')}</option>
                    {services.map(service => (
                      <option key={service.id} value={service.id}>{service.name}</option>
                    ))}
                  </select>
                </div>

                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                    {t('subject')} *
                  </label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData(prev => ({...prev, subject: e.target.value}))}
                    required
                    placeholder={t('enterTicketSubject')}
                    className="w-full mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                  {t('description')} *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
                  required
                  rows={4}
                  className="w-full mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ minHeight: '80px', whiteSpace: 'pre-wrap' }}
                />
              </div>

              {/* Attachment */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                  {t('attachmentOptional')}
                </label>
                <div className="relative">
                  <input
                    type="file"
                    id="edit-file-input"
                    onChange={(e) => setFormData(prev => ({...prev, attachment: e.target.files?.[0] || null}))}
                    className="hidden"
                  />
                  <label
                    htmlFor="edit-file-input"
                    className="w-full mt-1 px-3 py-2 rounded-lg border-2 border-blue-300 bg-blue-50 hover:bg-blue-100 transition-all duration-200 text-sm font-medium cursor-pointer flex items-center justify-center gap-2"
                    style={{ color: '#1d4ed8' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    {formData.attachment ? formData.attachment.name : t('chooseFile')}
                  </label>
                </div>
                {selectedTicket && !formData.attachment && !removeAttachment && (
                  <div className="mt-2 flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-200">
                    {selectedTicket.attachmentPath ? (
                      <>
                        <div className="flex items-center justify-center flex-1">
                          <span className="truncate text-sm font-medium text-gray-700">
                            {getAttachmentDisplayName(selectedTicket.attachmentPath)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleDownloadAttachment(selectedTicket.id, selectedTicket.attachmentPath)}
                            className="text-blue-500 hover:text-blue-700"
                            title={t('downloadAttachment')}
                            aria-label={t('downloadAttachment')}
                          >
                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setRemoveAttachment(true)}
                            className="text-red-500 hover:text-red-700"
                            title={t('removeAttachment')}
                            aria-label={t('removeAttachment')}
                          >
                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </>
                    ) : (
                      <span className="text-sm text-gray-500">{t('noAttachment')}</span>
                    )}
                  </div>
                )}
                {formData.attachment && (
                  <div className="mt-2 flex items-center justify-center bg-blue-50 p-2 rounded border border-blue-200 gap-2">
                    <span className="truncate text-sm font-medium text-blue-600">{t('newAttachment')} {formData.attachment.name}</span>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({...prev, attachment: null}))}
                      className="text-red-500 hover:text-red-700"
                      title={t('removeAttachment')}
                    >
                      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 mb-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="min-w-24 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 font-medium text-sm flex items-center justify-center gap-1 shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isEditing}
                  className="min-w-24 shrink-0 px-3 py-2 text-white rounded-lg hover:opacity-90 transition-all duration-200 shadow-md font-medium text-sm flex items-center justify-center gap-1 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#2b51b1' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {isEditing ? t('updating') : t('updateTicket')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedTicket && (
        <div className="fixed inset-0 bg-transparent overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-auto animate-fadeIn">
            <div className="px-4 py-3 rounded-t-2xl" style={{ background: '#dc2626', position: 'relative' }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: '20px', color: 'white' }}><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-7 0h8" /></svg></span>
                <h3 className="text-lg font-bold text-white">{t('deleteTicket')}</h3>
              </div>
              <button className="comment-modal-close" onClick={() => { setShowDeleteModal(false); setSelectedTicket(null); }} aria-label={t('close')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="p-4 text-center">
              <div className="mb-4">
              </div>
              <p className="text-gray-600 mb-2">{t('confirmDeleteTicket')}</p>
              <div className="font-semibold text-gray-900 mb-2">
                "{selectedTicket.subject}"
              </div>
              <p className="text-sm text-gray-500 mb-6">{t('actionCannotBeUndone')}</p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedTicket(null);
                  }}
                  className="w-24 px-3 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all duration-200 font-medium text-sm flex items-center justify-center gap-1"
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
    </div>
  );
}

