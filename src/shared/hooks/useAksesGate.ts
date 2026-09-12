import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { hapusSesiAkun } from '../lib/akunSession';
import { ROUTES } from '../../router/routePaths';

// Catatan keamanan: pengecekan PIN di sini berjalan di client (parity dengan alur PIN GAS lama
// yang di-deploy "Anyone"). Untuk produksi, sebaiknya validasi ulang lewat Firestore Security
// Rules atau Cloud Function supaya PIN tidak bisa dilewati lewat DevTools. Lihat README.

export function useAksesGate(storageKey: string) {
  const navigate = useNavigate();
  const [terverifikasi, setTerverifikasi] = useState<boolean>(() => sessionStorage.getItem(storageKey) === '1');

  const verifikasi = useCallback((kodeInput: string, kodeAsli: string): boolean => {
    const ok = kodeAsli.length > 0 && kodeInput.trim() === kodeAsli;
    if (ok) {
      sessionStorage.setItem(storageKey, '1');
      setTerverifikasi(true);
    }
    return ok;
  }, [storageKey]);

  const keluar = useCallback(() => {
    sessionStorage.removeItem(storageKey);
    hapusSesiAkun();
    setTerverifikasi(false);
    // Akun HRD bisa login lewat Firebase Auth sungguhan (Username+Password atau Google via
    // Landing.tsx) — kalau tidak ikut sign-out di sini, sesi Firebase Auth-nya tertinggal aktif
    // di device walau sudah klik "Keluar" (baru ke-signOut kalau auto-logout idle 60 menit
    // sempat kepicu, lihat useAutoLogout.ts). Disamakan supaya "Keluar" manual selalu bersih.
    if (auth.currentUser) signOut(auth).catch(() => undefined);
    // Logout langsung ke Welcome Page (bukan diam di halaman yang sama sampai guard
    // `!terverifikasi` sempat redirect ke gerbang Kode Akses — itu sebabnya sebelumnya terasa
    // "nyasar" ke Login/Kode Akses dulu, bukan langsung ke Welcome Page).
    navigate(ROUTES.LANDING);
  }, [storageKey, navigate]);

  return { terverifikasi, verifikasi, keluar };
}
