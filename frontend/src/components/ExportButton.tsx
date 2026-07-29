import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exportToCSV, exportToExcel, exportToJSON, ExportColumn } from '../utils/exportUtils';
import './ExportButton.css';

// Props for the ExportButton component
interface ExportButtonProps<T> {
  data: T[];
  columns: ExportColumn[];
  filename?: string;
  disabled?: boolean;
}

// Dropdown button that exports table data to CSV, Excel (XLSX-compatible CSV), or JSON format
export function ExportButton<T extends Record<string, any>>({
  data,
  columns,
  filename = 'export',
  disabled = false,
}: ExportButtonProps<T>) {
  const { t } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);

  const handleExport = (format: 'csv' | 'excel' | 'json') => {
    const timestamp = new Date().toISOString().split('T')[0];
    const fullFilename = `${filename}_${timestamp}`;

    switch (format) {
      case 'csv':
        exportToCSV(data, columns, fullFilename);
        break;
      case 'excel':
        exportToExcel(data, columns, fullFilename);
        break;
      case 'json':
        exportToJSON(data, fullFilename);
        break;
    }

    setShowMenu(false);
  };

  return (
    <div className="export-button-container">
      <button
        className="export-button"
        onClick={() => setShowMenu(!showMenu)}
        disabled={disabled || data.length === 0}
        aria-expanded={showMenu}
        aria-haspopup="true"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        {t('exportData')}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {showMenu && (
        <div className="export-menu">
          <button
            className="export-menu-item"
            onClick={() => handleExport('csv')}
            aria-label={t('excel')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            {t('excel')}
          </button>
          <button
            className="export-menu-item"
            onClick={() => handleExport('excel')}
            aria-label={t('excel')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="3" y1="15" x2="21" y2="15"></line>
              <line x1="9" y1="3" x2="9" y2="21"></line>
              <line x1="15" y1="3" x2="15" y2="21"></line>
            </svg>
            {t('excel')}
          </button>
          <button
            className="export-menu-item"
            onClick={() => handleExport('json')}
            aria-label={t('exportData')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <path d="M12 18v-6"></path>
              <path d="M9 15l3 3 3-3"></path>
            </svg>
            {t('exportData')}
          </button>
        </div>
      )}
    </div>
  );
}
