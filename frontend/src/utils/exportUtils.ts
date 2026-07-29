/**
 * Export utilities for CSV and Excel export
 */

// Describes a column for data export (key -> value mapping and display label)
export interface ExportColumn {
  key: string;
  label: string;
}

/**
 * Export data to CSV format
 * @param data - Array of objects to export
 * @param columns - Column definitions
 * @param filename - Name of the file to download
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn[],
  filename: string
): void {
  if (data.length === 0) {
    return;
  }

  // Create header row
  const headers = columns.map((col) => col.label);
  
  // Create data rows
  const rows = data.map((row) =>
    columns.map((col) => {
      const value = row[col.key];
      // Handle null/undefined, nested objects, and arrays
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    })
  );

  // Combine headers and rows
  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Export data to Excel format (XLSX-compatible CSV with BOM)
 * @param data - Array of objects to export
 * @param columns - Column definitions
 * @param filename - Name of the file to download
 */
export function exportToExcel<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn[],
  filename: string
): void {
  if (data.length === 0) {
    return;
  }

  // Create header row
  const headers = columns.map((col) => col.label);
  
  // Create data rows
  const rows = data.map((row) =>
    columns.map((col) => {
      const value = row[col.key];
      // Handle null/undefined, nested objects, and arrays
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    })
  );

  // Combine headers and rows with tab-separated values for Excel
  const excelContent = [headers, ...rows]
    .map((row) => row.join('\t'))
    .join('\n');

  // Add BOM for Excel UTF-8 compatibility
  const bom = '\uFEFF';
  const blob = new Blob([bom + excelContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Export data to JSON format
 * @param data - Array of objects to export
 * @param filename - Name of the file to download
 */
export function exportToJSON<T extends Record<string, any>>(
  data: T[],
  filename: string
): void {
  if (data.length === 0) {
    return;
  }

  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.json`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
