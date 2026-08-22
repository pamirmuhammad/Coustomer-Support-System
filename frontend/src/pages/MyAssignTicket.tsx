import { useEffect, useState, useRef } from 'react';
import { ticketAPI, API_BASE_URL, extractArrayData } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSimpleToast } from '../components/SimpleToast';
import { getAttachmentDisplayName } from '../utils/fileUtils';
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

// MyAssignTicket — view and manage tickets assigned to the current user with status updates and comments
export default function MyAssignTicket() {
  const { user } = useAuth();
  const { show, ToastContainer } = useSimpleToast();
  const { t } = useTranslation();
  // Assigned tickets data
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  // Modal and filter state
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'IN_PROGRESS' | 'SOLVED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  // Comment modal state
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedCommentTicketId, setSelectedCommentTicketId] = useState<number | null>(null);
  const [unreadComments, setUnreadComments] = useState<Record<number, number>>({});
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  // Track last-read comment counts per ticket, persisted in localStorage
  const [lastReadComments, setLastReadComments] = useState<Record<number, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('lastReadComments') || '{}');
    } catch {
      return {};
    }
  });

  const loaded = useRef(false);

  useEffect(() => {
    if (user?.id && !loaded.current) {
      loaded.current = true;
      loadTickets();
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Fetch tickets assigned to the current user and compute unread counts
  const loadTickets = async () => {
    try {
      if (user?.id) {
        const response = await ticketAPI.getByAssignedUser(user.id);
        const assignedTickets = extractArrayData<Ticket>(response.data);
        // Sort by ID automatically
        const sortedTickets = assignedTickets.sort((a: Ticket, b: Ticket) => a.id - b.id);
        setTickets(sortedTickets);
        // Use commentCount from the DTO instead of individual API calls
        const counts: Record<number, number> = {};
        sortedTickets.forEach(ticket => {
          const total = ticket.commentCount || 0;
          const read = lastReadComments[ticket.id] || 0;
          if (total > read) counts[ticket.id] = total - read;
        });
        setUnreadComments(counts);
      }
    } catch (error) {
      setTickets([]);
      show('error', t('error'), t('errorFetchingAssignedTickets'));
    } finally {
      setLoading(false);
    }
  };

  // Update ticket status and refresh the list
  const handleStatusChange = async (ticketId: number, status: string) => {
    try {
      await ticketAPI.updateStatus(ticketId, status);
      show('success', t('success'), t('statusUpdatedSuccessfully'));
      loadTickets();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      show('error', t('error'), err.response?.data?.message || t('errorUpdatingTicketStatus'));
    }
  };

  // Count tickets per status for filter display
  const pendingCount = tickets.filter(t => t.status === 'PENDING').length;
  const inProgressCount = tickets.filter(t => t.status === 'IN_PROGRESS').length;
  const solvedCount = tickets.filter(t => t.status === 'SOLVED').length;

  const filteredTickets = [...tickets]
    .filter(ticket => {
      const matchesStatus = statusFilter === 'ALL' || ticket.status === statusFilter;
      const matchesSearch = searchQuery === '' || 
        (ticket.service && ticket.service.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (ticket.organization && ticket.organization.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (ticket.status && ticket.status.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (ticket.subject && ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => b.id - a.id);

  // Pagination logic
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
          // Immediately update last seen count when modal closes
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
          <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-5 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md flex items-center justify-center shrink-0">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold text-gray-800">{t('myAssignedTickets')}</h2>
                </div>
                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap w-full sm:w-auto">
                  {/* Search Input */}
                  <input
                    type="text"
                    placeholder={t('Search tickets...')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-4 pr-4 py-2.5 rounded-lg border-2 outline-none text-sm text-gray-700 w-full sm:w-48 transition-all duration-200"
                    style={{
                      background: '#ffffff',
                      border: '2px solid #2b51b1'
                    }}
                  />
                {/* Status Filter Dropdown */}
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
                      userSelect: 'none',
                      whiteSpace: 'nowrap'
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
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="w-full overflow-x-auto">
            <div className="overflow-y-auto" style={{ maxHeight: '540px' }}>
              <table className="w-full">
                <thead className="bg-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider whitespace-nowrap" style={{ width: '10%' }}>{t('ticketId')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider" style={{ width: '25%' }}>{t('subject')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider" style={{ width: '18%' }}>{t('serviceText')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider" style={{ width: '18%' }}>{t('organization')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider whitespace-nowrap" style={{ width: '14%' }}>{t('status')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500  tracking-wider whitespace-nowrap" style={{ width: '15%' }}>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300">
                  {currentTickets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="text-center">
                          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                          </svg>
                          <p className="text-gray-500">{t('noTicketsFound')}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentTickets.map((ticket, index) => (
                      <tr key={ticket.id} className="border-b border-gray-300 hover:bg-gray-50 transition-colors duration-150">
                        <td className="px-4 py-2 whitespace-nowrap text-center">
                          <span className="text-sm font-semibold text-gray-900">{indexOfFirstItem + index + 1}</span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className="text-sm font-semibold text-gray-900">{ticket.subject}</span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className="text-sm font-semibold text-gray-900">{ticket.service || t('unknownService')}</span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className="text-sm font-semibold text-gray-900">{ticket.organization || t('unknown')}</span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-center">
                            <select
                              value={ticket.status}
                              onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                              className="px-3 py-1 rounded-lg text-xs font-semibold border-2 transition-all duration-200 cursor-pointer"
                              style={{
                                color: '#000000',
                                backgroundColor: ticket.status === 'PENDING' ? '#fef3c7' :
                                                ticket.status === 'IN_PROGRESS' ? '#dbeafe' :
                                                '#dcfce7',
                                borderColor: ticket.status === 'PENDING' ? '#fcd34d' :
                                             ticket.status === 'IN_PROGRESS' ? '#93c5fd' :
                                             '#86efac'
                              }}
                            >
                              <option value="PENDING" disabled={ticket.status === 'SOLVED'} style={{ color: '#000000', backgroundColor: 'white' }}>{t('pending')}</option>
                              <option value="IN_PROGRESS" disabled={ticket.status === 'SOLVED'} style={{ color: '#000000', backgroundColor: 'white' }}>{t('inProgress')}</option>
                              <option value="SOLVED" style={{ color: '#000000', backgroundColor: 'white' }}>{t('solved')}</option>
                            </select>
                          </td>
                        <td className="px-4 py-2 text-center shrink-0">
                          <div className="flex items-center justify-center gap-1 shrink-0">
                            <button
                              onClick={() => {
                                setSelectedTicket(ticket);
                                setShowViewModal(true);
                              }}
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
                              onClick={() => {
                                setSelectedCommentTicketId(ticket.id);
                                setShowCommentModal(true);
                              }}
                              className="relative text-2xl hover:scale-110 transition-transform duration-200 text-teal-600 shrink-0"
                              title={t('comment')}
                              aria-label={t('comment')}
                            >
                              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                              {unreadComments[ticket.id] > 0 && (
                                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                                    {unreadComments[ticket.id] > 9 ? '9+' : unreadComments[ticket.id]}
                                  </span>
                                )}
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
          {filteredTickets.length > 0 && (
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
                  {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredTickets.length)} {t('of')} {filteredTickets.length} {t('items')}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* View Ticket Modal */}
      {showViewModal && selectedTicket && (
        <div className="fixed inset-0 bg-transparent overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-auto animate-fadeIn" style={{ minHeight: '400px' }}>
            <div className="px-4 py-3 rounded-t-2xl" style={{ background: '#2b51b1', position: 'relative' }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: '20px', color: 'white' }}><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg></span>
                <h3 className="text-lg font-bold text-white">{t('ticketDetails')}</h3>
              </div>
              <button className="comment-modal-close" onClick={() => setShowViewModal(false)} aria-label={t('close')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Row 1: Service + Subject */}
              <div className="flex gap-4 mb-4">
                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">{t('serviceText')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">
                    {selectedTicket.service || t('unknown')}
                  </p>
                </div>
                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">{t('subject')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">{selectedTicket.subject}</p>
                </div>
              </div>

              {/* Row 2: Organization + Status */}
              <div className="flex gap-4 mb-4">
                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">{t('organization')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">
                    {selectedTicket.organization || t('noOrganization')}
                  </p>
                </div>
                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">{t('status')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">
                    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold shadow-sm ${
                      selectedTicket.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                      selectedTicket.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {selectedTicket.status.replace('_', ' ')}
                    </span>
                  </p>
                </div>
              </div>

              {/* Row 3: Created By + Created At */}
              <div className="flex gap-4 mb-4">
                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">{t('createdBy')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">
                    {selectedTicket.createdBy || t('unknown')}
                  </p>
                </div>
                <div className="w-1/2" style={{ minHeight: '60px' }}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">{t('createdAt')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200">
                    {new Date(selectedTicket.createdAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">{t('description')}</label>
                <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200" style={{ minHeight: '80px', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>{selectedTicket.description}</p>
              </div>

              {/* Attachment */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">{t('attachment')}</label>
                <p className="text-sm font-medium text-gray-900 mt-1 bg-gray-50 px-3 py-2 rounded border border-gray-200 flex items-center justify-center">
                  {selectedTicket.attachmentPath ? (
                    <div className="flex items-center w-full">
                      <span className="text-gray-700 truncate flex-1 mr-3">
                        {getAttachmentDisplayName(selectedTicket.attachmentPath)}
                      </span>
                      <div className="flex items-center gap-1">
                        <a 
                          href={`${API_BASE_URL}/uploads/${selectedTicket.attachmentPath}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-2xl hover:scale-110 transition-transform duration-200 text-slate-600"
                          title={t('viewAttachment')}
                        >
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                        </a>
                        <button
                          onClick={async (e) => {
                            e.preventDefault();
                            try {
                              const response = await fetch(`${API_BASE_URL}/uploads/${selectedTicket.attachmentPath!}`);
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
                              link.href = `${API_BASE_URL}/uploads/${selectedTicket.attachmentPath!}`;
                              link.target = '_blank';
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            } 
                          }}
                          className="text-2xl hover:scale-110 transition-transform duration-200 text-blue-500 bg-transparent border-none cursor-pointer p-0"
                        >
                          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-500">{t('noAttachment')}</span>
                  )}
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowViewModal(false)}
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


