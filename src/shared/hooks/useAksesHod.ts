import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { hapusSesiAkun } from '../lib/akunSession';
import { ROUTES } from '../../router/routePaths';

export function useAksesHod() {
  const navigate = useNavigate();
  const [terverifikasi] = useState<boolean>(() => sessionStorage.getItem('akses_hod') === '1');
  const [divisi] = useState<string>(() => sessionStorage.getItem('akses_hod_divisi') || '');

  const keluar = useCallback(() => {
    sessionStorage.removeItem('akses_hod');
    sessionStorage.removeItem('akses_hod_divisi');
    hapusSesiAkun();
    // Akun HOD bisa login lewat Firebase Auth sungguhan (Username+Password atau Google) —
    // ikut sign-out di sini supaya tidak ada sesi Firebase Auth tertinggal aktif di device
    // setelah klik "Keluar" (lihat catatan yang sama di useAksesGate.ts).
    if (auth.currentUser) signOut(auth).catch(() => undefined);
    // Logout langsung ke Welcome Page (BUKAN window.location.reload() — reload cuma me-refresh
    // halaman yang sama, yang kemudian redirect ke gerbang Login/Kode Akses karena terverifikasi
    // sudah false; itu sebabnya sebelumnya Logout terasa "nyasar" ke halaman Login lagi).
    navigate(ROUTES.LANDING);
  }, [navigate]);

  return { terverifikasi, divisi, keluar };
}