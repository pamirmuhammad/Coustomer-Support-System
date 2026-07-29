import { useEffect, useState, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ticketAPI, extractArrayData } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
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
}

// OrganizationDashboard — stats overview with pie chart and recent tickets list for an org
export default function OrganizationDashboard() {
  const { user } = useAuth();
  const { show, ToastContainer } = useSimpleToast();
  const { t } = useTranslation();
  // Dashboard summary stats for the org
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    solved: 0,
  });
  // Section-level loading states for independent skeleton display
  const [loadingSections, setLoadingSections] = useState({
    stats: true,
    chart: true,
    recent: true,
  });
  // Org tickets list and comment modal state
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedCommentTicketId] = useState<number | null>(null);
  const [, setUnreadComments] = useState<Record<number, number>>({});
  const [, setLastReadComments] = useState<Record<number, number>>({});

  // Fetch org tickets and compute summary stats
  const loadDashboardData = async () => {
    try {
      if (!user?.organizationId) {
        show('warning', t('accountSetupRequired'), t('accountNotAssociatedWithOrg'));
        setTickets([]);
        setStats({ total: 0, pending: 0, inProgress: 0, solved: 0 });
        setLoadingSections({ stats: false, chart: false, recent: false });
        return;
      }

      const res = await ticketAPI.getAll();
      let allTickets = extractArrayData<Ticket>(res.data);
      if (user?.id) {
        allTickets = allTickets.filter(ticket => ticket.createdById === user.id);
      }

      const sortedTickets = allTickets.sort((a: Ticket, b: Ticket) => b.id - a.id);
      setTickets(sortedTickets);
      setStats({
        total: sortedTickets.length,
        pending: sortedTickets.filter((t: Ticket) => t.status === 'PENDING').length,
        inProgress: sortedTickets.filter((t: Ticket) => t.status === 'IN_PROGRESS').length,
        solved: sortedTickets.filter((t: Ticket) => t.status === 'SOLVED').length,
      });
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      if (err.response?.status === 403) {
        show('error', t('permissionDenied'), t('permissionDeniedMessage'));
      } else {
        show('error', t('error'), t('failedToLoadDashboardData'));
      }
      setTickets([]);
      setStats({
        total: 0,
        pending: 0,
        inProgress: 0,
        solved: 0,
      });
    } finally {
      setLoadingSections({ stats: false, chart: false, recent: false });
    }
  };

  const loaded = useRef(false);

  useEffect(() => {
    if (user?.id && user?.organizationId && !loaded.current) {
      loaded.current = true;
      loadDashboardData();
    } else if (user?.id && !user?.organizationId) {
      show('warning', t('accountSetupRequired'), t('accountNotAssociatedWithOrg'));
      setTickets([]);
      setStats({ total: 0, pending: 0, inProgress: 0, solved: 0 });
      setLoadingSections({ stats: false, chart: false, recent: false });
    }

    const handleProfileUpdate = () => {
      if (user?.id && user?.organizationId) {
        loadDashboardData();
      }
    };

    window.addEventListener('userProfileUpdated', handleProfileUpdate);

    return () => {
      window.removeEventListener('userProfileUpdated', handleProfileUpdate);
    };
  }, [user?.id, user?.organizationId]);



  return (
    <div className="min-h-screen flex flex-col overflow-y-auto">
      <ToastContainer />
      {/* Comment Modal */}
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
      <div className="w-full px-2 py-2">
        {/* Dashboard Stats & Content */}
        <div className="flex flex-col h-full">
          {/* Organization Dashboard Title */}
          <div className="flex items-center gap-3 mb-4">
            <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">{t('organizationDashboard')}</h1>
            </div>
          </div>

          {/* Stats Cards */}
          {loadingSections.stats ? (
            <SkeletonLoader type="stats" />
          ) : (
          <div className="flex gap-3 w-full flex-wrap lg:flex-nowrap">
            <div className="flex-1 h-full min-w-0 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100">
              <div className="p-4 h-full flex items-center justify-between">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-[10px] font-semibold text-gray-700 uppercase tracking-wider">{t('totalTickets')}</span>
                  <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
                  <p className="text-xs text-gray-700">{t('assignedTickets')}</p>
                </div>
                <div className="p-1.5 bg-gradient-to-br from-gray-500 to-gray-700 rounded-xl shadow-md flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="flex-1 h-full min-w-0 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-amber-100">
              <div className="p-4 h-full flex items-center justify-between">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider">{t('pending')}</span>
                  <p className="text-3xl font-bold text-amber-600">{stats.pending}</p>
                  <p className="text-xs text-gray-700">{t('needsAttention')}</p>
                </div>
                <div className="p-1.5 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl shadow-md flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="flex-1 h-full min-w-0 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-blue-100">
              <div className="p-4 h-full flex items-center justify-between">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">{t('active')}</span>
                  <p className="text-3xl font-bold text-blue-600">{stats.inProgress}</p>
                  <p className="text-xs text-gray-700">{t('inProgressText')}</p>
                </div>
                <div className="p-1.5 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl shadow-md flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="flex-1 h-full min-w-0 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-emerald-100">
              <div className="p-4 h-full flex items-center justify-between">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">{t('solved')}</span>
                  <p className="text-3xl font-bold text-emerald-600">{stats.solved}</p>
                  <p className="text-xs text-gray-700">{t('completedTickets')}</p>
                </div>
                <div className="p-1.5 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl shadow-md flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          )}

          <div className="flex gap-4 min-h-0 mt-4 flex-col lg:flex-row">
            {loadingSections.chart ? (
              <SkeletonLoader type="chart" />
            ) : (
            <div className="flex-1 bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col overflow-hidden hover:shadow-xl transition-shadow duration-300" style={{ height: '460px', minHeight: '300px' }}>
              {/* Pie Chart: Status Distribution */}
              <div className="flex items-center gap-3 px-4 py-4">
                <div className="p-1.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-md flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-gray-800 font-bold text-lg">{t('statusDistribution')}</h2>
                </div>
              </div>
              <div className="flex-1 p-6" style={{ minHeight: '280px' }}>
                {tickets.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <p className="text-gray-500">{t('noDataAvailable')}</p>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: t('pending'), value: stats.pending, color: '#f59e0b' },
                          { name: t('inProgress'), value: stats.inProgress, color: '#3b82f6' },
                          { name: t('solved'), value: stats.solved, color: '#22c55e' },
                        ]}
                        cx="50%"
                        cy="45%"
                        stroke="none"
                        outerRadius={120}
                        innerRadius={60}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[
                          { name: t('pending'), color: '#f59e0b' },
                          { name: t('inProgress'), color: '#3b82f6' },
                          { name: t('solved'), color: '#22c55e' },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => {
                          const v = Number(value) || 0;
                          const total = stats.pending + stats.inProgress + stats.solved;
                          const pct = total > 0 ? ((v / total) * 100).toFixed(1) : '0';
                          return [`${pct}% (${v})`, name];
                        }}
                        contentStyle={{
                          borderRadius: '12px',
                          border: 'none',
                          boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                          padding: '8px 12px'
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        align="center"
                        height={30}
                        iconType="circle"
                        formatter={(value) => <span className="text-gray-700 text-sm font-medium">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            )}
            {loadingSections.recent ? (
              <SkeletonLoader type="recent" />
            ) : (
            <div className="flex-1 bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col overflow-hidden hover:shadow-xl transition-shadow duration-300" style={{ height: '460px', minHeight: '300px' }}>
              {/* Recent Tickets Header */}
              <div className="flex items-center gap-3 px-4 py-4">
                <div className="p-1.5 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl shadow-md flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-gray-800 font-bold text-lg">{t('recentTickets')}</h2>
                </div>
              </div>
              <div className="flex-1 p-3 overflow-auto">
                {tickets.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <p className="text-gray-500">{t('noRecentTickets')}</p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                  <table className="w-full text-xs table-fixed">
                    <thead>
                      <tr className="text-gray-700 font-semibold border-b border-gray-200">
                        <th className="py-3 text-center w-[8%]">{t('id')}</th>
                        <th className="py-3 text-center w-[28%]">{t('service')}</th>
                        <th className="py-3 text-center w-[16%]">{t('status')}</th>
                        <th className="py-3 text-center w-[22%]">{t('username')}</th>
                        <th className="py-3 text-center w-[26%]">{t('createdAt')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...tickets].sort((a, b) => b.id - a.id).slice(0, 5).map((ticket) => (
                        <tr key={ticket.id} className="group hover:bg-gray-50 transition-all duration-200 border-b border-gray-100">
                          <td className="py-3 text-center text-gray-600 font-medium truncate">{ticket.id}</td>
                          <td className="py-3 text-center text-gray-800 font-semibold truncate group-hover:text-blue-600 transition-colors">{ticket.service || ticket.subject || t('unknown')}</td>
                          <td className="py-3 text-center">
                            <span className={`inline-block px-2 py-0.5 shadow-sm text-xs font-semibold text-white ${
                              ticket.status === 'PENDING' ? 'bg-gradient-to-br from-amber-400 to-amber-500' :
                              ticket.status === 'IN_PROGRESS' ? 'bg-gradient-to-br from-blue-400 to-blue-500' :
                              'bg-gradient-to-br from-emerald-400 to-emerald-500'
                            }`}>
                              {ticket.status === 'PENDING' ? t('pending') : ticket.status === 'IN_PROGRESS' ? t('inProgress') : t('solved')}
                            </span>
                          </td>
                          <td className="py-3 text-center text-gray-900 truncate">{ticket.createdBy || t('unknown')}</td>
                          <td className="py-3 text-center text-gray-800 whitespace-nowrap">
                            {new Date(ticket.createdAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
