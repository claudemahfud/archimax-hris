import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { hapusSesiAkun } from '../lib/akunSession';
import { ROUTES } from '../../router/routePaths';

export function useAksesBranchManager() {
  const navigate = useNavigate();
  const [terverifikasi] = useState<boolean>(() => sessionStorage.getItem('akses_branch_manager') === '1');
  const [divisi] = useState<string>(() => sessionStorage.getItem('akses_branch_manager_divisi') || '');

  const keluar = useCallback(() => {
    sessionStorage.removeItem('akses_branch_manager');
    sessionStorage.removeItem('akses_branch_manager_divisi');
    hapusSesiAkun();
    // Sama seperti useAksesHod.ts — akun Branch Manager juga bisa login lewat Firebase Auth
    // sungguhan, jadi ikut sign-out supaya tidak ada sesi tertinggal aktif di device.
    if (auth.currentUser) signOut(auth).catch(() => undefined);
    // Logout langsung ke Welcome Page — lihat catatan yang sama di useAksesHod.ts.
    navigate(ROUTES.LANDING);
  }, [navigate]);

  return { terverifikasi, divisi, keluar };
}
