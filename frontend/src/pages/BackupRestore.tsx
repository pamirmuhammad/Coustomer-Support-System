import { useState, useRef } from 'react';
import { backupAPI } from '../services/api';
import { useSimpleToast } from '../components/SimpleToast';
import { useTranslation } from 'react-i18next';
import { useModalEscape } from '../hooks/useModalEscape';

/**
 * Backup & Restore — full database backup management for administrators.
 *
 * Allows the admin to download a complete pg_dump of the database and to
 * restore the database from a previously downloaded .sql backup file.
 */
export default function BackupRestore() {
  const { t } = useTranslation();
  const { show, ToastContainer } = useSimpleToast();
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useModalEscape(() => setShowConfirmModal(false), showConfirmModal);

  const primaryButtonStyle = {
    appearance: 'none' as const,
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
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s',
  } as const;

  const dangerButtonStyle = {
    appearance: 'none' as const,
    padding: '12px 18px',
    borderRadius: '12px',
    border: '2px solid transparent',
    background: 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%) padding-box, #dc2626 border-box',
    fontSize: '14px',
    color: '#7f1d1d',
    cursor: 'pointer',
    outline: 'none',
    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.15), inset 0 1px 0 rgba(255,255,255,0.8)',
    fontWeight: 600,
    minWidth: '160px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s',
  } as const;

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = '#2b51b1';
    e.currentTarget.style.color = 'white';
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>, base: string, color: string) => {
    e.currentTarget.style.background = base;
    e.currentTarget.style.color = color;
  };

  const handleDangerEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = '#dc2626';
    e.currentTarget.style.color = 'white';
  };

  const handleDownloadBackup = async () => {
    setBackingUp(true);
    try {
      const response = await backupAPI.download();
      const blob = new Blob([response.data], { type: 'application/sql' });
      const disposition = (response.headers?.['content-disposition'] as string) || '';
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const filename =
        match?.[1] ||
        `ticket-system-backup-${new Date().toISOString().slice(0, 10)}.sql`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      show('success', t('success'), t('backupDownloaded'));
    } catch {
      show('error', t('error'), t('backupFailed'));
    } finally {
      setBackingUp(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && !file.name.toLowerCase().endsWith('.sql')) {
      show('error', t('error'), t('invalidBackupFile'));
      e.target.value = '';
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const handleConfirmRestore = async () => {
    if (!selectedFile) return;
    setRestoring(true);
    setShowConfirmModal(false);
    try {
      const response = await backupAPI.restore(selectedFile);
      const message = response.data?.message || t('restoreSuccess');
      show('success', t('success'), message, 6000);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      show('error', t('error'), err.response?.data?.message || t('restoreFailed'), 6000);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col overflow-y-auto">
      <ToastContainer />
      <div className="w-full px-2 py-2 overflow-x-auto">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-2.5 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md flex items-center justify-center shrink-0">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-gray-800">{t('backupRestore')}</h2>
              </div>
            </div>
          </div>

          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
            {/* Create Backup */}
            <div className="rounded-2xl border border-gray-200 bg-gray-50/50 p-4 h-full w-full">
              <div className="flex items-center gap-3 mb-2">
                <span
                  className="p-2 rounded-lg shrink-0"
                  style={{ background: '#2b51b1' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                </span>
                <h3 className="text-base font-bold text-gray-800">{t('createBackup')}</h3>
              </div>
              <p className="text-sm text-gray-900 mb-3 leading-relaxed">{t('createBackupDescription')}</p>
              <div className="flex justify-end">
                <button
                  onClick={handleDownloadBackup}
                  disabled={backingUp}
                  style={{ ...primaryButtonStyle, opacity: backingUp ? 0.6 : 1, cursor: backingUp ? 'not-allowed' : 'pointer' }}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={(e) => handleMouseLeave(e, 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%) padding-box, #2b51b1 border-box', '#1e293b')}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                  </svg>
                  {backingUp ? t('backupInProgress') : t('downloadBackup')}
                </button>
              </div>
            </div>

            {/* Restore Backup */}
            <div className="rounded-2xl border border-gray-200 bg-gray-50/50 p-4 h-full w-full">
              <div className="flex items-center gap-3 mb-2">
                <span
                  className="p-2 rounded-lg shrink-0"
                  style={{ background: '#dc2626' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                </span>
                <h3 className="text-base font-bold text-gray-800">{t('restoreBackup')}</h3>
              </div>
              <p className="text-sm text-gray-900 mb-3 leading-relaxed">{t('restoreBackupDescription')}</p>
              <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-3 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".sql,application/sql,text/plain"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  {t('selectBackupFile')}
                </button>
                <p className="mt-2 text-xs text-gray-500 truncate" title={selectedFile?.name || ''}>
                  {selectedFile ? selectedFile.name : t('noFileSelected')}
                </p>
              </div>
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800 leading-relaxed">
                {t('restoreWarning')}
              </div>
              <div className="flex justify-end mt-3">
                <button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={!selectedFile || restoring}
                  style={{ ...dangerButtonStyle, opacity: !selectedFile || restoring ? 0.5 : 1, cursor: !selectedFile || restoring ? 'not-allowed' : 'pointer' }}
                  onMouseEnter={handleDangerEnter}
                  onMouseLeave={(e) => handleMouseLeave(e, 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%) padding-box, #dc2626 border-box', '#7f1d1d')}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 12a5 5 0 0 1-10 0"></path>
                    <line x1="12" y1="2" x2="12" y2="12"></line>
                  </svg>
                  {restoring ? t('restoreInProgress') : t('restoreNow')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Restore confirmation modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto animate-fadeIn">
            <div className="px-4 py-3 rounded-t-2xl" style={{ background: '#b91c1c', position: 'relative' }}>
              <div className="flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
                <h3 className="text-lg font-bold text-white">{t('restoreConfirmTitle')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'white', padding: '4px' }}
                aria-label={t('close')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-700 leading-relaxed">{t('restoreConfirmMessage')}</p>
              {selectedFile && (
                <p className="mt-3 text-xs font-semibold text-gray-600 truncate" title={selectedFile.name}>
                  {selectedFile.name}
                </p>
              )}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #d1d5db',
                    background: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#374151',
                    cursor: 'pointer',
                  }}
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleConfirmRestore}
                  disabled={restoring}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: 'none',
                    background: restoring ? '#9ca3af' : '#dc2626',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'white',
                    cursor: restoring ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  {restoring ? t('restoreInProgress') : t('restoreNow')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
