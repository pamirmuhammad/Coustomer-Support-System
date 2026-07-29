import { useState, useEffect, useRef } from 'react';
import { ticketAPI, serviceAPI, userAPI, organizationAPI, extractArrayData } from '../services/api';
import { useSimpleToast } from '../components/SimpleToast';
import SkeletonLoader from '../components/SkeletonLoader';
import { useTranslation } from 'react-i18next';

function escapeHtml(str: unknown): string {
  const s = String(str ?? '');
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

interface Ticket {
  id: number;
  subject: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SOLVED';
  service?: string; serviceId?: number;
  organization?: string; organizationId?: number;
  assignedTo?: string; assignedToId?: number;
  createdBy?: string; createdById?: number;
  createdAt: string;
  solvedAt?: string;
}

interface ServiceItem {
  id: number;
  name: string;
  description?: string;
}

interface UserItem {
  id: number;
  username: string;
  email: string;
  role?: { id: number; name: string };
  organization?: { id: number; name: string };
}

interface OrgItem {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  createdAt?: string;
}

type ReportValue = string | number | boolean | null | undefined | { [key: string]: unknown };

interface ReportSection {
  title: string;
  data: Record<string, unknown>[];
  fieldMapping: Record<string, string>;
}

// Reports — generate and export reports (tickets/users/orgs/services) in CSV, PDF, or DOCX
export default function Reports() {
  const { show, ToastContainer } = useSimpleToast();
  const { t } = useTranslation();
  // Filter dropdown data from API
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [organizations, setOrganizations] = useState<OrgItem[]>([]);
  // Selected filter values
  const [selectedService, setSelectedService] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');
  const [selectedOrganization, setSelectedOrganization] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  // Report type and export format
  const [reportType, setReportType] = useState('tickets');
  const [format, setFormat] = useState('excel');
  // Loading and preview state
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState({ total: 0, pending: 0, inProgress: 0, solved: 0, unassigned: 0 });
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [serviceCategories, setServiceCategories] = useState<string[]>([]);
  const [recordCount, setRecordCount] = useState(0);

  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    const loadFilterData = async () => {
      try {
        const [svcRes, usrRes, orgRes] = await Promise.all([
          serviceAPI.getAll(),
          userAPI.getAll(),
          organizationAPI.getAll(),
        ]);
        const svcData = extractArrayData<ServiceItem>(svcRes.data);
        setServices(svcData);
        setUsers(extractArrayData<UserItem>(usrRes.data));
        setOrganizations(extractArrayData<OrgItem>(orgRes.data));

        // Derive service categories from first word of each service name
        const categories = [...new Set(svcData.map(s => s.name.split(' ')[0]))].sort();
        setServiceCategories(categories);
      } catch {
        // filter dropdowns stay empty on error
      }
    };

    const loadPreview = async () => {
      setPreviewLoading(true);
      try {
        const statsRes = await ticketAPI.getStatistics();
        const stats = statsRes.data;
        setPreviewData({
          total: stats.totalTickets ?? stats.total ?? 0,
          pending: stats.pending ?? 0,
          inProgress: stats.inProgress ?? 0,
          solved: stats.solved ?? 0,
          unassigned: 0,
        });
      } catch {
        // preview stays at zeros on error
      } finally {
        setPreviewLoading(false);
      }

      try {
        const unassignedRes = await ticketAPI.getUnassigned();
        setUnassignedCount(extractArrayData(unassignedRes.data).length);
      } catch {
        setUnassignedCount(0);
      }
    };

    loadFilterData();
    loadPreview();
  }, []);

  const usersByServiceFetched = useRef<string | null>(null);

  // Filter users by selected service
  useEffect(() => {
    if (usersByServiceFetched.current !== selectedService) {
      usersByServiceFetched.current = selectedService;
      const loadUsersByService = async () => {
        if (selectedService === 'all') {
          try {
            const usrRes = await userAPI.getAll();
            setUsers(extractArrayData<UserItem>(usrRes.data));
          } catch {
            // keep current users
          }
        } else {
          const service = services.find(s => s.id === parseInt(selectedService));
          if (service) {
            try {
              const usrRes = await userAPI.getByService(service.name);
              setUsers(extractArrayData<UserItem>(usrRes.data));
            } catch {
              setUsers([]);
            }
          }
        }
      };
      loadUsersByService();
    }
  }, [selectedService]);

  const countFiltersFetched = useRef<string | null>(null);

  // Update record count when filters change
  useEffect(() => {
    const key = `${reportType}|${selectedService}|${selectedUser}|${selectedOrganization}|${startDate}|${endDate}`;
    if (countFiltersFetched.current !== key) {
      countFiltersFetched.current = key;
      const updateCount = async () => {
        if (reportType === 'all') {
          try {
            const [ticketRes, orgRes, usrRes, svcRes] = await Promise.all([
              ticketAPI.getAll(),
              organizationAPI.getAll(),
              userAPI.getAll(),
              serviceAPI.getAll(),
            ]);
            const total = extractArrayData(ticketRes.data).length
              + extractArrayData(orgRes.data).length
              + extractArrayData(usrRes.data).length
              + extractArrayData(svcRes.data).length;
            setRecordCount(total);
          } catch {
            setRecordCount(0);
          }
        } else if (reportType === 'tickets') {
          try {
            const res = await ticketAPI.getAll();
            let data = extractArrayData<Ticket>(res.data);
            if (selectedService !== 'all') {
              data = data.filter((t) => t.serviceId === parseInt(selectedService));
            }
            if (selectedUser !== 'all') {
              data = data.filter((t) => t.assignedToId === parseInt(selectedUser));
            }
            if (selectedOrganization !== 'all') {
              data = data.filter((t) => t.organizationId === parseInt(selectedOrganization));
            }
            if (startDate && endDate) {
              const st = new Date(startDate).setHours(0, 0, 0, 0);
              const en = new Date(endDate).setHours(23, 59, 59, 999);
              data = data.filter((t) => {
                const d = new Date(t.createdAt).getTime();
                return d >= st && d <= en;
              });
            }
            setRecordCount(data.length);
          } catch {
            setRecordCount(0);
          }
      } else if (reportType === 'users') {
        setRecordCount(users.length);
      } else if (reportType === 'organizations') {
        setRecordCount(organizations.length);
      } else if (reportType === 'services') {
        setRecordCount(services.length);
      }
    };
    updateCount();
    }
  }, [reportType, selectedService, selectedUser, selectedOrganization, startDate, endDate, users, organizations, services]);

  // Set quick date range preset (e.g., last 7, 30, 90 days)
  const setQuickDateRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  // Set date range to the last year
  const setAnnualRange = () => {
    const end = new Date();
    const start = new Date();
    start.setFullYear(start.getFullYear() - 1);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  // Fetch filtered data and generate downloadable report in selected format
  const generateReport = async () => {
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      show('error', 'Error', 'Start date must be before end date');
      return;
    }

    setLoading(true);

    try {
      const dateStr = new Date().toISOString().split('T')[0];

      if (reportType === 'all') {
        const [ticketRes, orgRes, usrRes, svcRes] = await Promise.all([
          ticketAPI.getAll(),
          organizationAPI.getAll(),
          userAPI.getAll(),
          serviceAPI.getAll(),
        ]);

        const sections: ReportSection[] = [
          {
            title: 'Tickets Report',
            data: extractArrayData<Ticket>(ticketRes.data) as unknown as Record<string, unknown>[],
            fieldMapping: {
              id: 'Ticket ID', subject: 'Subject', service: 'Service',
              organization: 'Organization', assignedTo: 'Assigned To',
              createdBy: 'Created By', status: 'Status', createdAt: 'Created At', solvedAt: 'Solved At',
            },
          },
          {
            title: 'Organizations Report',
            data: extractArrayData<Record<string, unknown>>(orgRes.data),
            fieldMapping: {
              id: 'Organization ID', name: 'Organization Name', email: 'Email',
              phone: 'Phone', address: 'Address', createdAt: 'Created At',
            },
          },
          {
            title: 'Users Report',
            data: extractArrayData<Record<string, unknown>>(usrRes.data),
            fieldMapping: {
              id: 'User ID', username: 'Username', email: 'Email',
              role: 'Role', organization: 'Organization', createdAt: 'Created At',
            },
          },
          {
            title: 'Services Report',
            data: extractArrayData<Record<string, unknown>>(svcRes.data),
            fieldMapping: {
              id: 'Service ID', name: 'Service Name', description: 'Description', createdAt: 'Created At',
            },
          },
        ];

        const totalRecords = sections.reduce((sum, s) => sum + s.data.length, 0);
        if (totalRecords === 0) {
          show('warning', 'Warning', 'No data found for the selected criteria');
          setLoading(false);
          return;
        }

        if (format === 'excel') {
          generateExcelMulti(sections, `all_reports_${dateStr}`);
        } else {
          generatePDFMulti(sections, `all_reports_${dateStr}`);
        }

        show('success', 'Success', `All reports generated successfully with ${totalRecords} records`);
      } else {
        let data: Record<string, unknown>[] = [];
        let fieldMapping: Record<string, string> = {};

        switch (reportType) {
          case 'tickets':
            fieldMapping = {
              id: 'Ticket ID', subject: 'Subject', service: 'Service',
              organization: 'Organization', assignedTo: 'Assigned To',
              createdBy: 'Created By', status: 'Status', createdAt: 'Created At', solvedAt: 'Solved At',
            };
            const ticketResponse = await ticketAPI.getAll();
            let ticketsData = extractArrayData<Ticket>(ticketResponse.data);
            if (selectedService !== 'all') ticketsData = ticketsData.filter((t) => t.serviceId === parseInt(selectedService));
            if (selectedUser !== 'all') ticketsData = ticketsData.filter((t) => t.assignedToId === parseInt(selectedUser));
            if (selectedOrganization !== 'all') ticketsData = ticketsData.filter((t) => t.organizationId === parseInt(selectedOrganization));
            if (startDate && endDate) {
              const st = new Date(startDate).setHours(0, 0, 0, 0);
              const en = new Date(endDate).setHours(23, 59, 59, 999);
              ticketsData = ticketsData.filter((t) => {
                const d = new Date(t.createdAt).getTime();
                return d >= st && d <= en;
              });
            }
            data = ticketsData as unknown as Record<string, unknown>[];
            break;

          case 'organizations':
            fieldMapping = {
              id: 'Organization ID', name: 'Organization Name', email: 'Email',
              phone: 'Phone', address: 'Address', createdAt: 'Created At',
            };
            const orgResponse = await organizationAPI.getAll();
            data = extractArrayData<Record<string, unknown>>(orgResponse.data);
            break;

          case 'users':
            fieldMapping = {
              id: 'User ID', username: 'Username', email: 'Email',
              role: 'Role', organization: 'Organization', createdAt: 'Created At',
            };
            const userResponse = await userAPI.getAll();
            data = extractArrayData<Record<string, unknown>>(userResponse.data);
            break;

          case 'services':
            fieldMapping = {
              id: 'Service ID', name: 'Service Name', description: 'Description', createdAt: 'Created At',
            };
            const serviceResponse = await serviceAPI.getAll();
            data = extractArrayData<Record<string, unknown>>(serviceResponse.data);
            break;

          default:
            return;
        }

        if (data.length === 0) {
          show('warning', 'Warning', 'No data found for the selected criteria');
          setLoading(false);
          return;
        }

        data.sort((a, b) => (a.id as number) - (b.id as number));
        const reportFilename = `${reportType}_report_${dateStr}`;

        if (format === 'excel') {
          generateExcel(data, reportFilename, fieldMapping);
        } else {
          generatePDF(data, reportFilename, fieldMapping);
        }

        show('success', 'Success', `Report generated successfully with ${data.length} records`);
      }
    } catch {
      show('error', 'Error', 'Failed to generate report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Generate and download report as Excel (HTML-based .xls) with centered merged header and logo
  const generateExcel = (data: Record<string, unknown>[], _filename: string, fieldMapping: Record<string, string>) => {
    const colCount = Object.keys(fieldMapping).length;

    let html = `<html><head><meta charset="utf-8"><title></title></head><body>`;
    html += `<table border="0" cellpadding="4" cellspacing="0" style="font-family:Arial,sans-serif;font-size:12px;width:100%">`;


    // Ministry
    html += `<tr><td colspan="${colCount}" align="center" style="font-size:16px;font-weight:bold;padding:2px">Ministry of Communication &amp; Information Technology</td></tr>`;
    // Directorate
    html += `<tr><td colspan="${colCount}" align="center" style="font-size:13px;color:#555;padding:2px">Directorate of Information Technology</td></tr>`;
    // System name
    html += `<tr><td colspan="${colCount}" align="center" style="font-size:14px;font-weight:bold;color:#3b82f6;padding:2px">Customer Support System</td></tr>`;
    // Divider
    html += `<tr><td colspan="${colCount}" style="border-bottom:2px solid #3b82f6;padding:0"></td></tr>`;
    // Report title
    html += `<tr><td colspan="${colCount}" align="center" style="font-size:16px;font-weight:bold;padding:6px">${reportType.toUpperCase()} Report</td></tr>`;
    // Generated on
    html += `<tr><td colspan="${colCount}" align="center" style="font-size:11px;color:#666;padding:2px">Generated on: ${new Date().toLocaleString()}</td></tr>`;
    // Blank spacer
    html += `<tr><td colspan="${colCount}" style="padding:4px"></td></tr>`;

    if (data.length > 0) {
      // Column headers
      html += `<tr>`;
      Object.values(fieldMapping).forEach((header) => {
        html += `<td style="border:1px solid #ddd;padding:8px;background-color:#3b82f6;color:white;font-weight:bold">${header}</td>`;
      });
      html += `</tr>`;

      // Data rows
      data.forEach((row, i) => {
        const bgColor = i % 2 === 0 ? '#ffffff' : '#f2f2f2';
        html += `<tr style="background-color:${bgColor}">`;
        Object.keys(fieldMapping).forEach((key) => {
          let value: ReportValue = row[key] as ReportValue;
          if (key === 'createdAt' && value) {
            value = new Date(value as string).toLocaleString();
          } else if (key === 'solvedAt' && value) {
            value = new Date(value as string).toLocaleString();
          } else if (key === 'status' && typeof value === 'string') {
            value = value.replace('_', ' ');
          } else if (key === 'assignedTo' && !value) {
            value = t('unassigned');
          } else if (!value) {
            value = '';
          }
          html += `<td style="border:1px solid #ddd;padding:6px">${value}</td>`;
        });
        html += `</tr>`;
      });
    }

    html += `</table></body></html>`;

    const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${_filename}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Generate multi-section Excel report (all reports in one file, separate tables)
  const generateExcelMulti = (sections: ReportSection[], _filename: string) => {
    let html = `<html><head><meta charset="utf-8"><title></title></head><body>`;

    // Single header for entire file
    const totalRecords = sections.reduce((sum, s) => sum + s.data.length, 0);
    html += `<table border="0" cellpadding="4" cellspacing="0" style="font-family:Arial,sans-serif;font-size:12px;width:100%">`;
    html += `<tr><td colspan="9" align="center" style="font-size:16px;font-weight:bold;padding:2px">Ministry of Communication &amp; Information Technology</td></tr>`;
    html += `<tr><td colspan="9" align="center" style="font-size:13px;color:#555;padding:2px">Directorate of Information Technology</td></tr>`;
    html += `<tr><td colspan="9" align="center" style="font-size:14px;font-weight:bold;color:#3b82f6;padding:2px">Customer Support System</td></tr>`;
    html += `<tr><td colspan="9" style="border-bottom:2px solid #3b82f6;padding:0"></td></tr>`;
    html += `<tr><td colspan="9" align="center" style="font-size:16px;font-weight:bold;padding:6px">ALL REPORTS</td></tr>`;
    html += `<tr><td colspan="9" align="center" style="font-size:11px;color:#666;padding:2px">Generated on: ${new Date().toLocaleString()}</td></tr>`;
    html += `<tr><td colspan="9" align="center" style="font-size:11px;color:#666;padding:2px">Total Records: ${totalRecords}</td></tr>`;
    html += `<tr><td colspan="9" style="padding:8px"></td></tr>`;
    html += `</table>`;

    sections.forEach((section) => {
      // Section title
      const colCount = Object.keys(section.fieldMapping).length;
      html += `<table border="0" cellpadding="4" cellspacing="0" style="font-family:Arial,sans-serif;font-size:12px;width:100%;margin-top:16px">`;
      html += `<tr><td colspan="${colCount}" style="background-color:#1e40af;color:white;font-weight:bold;font-size:13px;padding:8px;text-align:center">${escapeHtml(section.title)} (${section.data.length} records)</td></tr>`;

      if (section.data.length > 0) {
        html += `<tr>`;
        Object.values(section.fieldMapping).forEach((header) => {
          html += `<td style="border:1px solid #ddd;padding:8px;background-color:#3b82f6;color:white;font-weight:bold">${escapeHtml(header)}</td>`;
        });
        html += `</tr>`;

        section.data.forEach((row, i) => {
          const bgColor = i % 2 === 0 ? '#ffffff' : '#f2f2f2';
          html += `<tr style="background-color:${bgColor}">`;
          Object.keys(section.fieldMapping).forEach((key) => {
            let value: ReportValue = row[key] as ReportValue;
            if (key === 'createdAt' && value) {
              value = new Date(value as string).toLocaleString();
            } else if (key === 'solvedAt' && value) {
              value = new Date(value as string).toLocaleString();
            } else if (key === 'status' && typeof value === 'string') {
              value = value.replace('_', ' ');
            } else if (key === 'assignedTo' && !value) {
              value = t('unassigned');
            } else if (!value) {
              value = '';
            }
            html += `<td style="border:1px solid #ddd;padding:6px">${escapeHtml(value)}</td>`;
          });
          html += `</tr>`;
        });
      }

      html += `</table>`;
    });

    html += `</body></html>`;

    const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${_filename}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Generate and open a printable PDF via browser print dialog
  const generatePDF = (data: Record<string, unknown>[], _filename: string, fieldMapping: Record<string, string>) => {
    // For PDF, we'll create a simple HTML table and print to PDF
    let htmlContent = `
      <html>
        <head>
          <title></title>
          <style>
            @page { margin: 0; }
            body { font-family: Arial, sans-serif; margin: 20px; }
            .report-header { text-align: center; margin-bottom: 20px; }
            .report-header img { width: 60px; height: 60px; margin-bottom: 8px; }
            .report-header h2 { margin: 4px 0; font-size: 16px; color: #333; font-weight: bold; }
            .report-header h3 { margin: 4px 0; font-size: 13px; color: #555; font-weight: normal; }
            .report-header .system-name { margin: 6px 0 10px; font-size: 14px; color: #3b82f6; font-weight: bold; }
            .report-header .divider { border: none; border-top: 2px solid #3b82f6; margin: 8px 0; }
            .report-header .report-title { font-size: 16px; font-weight: bold; color: #111; margin: 8px 0; }
            .meta { color: #666; margin-bottom: 20px; text-align: center; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #3b82f6; color: white; }
            tr:nth-child(even) { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <div class="report-header">
            <div>
              <img src="${window.location.origin}/logo.gif" alt="MCIT Logo" style="width:60px;height:60px;margin-bottom:8px">
            </div>
            <h2>Ministry of Communication &amp; Information Technology</h2>
            <h3>Directorate of Information Technology</h3>
            <div class="system-name">Customer Support System</div>
            <hr class="divider">
            <div class="report-title">${escapeHtml(reportType.toUpperCase())} Report</div>
            <hr class="divider">
          </div>
          <p class="meta">Generated on: ${escapeHtml(new Date().toLocaleString())}</p>
          <table>
    `;

    // Add headers
    htmlContent += '<tr>';
    Object.values(fieldMapping).forEach((header) => {
      htmlContent += `<th>${escapeHtml(header)}</th>`;
    });
    htmlContent += '</tr>';

    // Add rows with formatted data
    data.forEach((row) => {
      htmlContent += '<tr>';
      Object.keys(fieldMapping).forEach((key) => {
        let value: ReportValue = row[key] as ReportValue;

        // Format nested objects
        if (key === 'createdAt' && value) {
          value = new Date(value as string).toLocaleString();
        } else if (key === 'solvedAt' && value) {
          value = new Date(value as string).toLocaleString();
        } else if (key === 'status' && typeof value === 'string') {
          value = value.replace('_', ' ');
        } else if (key === 'assignedTo' && !value) {
          value = t('unassigned');
        } else if (!value) {
          value = '';
        }

        htmlContent += `<td>${escapeHtml(value)}</td>`;
      });
      htmlContent += '</tr>';
    });

    htmlContent += `
          </table>
        </body>
      </html>
    `;

    // Open in new window for printing to PDF
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Generate multi-section PDF report (all reports in one file, separate tables)
  const generatePDFMulti = (sections: ReportSection[], _filename: string) => {
    const totalRecords = sections.reduce((sum, s) => sum + s.data.length, 0);

    let htmlContent = `
      <html>
        <head>
          <title></title>
          <style>
            @page { margin: 0; }
            body { font-family: Arial, sans-serif; margin: 20px; }
            .report-header { text-align: center; margin-bottom: 20px; }
            .report-header img { width: 60px; height: 60px; margin-bottom: 8px; }
            .report-header h2 { margin: 4px 0; font-size: 16px; color: #333; font-weight: bold; }
            .report-header h3 { margin: 4px 0; font-size: 13px; color: #555; font-weight: normal; }
            .report-header .system-name { margin: 6px 0 10px; font-size: 14px; color: #3b82f6; font-weight: bold; }
            .report-header .divider { border: none; border-top: 2px solid #3b82f6; margin: 8px 0; }
            .report-header .report-title { font-size: 16px; font-weight: bold; color: #111; margin: 8px 0; }
            .meta { color: #666; margin-bottom: 20px; text-align: center; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 30px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #3b82f6; color: white; }
            tr:nth-child(even) { background-color: #f2f2f2; }
            .section-title { background-color: #1e40af; color: white; font-weight: bold; font-size: 13px; padding: 8px; text-align: center; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="report-header">
            <div>
              <img src="${window.location.origin}/logo.gif" alt="MCIT Logo" style="width:60px;height:60px;margin-bottom:8px">
            </div>
            <h2>Ministry of Communication &amp; Information Technology</h2>
            <h3>Directorate of Information Technology</h3>
            <div class="system-name">Customer Support System</div>
            <hr class="divider">
            <div class="report-title">ALL REPORTS</div>
            <hr class="divider">
          </div>
          <p class="meta">Generated on: ${escapeHtml(new Date().toLocaleString())} | Total Records: ${totalRecords}</p>
    `;

    sections.forEach((section) => {
      htmlContent += `<div class="section-title">${escapeHtml(section.title)} (${section.data.length} records)</div>`;
      htmlContent += `<table>`;

      htmlContent += '<tr>';
      Object.values(section.fieldMapping).forEach((header) => {
        htmlContent += `<th>${escapeHtml(header)}</th>`;
      });
      htmlContent += '</tr>';

      section.data.forEach((row) => {
        htmlContent += '<tr>';
        Object.keys(section.fieldMapping).forEach((key) => {
          let value: ReportValue = row[key] as ReportValue;
          if (key === 'createdAt' && value) {
            value = new Date(value as string).toLocaleString();
          } else if (key === 'solvedAt' && value) {
            value = new Date(value as string).toLocaleString();
          } else if (key === 'status' && typeof value === 'string') {
            value = value.replace('_', ' ');
          } else if (key === 'assignedTo' && !value) {
            value = t('unassigned');
          } else if (!value) {
            value = '';
          }
          htmlContent += `<td>${escapeHtml(value)}</td>`;
        });
        htmlContent += '</tr>';
      });

      htmlContent += `</table>`;
    });

    htmlContent += `
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Filter services by selected category
  const filteredServices = selectedCategory === 'all'
    ? services
    : services.filter(s => s.name.split(' ')[0] === selectedCategory);

  const activeTab = (() => {
    if (startDate && endDate) {
      const diffDays = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) return 'weekly';
      if (diffDays <= 30) return 'monthly';
      if (diffDays <= 90) return 'quarterly';
      if (diffDays <= 365) return 'annual';
    }
    return '';
  })();

  return (
    <div className="min-h-screen flex flex-col overflow-y-auto">
      <ToastContainer />

      {/* Main Content */}
      <div className="w-full px-2 py-2">
        {/* Reports & Analytics Title with Icon */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">{t('reportsAnalytics')}</h1>
          </div>
        </div>

        {/* Preview Stats */}
        {previewLoading ? (
          <SkeletonLoader type="stats" />
        ) : (
          <div className="flex gap-3 w-full flex-wrap lg:flex-nowrap">
            <div className="flex-1 h-full min-w-0 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100">
              <div className="p-3 sm:p-4 h-full flex items-center justify-between">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-[9px] sm:text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('total')}</span>
                  <p className="text-xl sm:text-3xl font-bold text-gray-800">{previewData.total}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500">{t('totalRecords')}</p>
                </div>
                <div className="p-1.5 bg-gradient-to-br from-gray-500 to-gray-700 rounded-xl shadow-md flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="flex-1 h-full min-w-0 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-amber-100">
              <div className="p-3 sm:p-4 h-full flex items-center justify-between">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-[9px] sm:text-[10px] font-semibold text-amber-500 uppercase tracking-wider">{t('pending')}</span>
                  <p className="text-xl sm:text-3xl font-bold text-amber-600">{previewData.pending}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500">{t('needsAttention')}</p>
                </div>
                <div className="p-1.5 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl shadow-md flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="flex-1 h-full min-w-0 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-blue-100">
              <div className="p-3 sm:p-4 h-full flex items-center justify-between">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-[9px] sm:text-[10px] font-semibold text-blue-500 uppercase tracking-wider">{t('active')}</span>
                  <p className="text-xl sm:text-3xl font-bold text-blue-600">{previewData.inProgress}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500">{t('inProgressLower')}</p>
                </div>
                <div className="p-1.5 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl shadow-md flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="flex-1 h-full min-w-0 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-emerald-100">
              <div className="p-3 sm:p-4 h-full flex items-center justify-between">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-[9px] sm:text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">{t('solved')}</span>
                  <p className="text-xl sm:text-3xl font-bold text-emerald-600">{previewData.solved}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500">{t('completed')}</p>
                </div>
                <div className="p-1.5 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl shadow-md flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            {/* Unassigned Card */}
            <div className="flex-1 h-full min-w-0 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-purple-100">
              <div className="p-3 sm:p-4 h-full flex items-center justify-between">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-[9px] sm:text-[10px] font-semibold text-purple-500 uppercase tracking-wider">{t('unassigned')}</span>
                  <p className="text-xl sm:text-3xl font-bold text-purple-600">{unassignedCount}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500">{t('notAssigned')}</p>
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

        {/* Report Configuration Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mt-4">
          <div className="px-4 pb-4 pt-2">
            {/* Quick Date Range */}
            <div className="mb-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <label className="text-sm font-semibold text-gray-700">{t('quickDateRange')}</label>
              </div>
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
                {[
                  { key: 'weekly', label: t('weekly'), days: 7 },
                  { key: 'monthly', label: t('monthly'), days: 30 },
                  { key: 'quarterly', label: t('quarterly'), days: 90 },
                  { key: 'annual', label: t('annual'), days: null },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => tab.days !== null ? setQuickDateRange(tab.days) : setAnnualRange()}
                    className={`px-5 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
                      activeTab === tab.key
                        ? 'bg-white text-blue-600 shadow-sm border border-blue-200'
                        : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
                <button
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className={`px-5 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
                    !activeTab && !startDate && !endDate
                      ? 'bg-white text-red-500 shadow-sm border border-red-200'
                      : 'text-gray-600 hover:text-red-500 hover:bg-red-50'
                  }`}
                >
                  {t('clearDates')}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Report Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('reportType')}</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 text-gray-700 font-medium outline-none focus:border-blue-500 transition-all duration-200"
                >
                  <option value="all">{t('allReports')}</option>
                  <option value="tickets">{t('ticketsReport')}</option>
                  <option value="organizations">{t('organizationsReport')}</option>
                  <option value="users">{t('usersReport')}</option>
                  <option value="services">{t('servicesReport')}</option>
                </select>
              </div>

              {/* Service Category */}
              {reportType === 'tickets' && serviceCategories.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{t('serviceCategory')}</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => { setSelectedCategory(e.target.value); setSelectedService('all'); }}
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 text-gray-700 font-medium outline-none focus:border-blue-500 transition-all duration-200"
                  >
                    <option value="all">{t('allCategories')}</option>
                    {serviceCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Service Selection */}
              {reportType !== 'all' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('serviceText')}</label>
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 text-gray-700 font-medium outline-none focus:border-blue-500 transition-all duration-200"
                >
                  <option value="all">{t('allServices')}</option>
                  {filteredServices.map((service: ServiceItem) => (
                    <option key={service.id} value={service.id}>{service.name}</option>
                  ))}
                </select>
              </div>
              )}

              {/* User Selection */}
              {reportType !== 'all' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('supportUser')}</label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 text-gray-700 font-medium outline-none focus:border-blue-500 transition-all duration-200"
                >
                  <option value="all">{t('allUsers')}</option>
                  {users.map((user: UserItem) => (
                    <option key={user.id} value={user.id}>{user.username}</option>
                  ))}
                </select>
              </div>
              )}

              {/* Organization Selection */}
              {reportType !== 'all' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('organization')}</label>
                <select
                  value={selectedOrganization}
                  onChange={(e) => setSelectedOrganization(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 text-gray-700 font-medium outline-none focus:border-blue-500 transition-all duration-200"
                >
                  <option value="all">{t('allOrganizations')}</option>
                  {organizations.map((org: OrgItem) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>
              )}

              {/* Start Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('Start Date')}</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 text-gray-700 font-medium outline-none focus:border-blue-500 transition-all duration-200"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('End Date')}</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 text-gray-700 font-medium outline-none focus:border-blue-500 transition-all duration-200"
                />
              </div>

              {/* Format */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('exportFormat')}</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 text-gray-700 font-medium outline-none focus:border-blue-500 transition-all duration-200"
                >
                  <option value="excel">{t('excel')}</option>
                  <option value="pdf">{t('pdf')}</option>
                </select>
              </div>
            </div>

            {/* Generate Button */}
            <div className="mt-2 mb-2 flex justify-end items-center gap-4 flex-col sm:flex-row">
              <div className="text-sm text-gray-500">
                {recordCount > 0 ? (
                  <span className="text-green-600 font-medium">{t('recordsFound')}: {recordCount}</span>
                ) : (
                  <span className="text-amber-600 font-medium">{t('noRecordsFound')}</span>
                )}
              </div>
              <button
                onClick={generateReport}
                disabled={loading || recordCount === 0}
                style={{
                  appearance: 'none',
                  padding: '12px 18px',
                  borderRadius: '12px',
                  border: '2px solid transparent',
                  background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%) padding-box, #2b51b1 border-box',
                  fontSize: '14px',
                  color: '#1e293b',
                  cursor: (loading || recordCount === 0) ? 'not-allowed' : 'pointer',
                  outline: 'none',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15), inset 0 1px 0 rgba(255,255,255,0.8)',
                  fontWeight: 600,
                  minWidth: '160px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  opacity: (loading || recordCount === 0) ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!loading && recordCount !== 0) {
                    e.currentTarget.style.background = '#2b51b1';
                    e.currentTarget.style.color = 'white';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading && recordCount !== 0) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%) padding-box, #2b51b1 border-box';
                    e.currentTarget.style.color = '#1e293b';
                  }
                }}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('generating')}
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {t('generateReport')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
