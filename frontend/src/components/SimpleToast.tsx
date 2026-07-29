import { useState, useCallback, useEffect } from 'react';

interface ToastMessage {
  id: number;
  severity: 'success' | 'error' | 'info' | 'warning';
  summary: string;
  detail: string;
  life: number;
}

function getDirection(): 'ltr' | 'rtl' {
  return document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr';
}

function ProgressBar({ life, severity }: { life: number; severity: ToastMessage['severity'] }) {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setStarted(true));
  }, []);

  const color =
    severity === 'success' ? '#22c55e' :
    severity === 'error' ? '#ef4444' :
    severity === 'warning' ? '#eab308' :
    '#3b82f6';

  return (
    <div
      style={{
        height: '3px',
        backgroundColor: color,
        borderRadius: '0 0 0 4px',
        width: '100%',
        transformOrigin: 'left center',
        transform: started ? 'scaleX(0)' : 'scaleX(1)',
        transition: started ? `transform ${life}ms linear` : 'none',
      }}
    />
  );
}

export function useSimpleToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const show = useCallback((severity: ToastMessage['severity'], summary: string, detail: string, life: number = 3000) => {
    const id = Date.now();
    const newToast: ToastMessage = { id, severity, summary, detail, life };
    setToasts(prev => [...prev, newToast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, life);
  }, []);

  const ToastContainer = () => {
    const isRtl = getDirection() === 'rtl';
    return (
      <div
        style={{
          position: 'fixed',
          top: '68px',
          right: isRtl ? 'auto' : '8px',
          left: isRtl ? '8px' : 'auto',
          zIndex: 9999,
        }}
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            style={{
              position: 'relative',
              borderRadius: '0.5rem',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
              marginBottom: '0.5rem',
              ...(toast.severity === 'success' && { backgroundColor: '#f0fdf4', borderLeft: '4px solid #22c55e', color: '#166534' }),
              ...(toast.severity === 'error' && { backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b' }),
              ...(toast.severity === 'warning' && { backgroundColor: '#fefce8', borderLeft: '4px solid #eab308', color: '#854d0e' }),
              ...(toast.severity === 'info' && { backgroundColor: '#eff6ff', borderLeft: '4px solid #3b82f6', color: '#1e40af' }),
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 0 12px 0' }}>
              {toast.severity === 'success' && (
                <svg style={{ width: '16px', height: '16px', flexShrink: 0, color: '#22c55e' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {toast.severity === 'error' && (
                <svg style={{ width: '16px', height: '16px', flexShrink: 0, color: '#ef4444' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {toast.severity === 'warning' && (
                <svg style={{ width: '16px', height: '16px', flexShrink: 0, color: '#eab308' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              )}
              {toast.severity === 'info' && (
                <svg style={{ width: '16px', height: '16px', flexShrink: 0, color: '#3b82f6' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span style={{ fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: '8px' }}>
                {toast.detail}
              </span>
              <div style={{ width: '20px', flexShrink: 0 }} />
              <button
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                style={{ flexShrink: 0, background: 'none', border: 'none', padding: '0', cursor: 'pointer', color: '#9ca3af', lineHeight: 0 }}
              >
                <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ProgressBar life={toast.life} severity={toast.severity} />
          </div>
        ))}
      </div>
    );
  };

  return { show, ToastContainer };
}
