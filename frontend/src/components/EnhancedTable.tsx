import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import './EnhancedTable.css';

// Describes a single table column definition
export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  visible?: boolean;
  render?: (row: T) => React.ReactNode;
}

// Props for the EnhancedTable component
interface EnhancedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowSelect?: (selectedRows: T[]) => void;
  onBulkAction?: (action: string, selectedRows: T[]) => void;
  bulkActions?: { label: string; value: string }[];
}

// Feature-rich table component with sorting, multi-row selection, bulk actions, and toggleable columns
export function EnhancedTable<T extends Record<string, any>>({
  data,
  columns,
  onRowSelect,
  onBulkAction,
  bulkActions,
}: EnhancedTableProps<T>) {
  const { t } = useTranslation();
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number | string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(columns.filter((col) => col.visible !== false).map((col) => col.key))
  );
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  const sortedData = useMemo(() => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const comparison = aValue < bValue ? -1 : 1;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [data, sortConfig]);

  const visibleColumnsList = columns.filter((col) => visibleColumns.has(col.key));

  const handleSort = (key: string) => {
    setSortConfig((current) => {
      if (!current || current.key !== key) {
        return { key, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return null;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(sortedData.map((row) => row.id));
      setSelectedRows(allIds);
      onRowSelect?.(sortedData);
    } else {
      setSelectedRows(new Set());
      onRowSelect?.([]);
    }
  };

  const handleSelectRow = (id: number | string, checked: boolean) => {
    const newSelected = new Set(selectedRows);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedRows(newSelected);
    
    const selectedData = sortedData.filter((row) => newSelected.has(row.id));
    onRowSelect?.(selectedData);
  };

  const toggleColumn = (key: string) => {
    const newVisible = new Set(visibleColumns);
    if (newVisible.has(key)) {
      // Don't allow hiding all columns
      if (newVisible.size > 1) {
        newVisible.delete(key);
      }
    } else {
      newVisible.add(key);
    }
    setVisibleColumns(newVisible);
  };

  const allSelected = sortedData.length > 0 && selectedRows.size === sortedData.length;
  const someSelected = selectedRows.size > 0 && selectedRows.size < sortedData.length;

  return (
    <div className="enhanced-table-container">
      {/* Table Controls */}
      <div className="table-controls">
        <div className="bulk-actions">
          {selectedRows.size > 0 && bulkActions && (
            <>
              <span className="selected-count">{selectedRows.size} {t('selected')}</span>
              <select
                className="bulk-action-select"
                onChange={(e) => {
                  if (e.target.value) {
                    onBulkAction?.(e.target.value, sortedData.filter((row) => selectedRows.has(row.id)));
                    e.target.value = '';
                  }
                }}
              >
                <option value="">{t('bulkActions')}</option>
                {bulkActions.map((action) => (
                  <option key={action.value} value={action.value}>
                    {action.label}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
        <div className="column-toggle">
          <button
            className="column-toggle-btn"
            onClick={() => setShowColumnMenu(!showColumnMenu)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="21" x2="4" y2="14"></line>
              <line x1="4" y1="10" x2="4" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12" y2="3"></line>
              <line x1="20" y1="21" x2="20" y2="16"></line>
              <line x1="20" y1="12" x2="20" y2="3"></line>
              <line x1="1" y1="14" x2="7" y2="14"></line>
              <line x1="9" y1="8" x2="15" y2="8"></line>
              <line x1="17" y1="16" x2="23" y2="16"></line>
            </svg>
            {t('columns')}
          </button>
          {showColumnMenu && (
            <div className="column-menu">
              {columns.map((col) => (
                <label key={col.key} className="column-menu-item">
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(col.key)}
                    onChange={() => toggleColumn(col.key)}
                    disabled={visibleColumns.size === 1 && visibleColumns.has(col.key)}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="enhanced-table-wrapper">
        <table className="enhanced-table">
          <thead>
            <tr>
              <th className="checkbox-column">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someSelected;
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  aria-label="Select all rows"
                />
              </th>
              {visibleColumnsList.map((col) => (
                <th
                  key={col.key}
                  className={col.sortable ? 'sortable' : ''}
                  onClick={() => col.sortable && handleSort(col.key)}
                  aria-sort={
                    sortConfig?.key === col.key
                      ? sortConfig.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <div className="th-content">
                    {col.label}
                    {col.sortable && (
                      <span className="sort-indicator">
                        {sortConfig?.key === col.key ? (
                          sortConfig.direction === 'asc' ? (
                            '↑'
                          ) : (
                            '↓'
                          )
                        ) : (
                          '↕'
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row) => (
              <tr
                key={row.id}
                className={selectedRows.has(row.id) ? 'selected' : ''}
              >
                <td className="checkbox-column">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(row.id)}
                    onChange={(e) => handleSelectRow(row.id, e.target.checked)}
                    aria-label={`Select row ${row.id}`}
                  />
                </td>
                {visibleColumnsList.map((col) => (
                  <td key={col.key}>
                    {col.render ? col.render(row) : String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
