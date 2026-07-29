/**
 * AdminDashboard — the main overview page for system administrators.
 *
 * Displays:
 * - Five stat cards (total, pending, in progress, solved, unassigned)
 * - A pie chart showing ticket distribution by service (from recharts)
 * - A recent-tickets list (last 5)
 * - A trend chart (ApexCharts) with weekly/monthly/yearly toggle
 *
 * Dashboard data is fetched via a single /api/tickets/dashboard call that returns
 * stats, recent tickets, and service distribution.
 */
import { useEffect, useState, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ticketAPI, API_BASE_URL, extractArrayData, adminAPI } from '../services/api';
import { useSimpleToast } from '../components/SimpleToast';
import { getAttachmentDisplayName } from '../utils/fileUtils';
import SkeletonLoader from '../components/SkeletonLoader';
import { useTranslation } from 'react-i18next';
import CommentModal from '../components/CommentModal';
import Chart from 'react-apexcharts';

interface ServiceStat {
  name: string;
  count: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

interface Ticket {
  id: number;
  subject: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SOLVED';
  service?: string; serviceId?: number;
  organization?: string; organizationId?: number;
  createdBy?: string; createdById?: number;
  assignedTo?: string; assignedToId?: number;
  createdAt: string;
  attachmentPath?: string;
  priority?: string;
}

export default function AdminDashboard() {
  const { show, ToastContainer } = useSimpleToast();
  const { t } = useTranslation();

  // Section-level loading states for independent skeleton display
  const [loadingSections, setLoadingSections] = useState({
    stats: true,
    chart: true,
    recent: true,
  });

  // Dashboard summary stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    solved: 0,
    totalUsers: 0,
    totalOrganizations: 0,
    totalServices: 0,
    supportAgents: 0,
  });
  // Recent tickets list
  const [tickets, setTickets] = useState<Ticket[]>([]);
  // Count of unassigned tickets
  const [unassignedCount, setUnassignedCount] = useState(0);
  // Ticket distribution by service for pie chart
  const [serviceStats, setServiceStats] = useState<ServiceStat[]>([]);
  const [, setLoading] = useState(true);
  // View and comment modal state
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedCommentTicketId, _setSelectedCommentTicketId] = useState<number | null>(null);

  // Trend chart state
  const [trendPeriod, setTrendPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('yearly');
  const [trendData, setTrendData] = useState<{ period: string; total: number }[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  // Fetch and aggregate ticket data into period buckets for trend chart
  const fetchTrendData = async (period: 'weekly' | 'monthly' | 'yearly') => {
    setTrendLoading(true);
    try {
      const response = await ticketAPI.getAll();
      const allTickets = extractArrayData<Ticket>(response.data);
      const now = new Date();

      const buckets: { key: string; count: number; label: string }[] = [];

      if (period === 'yearly') {
        // 12 months of current year — count real tickets per month
        const year = now.getFullYear();
        for (let m = 0; m < 12; m++) {
          const key = `${year}-${String(m + 1).padStart(2, '0')}`;
          const date = new Date(year, m, 1);
          const label = date.toLocaleString('en-US', { month: 'short' });
          buckets.push({ key, count: 0, label });
        }
        for (const t of allTickets) {
          const d = new Date(t.createdAt);
          if (isNaN(d.getTime())) continue;
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const bucket = buckets.find(b => b.key === key);
          if (bucket) bucket.count++;
        }
      } else if (period === 'monthly') {
        const year = now.getFullYear();
        const month = now.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const dow = firstDay.getDay();
        let weekStart = new Date(firstDay);
        weekStart.setDate(firstDay.getDate() - dow);
        const ranges: { start: Date; end: Date }[] = [];
        let wn = 1;

        while (weekStart <= lastDay) {
          const end = new Date(weekStart);
          end.setDate(weekStart.getDate() + 6);
          ranges.push({ start: new Date(weekStart), end });
          buckets.push({ key: `${year}-M${month + 1}-W${wn}`, count: 0, label: `${t('week')} ${wn}` });
          weekStart.setDate(weekStart.getDate() + 7);
          wn++;
        }

        for (const t of allTickets) {
          const d = new Date(t.createdAt);
          if (isNaN(d.getTime())) continue;
          for (let i = 0; i < ranges.length; i++) {
            if (d >= ranges[i].start && d <= ranges[i].end) {
              buckets[i].count++;
              break;
            }
          }
        }
      } else {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          buckets.push({ key, count: 0, label: dayNames[d.getDay()] });
        }
        for (const t of allTickets) {
          const d = new Date(t.createdAt);
          if (isNaN(d.getTime())) continue;
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          const bucket = buckets.find(b => b.key === key);
          if (bucket) bucket.count++;
        }
      }

      setTrendData(buckets.map(b => ({ period: b.label, total: b.count })));
    } catch {
      setTrendData([]);
    } finally {
      setTrendLoading(false);
    }
  };

  // Load dashboard summary stats, recent tickets, and service distribution from API
  const loadDashboardData = async () => {
    try {
      const response = await adminAPI.getDashboardSummary();
      const data = response.data;

      const statsData = data.stats || {};
      setStats({
        total: statsData.total || 0,
        pending: statsData.pending || 0,
        inProgress: statsData.inProgress || 0,
        solved: statsData.solved || 0,
        totalUsers: data.totalUsers || 0,
        totalOrganizations: data.totalOrganizations || 0,
        totalServices: data.totalServices || 0,
        supportAgents: data.supportAgents || 0,
      });

      setUnassignedCount(data.unassignedTickets || 0);
      setTickets(data.recentTickets || []);
      setServiceStats(data.serviceDistribution || []);

    } catch (error) {
      setTickets([]);
      setUnassignedCount(0);
      setServiceStats([]);
      setStats({
        total: 0,
        pending: 0,
        inProgress: 0,
        solved: 0,
        totalUsers: 0,
        totalOrganizations: 0,
        totalServices: 0,
        supportAgents: 0,
      });
      show('error', t('error'), t('failedToLoadDashboardData'));
    } finally {
      setLoading(false);
      setLoadingSections({ stats: false, chart: false, recent: false });
    }
  };

  const loaded = useRef(false);

  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      loadDashboardData();
    }
    const interval = setInterval(loadDashboardData, 15000);
    const onVisible = () => { if (document.visibilityState === 'visible') loadDashboardData(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const trendFetched = useRef<string | null>(null);

  // Fetch trend data when period changes
  useEffect(() => {
    if (trendFetched.current !== trendPeriod) {
      trendFetched.current = trendPeriod;
      fetchTrendData(trendPeriod);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trendPeriod]);

  return (
    <div className="min-h-screen flex flex-col overflow-y-auto">
      <ToastContainer />
      <CommentModal
        ticketId={selectedCommentTicketId || 0}
        isOpen={showCommentModal}
        onClose={() => setShowCommentModal(false)}
      />

      {/* Main Content */}
      <div className="w-full px-2 py-2">
        {/* Dashboard View - Stats, Pie Chart & Recent Activity */}
        <div className="flex flex-col h-full">
          {/* Admin Dashboard Title with Icon */}
          <div className="flex items-center gap-3 mb-4">
            <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">{t('adminDashboard')}</h1>
            </div>
          </div>

          {/* Stats Cards - Professional Design */}
          {loadingSections.stats ? (
            <SkeletonLoader type="stats" />
          ) : (
          <div className="flex gap-3 w-full flex-wrap lg:flex-nowrap">
            {/* Card 1 - Total Tickets */}
            <div className="flex-1 h-full min-w-0 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100">
              <div className="p-3 sm:p-4 h-full flex items-center justify-between">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-[9px] sm:text-[10px] font-semibold text-gray-700 uppercase tracking-wider">{t('totalTickets')}</span>
                  <p className="text-xl sm:text-3xl font-bold text-gray-800">{stats.total}</p>
                  <p className="text-[10px] sm:text-xs text-gray-700">{t('assignedTickets')}</p>
                </div>
                <div className="p-1.5 bg-gradient-to-br from-gray-500 to-gray-700 rounded-xl shadow-md flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Card 2 - Pending */}
            <div className="flex-1 h-full min-w-0 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-amber-100">
              <div className="p-3 sm:p-4 h-full flex items-center justify-between">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-[9px] sm:text-[10px] font-semibold text-amber-500 uppercase tracking-wider">{t('pending')}</span>
                  <p className="text-xl sm:text-3xl font-bold text-amber-600">{stats.pending}</p>
                  <p className="text-[10px] sm:text-xs text-gray-700">{t('needsAttention')}</p>
                </div>
                <div className="p-1.5 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl shadow-md flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Card 3 - In Progress */}
            <div className="flex-1 h-full min-w-0 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-blue-100">
              <div className="p-3 sm:p-4 h-full flex items-center justify-between">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-[9px] sm:text-[10px] font-semibold text-blue-500 uppercase tracking-wider">{t('active')}</span>
                  <p className="text-xl sm:text-3xl font-bold text-blue-600">{stats.inProgress}</p>
                  <p className="text-[10px] sm:text-xs text-gray-700">{t('inProgressText')}</p>
                </div>
                <div className="p-1.5 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl shadow-md flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Card 4 - Solved */}
            <div className="flex-1 h-full min-w-0 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-emerald-100">
              <div className="p-3 sm:p-4 h-full flex items-center justify-between">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-[9px] sm:text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">{t('solved')}</span>
                  <p className="text-xl sm:text-3xl font-bold text-emerald-600">{stats.solved}</p>
                  <p className="text-[10px] sm:text-xs text-gray-700">{t('completedTickets')}</p>
                </div>
                <div className="p-1.5 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl shadow-md flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Card 5 - Unassigned */}
            <div className="flex-1 h-full min-w-0 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-purple-100">
              <div className="p-3 sm:p-4 h-full flex items-center justify-between">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-[9px] sm:text-[10px] font-semibold text-purple-500 uppercase tracking-wider">{t('unassigned')}</span>
                  <p className="text-xl sm:text-3xl font-bold text-purple-600">{unassignedCount}</p>
                  <p className="text-[10px] sm:text-xs text-gray-700">{t('notAssigned')}</p>
                </div>
                <div className="p-1.5 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl shadow-md flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Second Row - Users & Organizations */}
          {loadingSections.stats ? null : (
          <div className="flex gap-3 w-full mt-3 flex-wrap lg:flex-nowrap">
            {/* Card 6 - Total Users */}
            <div className="flex-1 h-full min-w-0 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-sky-100">
              <div className="p-3 sm:p-4 h-full flex items-center justify-between">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-[9px] sm:text-[10px] font-semibold text-sky-500 uppercase tracking-wider">{t('totalUsers')}</span>
                  <p className="text-xl sm:text-3xl font-bold text-sky-600">{stats.totalUsers}</p>
                  <p className="text-[10px] sm:text-xs text-gray-700">{t('registeredUsers')}</p>
                </div>
                <div className="p-1.5 bg-gradient-to-br from-sky-400 to-sky-600 rounded-xl shadow-md flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Card 7 - Total Organizations */}
            <div className="flex-1 h-full min-w-0 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-teal-100">
              <div className="p-3 sm:p-4 h-full flex items-center justify-between">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-[9px] sm:text-[10px] font-semibold text-teal-500 uppercase tracking-wider">{t('totalOrganizations')}</span>
                  <p className="text-xl sm:text-3xl font-bold text-teal-600">{stats.totalOrganizations}</p>
                  <p className="text-[10px] sm:text-xs text-gray-700">{t('activeOrganizations')}</p>
                </div>
                <div className="p-1.5 bg-gradient-to-br from-teal-400 to-teal-600 rounded-xl shadow-md flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-18v18M3 7h7m-3-3h1m-1 3v3m5-6h1m-1 3v3" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Card 8 - Total Services */}
            <div className="flex-1 h-full min-w-0 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-indigo-100">
              <div className="p-3 sm:p-4 h-full flex items-center justify-between">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-[9px] sm:text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">{t('totalServices')}</span>
                  <p className="text-xl sm:text-3xl font-bold text-indigo-600">{stats.totalServices}</p>
                  <p className="text-[10px] sm:text-xs text-gray-700">{t('activeServices')}</p>
                </div>
                <div className="p-1.5 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-xl shadow-md flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Card 9 - Resolution Rate */}
            <div className="flex-1 h-full min-w-0 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-emerald-100">
              <div className="p-3 sm:p-4 h-full flex items-center justify-between">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-[9px] sm:text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">{t('resolutionRate')}</span>
                  <p className="text-xl sm:text-3xl font-bold text-emerald-600">{stats.total > 0 ? Math.round((stats.solved / stats.total) * 100) : 0}%</p>
                  <p className="text-[10px] sm:text-xs text-gray-700">{t('solvedOfTotal', { solved: stats.solved, total: stats.total })}</p>
                </div>
                <div className="p-1.5 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl shadow-md flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Card 10 - Support Agents */}
            <div className="flex-1 h-full min-w-0 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-rose-100">
              <div className="p-3 sm:p-4 h-full flex items-center justify-between">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-[9px] sm:text-[10px] font-semibold text-rose-500 uppercase tracking-wider">{t('supportAgents')}</span>
                  <p className="text-xl sm:text-3xl font-bold text-rose-600">{stats.supportAgents}</p>
                  <p className="text-[10px] sm:text-xs text-gray-700">{t('activeAgents')}</p>
                </div>
                <div className="p-1.5 bg-gradient-to-br from-rose-400 to-rose-600 rounded-xl shadow-md flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Pie Chart & Recent Activity - Equal Height Cards */}
          <div className="flex gap-4 min-h-0 mt-4 flex-col lg:flex-row">
            {/* Pie Chart Card */}
            {loadingSections.chart ? (
              <SkeletonLoader type="chart" />
            ) : (
            <div className="flex-1 bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col overflow-hidden hover:shadow-xl transition-shadow duration-300" style={{ height: '460px', minHeight: '300px' }}>
              <div className="flex items-center gap-3 px-4 py-4">
                <div className="p-1.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-md flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-gray-800 font-bold text-lg">{t('distributionByService')}</h2>
                </div>
              </div>
              <div className="flex-1 p-6">
                {serviceStats.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 2a8 8 0 1 1-8 8 8 8 0 0 1 8-8z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6a6 6 0 1 0 6 6 6 6 0 0 0-6-6zm0 2a4 4 0 1 1-4 4 4 4 0 0 1 4-4z" />
                      </svg>
                      <p className="text-gray-500">{t('noServiceDataAvailable')}</p>
                      <p className="text-xs text-gray-400 mt-2">{t('createTicketsWithServices')}</p>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={serviceStats}
                        cx="50%"
                        cy="45%"
                        stroke="none"
                        outerRadius={120}
                        innerRadius={60}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {serviceStats.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, _name) => {
                          const total = serviceStats.reduce((sum, item) => sum + item.count, 0);
                          const numValue = Number(value) || 0;
                          const pct = total > 0 ? ((numValue / total) * 100).toFixed(1) : '0';
                          return [`${pct}% (${numValue})`, _name];
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
                        formatter={(value: string | number, entry: { payload?: { count?: number } }) => {
                          const count = entry?.payload?.count ?? 0;
                          return <span className="text-gray-700 text-sm font-medium">{value} ({count})</span>;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            )}

            {/* Recent Tickets Card */}
            {loadingSections.recent ? (
              <SkeletonLoader type="recent" />
            ) : (
            <div className="flex-1 bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col overflow-hidden hover:shadow-xl transition-shadow duration-300" style={{ height: '460px', minHeight: '300px' }}>
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
                  <div className="w-full overflow-x-auto">
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

          {/* Trend Chart - ApexCharts */}
          <div className="mt-4 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center justify-between px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-xl shadow-md flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-gray-800 font-bold text-lg">{t('ticketTrend')}</h2>
                  <p className="text-xs text-gray-700">{t('ticketTrendDesc')}</p>
                </div>
              </div>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {(['weekly', 'monthly', 'yearly'] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setTrendPeriod(period)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                      trendPeriod === period
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {t(period === 'weekly' ? 'weekly' : period === 'monthly' ? 'monthly' : 'yearly')}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-4 pb-4">
              {trendLoading ? (
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col" style={{ height: '460px', minHeight: '350px' }}>
                  <div className="flex items-center gap-3 px-6 py-4">
                    <div className="w-10 h-10 rounded-lg animate-shimmer" style={{background: 'linear-gradient(to right, #f1f5f9 4%, #e2e8f0 25%, #f1f5f9 36%)', backgroundSize: '1000px 100%'}}></div>
                    <div className="h-6 w-40 rounded animate-shimmer" style={{background: 'linear-gradient(to right, #f1f5f9 4%, #e2e8f0 25%, #f1f5f9 36%)', backgroundSize: '1000px 100%'}}></div>
                  </div>
                  <div className="flex-1 p-6 animate-shimmer" style={{background: 'linear-gradient(to right, #f1f5f9 4%, #e2e8f0 25%, #f1f5f9 36%)', backgroundSize: '1000px 100%', minHeight: '280px'}}></div>
                </div>
              ) : trendData.length === 0 ? (
                <div className="flex items-center justify-center h-[300px]">
                  <div className="text-center">
                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-gray-500">{t('noTrendData')}</p>
                  </div>
                </div>
              ) : (
                <Chart
                  options={{
                    chart: {
                      type: 'line',
                      toolbar: { show: false },
                      fontFamily: 'inherit',
                    },
                    colors: ['#4F6BFF'],
                    stroke: {
                      curve: 'smooth',
                      width: 3,
                      colors: ['#000000'],
                    },
                    markers: {
                      size: 6,
                      colors: ['#fff'],
                      strokeColors: ['#4F6BFF'],
                      strokeWidth: 2.5,
                      hover: { size: 8 },
                    },
                    fill: {
                      type: 'gradient',
                      gradient: {
                        shadeIntensity: 1,
                        opacityFrom: 0.3,
                        opacityTo: 0,
                        stops: [0, 90, 100],
                        colorStops: [
                          { offset: 0, color: '#000000', opacity: 0.3 },
                          { offset: 100, color: '#000000', opacity: 0 },
                        ],
                      },
                    },
                    xaxis: {
                      categories: trendData.map(d => d.period),
                      labels: {
                        style: { fontSize: '12px', colors: '#374151' },
                      },
                      axisBorder: { show: false },
                      axisTicks: { show: false },
                    },
                    yaxis: {
                      min: 0,
                      forceNiceScale: true,
                      tickAmount: 5,
                      title: { text: t('tickets'), style: { fontSize: '12px', color: '#374151' } },
                      labels: {
                        style: { fontSize: '12px', colors: '#374151' },
                        rotate: 0,
                        formatter: (val: number) => Number.isInteger(val) ? String(val) : '',
                      },
                    },
                    grid: {
                      borderColor: '#F2F2F2',
                      strokeDashArray: 5,
                      xaxis: { lines: { show: false } },
                    },
                    tooltip: {
                      theme: 'light',
                      style: { fontSize: '13px' },
                      x: { show: true },
                      y: { formatter: (val: number) => `${val} tickets` },
                    },
                    dataLabels: { enabled: false },
                    noData: { text: 'No data' },
                  }}
                  series={[{
                    name: t('tickets'),
                    data: trendData.map(d => d.total),
                  }]}
                  type="line"
                  height={300}
                />
              )}
            </div>
          </div>

        </div>
      </div>

      {/* View Ticket Modal */}
      {showViewModal && selectedTicket && (
        <div className="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full z-50 flex items-start justify-center pt-8 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-auto animate-fadeIn">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 rounded-t-2xl">
              <div className="flex items-center justify-center">
                <h3 className="text-lg font-bold text-white">{t('ticketDetails')}</h3>
              </div>
            </div>
            <div className="p-4">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('ticketId')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{selectedTicket.id}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('subject')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{selectedTicket.subject}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('description')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1 whitespace-pre-wrap" style={{ overflowWrap: 'break-word' }}>{selectedTicket.description}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('serviceText')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{selectedTicket.service || t('unknown')}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('organization')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{selectedTicket.organization || t('unknown')}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('status')}</label>
                  <div className="mt-1">
                    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold shadow-sm ${
                      selectedTicket.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                      selectedTicket.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {selectedTicket.status === 'PENDING' ? t('pending') : selectedTicket.status === 'IN_PROGRESS' ? t('inProgress') : t('solved')}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('createdBy')}</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{selectedTicket.createdBy || t('unknown')}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(selectedTicket.createdAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                {selectedTicket.attachmentPath && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('attachment')}</label>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-medium text-gray-900">
                        {getAttachmentDisplayName(selectedTicket.attachmentPath)}
                      </span>
                      <div className="flex items-center gap-1">
                        <a
                          href={`${API_BASE_URL}/uploads/${selectedTicket.attachmentPath}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700"
                          title={t('viewAttachment')}
                        >
                          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedTicket(null);
                  }}
                  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md font-medium"
                >
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

