import { useRef, useState, type TouchEvent } from 'react';
import { useToast } from '../hooks/useToast';
import type { ToastMessage } from '../types';

function ToastItem({ toast, onClose }: { toast: ToastMessage; onClose: () => void }) {
  const [geser, setGeser] = useState(0);
  const [menggeser, setMenggeser] = useState(false);
  const mulaiX = useRef(0);

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    mulaiX.current = e.touches[0].clientX;
    setMenggeser(true);
  }
  function handleTouchMove(e: TouchEvent<HTMLDivElement>) {
    const dx = e.touches[0].clientX - mulaiX.current;
    if (dx > 0) setGeser(dx); // geser ke kanan saja untuk menutup
  }
  function handleTouchEnd() {
    setMenggeser(false);
    if (geser > 90) { onClose(); return; }
    setGeser(0); // kembali ke posisi semula kalau geser kurang jauh
  }

  return (
    <div
      className={`toast-item toast-${toast.type}${menggeser ? ' toast-dragging' : ''}`}
      role="alert" aria-live="assertive"
      style={{ transform: `translateX(${geser}px)`, opacity: 1 - Math.min(geser / 200, 0.7) }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
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
