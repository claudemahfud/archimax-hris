import { useToast } from '../hooks/useToast';
import type { ToastMessage } from '../types';

function ToastItem({ toast, onClose }: { toast: ToastMessage; onClose: () => void }) {
  return (
    <div className={`toast-item toast-${toast.type}`} role="alert" aria-live="assertive">
      <span className="toast-icon" aria-hidden="true">
        {toast.type === 'success' ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        )}
      </span>
      <div className="toast-content">
        <strong>{toast.type === 'success' ? 'Berhasil' : 'Gagal'}</strong>
        <p>{toast.message}</p>
      </div>
      <button onClick={onClose} aria-label="Tutup notifikasi" className="toast-close">×</button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => dismissToast(t.id)} />
      ))}
    </div>
  );
}
