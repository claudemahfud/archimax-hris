import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { hapusSesiAkun } from '../lib/akunSession';
import { useToast } from './useToast';

// Kebijakan Auto Logout: berlaku untuk SEMUA role (Superadmin, HRD, HOD) sekaligus.
// 60 menit tanpa aktivitas (mouse/keyboard/scroll/tap) -> paksa keluar dari semua portal.
const BATAS_IDLE_MS = 60 * 60 * 1000;
const INTERVAL_CEK_MS = 30 * 1000;
const KEY_AKTIVITAS_TERAKHIR = 'aktivitasTerakhirAt';

const KUNCI_SESI = ['akses_superadmin', 'akses_hrd', 'akses_hod', 'akses_hod_divisi'] as const;

const EVENT_AKTIVITAS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const;

function adaSesiAktif(): boolean {
  return KUNCI_SESI.some((k) => sessionStorage.getItem(k) !== null);
}

function hapusSemuaSesi(): void {
  KUNCI_SESI.forEach((k) => sessionStorage.removeItem(k));
  sessionStorage.removeItem(KEY_AKTIVITAS_TERAKHIR);
  hapusSesiAkun();
  if (auth.currentUser) signOut(auth).catch(() => undefined);
}

// Dipasang sekali di root App — memantau aktivitas lintas semua halaman, bukan per portal,
// supaya kebijakan idle-nya konsisten di mana pun user sedang berada.
export function useAutoLogout() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const sudahDieksekusiRef = useRef(false);

  useEffect(() => {
    function catatAktivitas() {
      sessionStorage.setItem(KEY_AKTIVITAS_TERAKHIR, String(Date.now()));
      sudahDieksekusiRef.current = false;
    }

    function keluarKarenaIdle() {
      if (sudahDieksekusiRef.current || !adaSesiAktif()) return;
      sudahDieksekusiRef.current = true;
      hapusSemuaSesi();
      showToast('error', 'Sesi berakhir karena 60 menit tidak ada aktivitas. Silakan login kembali.');
      navigate('/', { replace: true });
    }

    const terakhir = Number(sessionStorage.getItem(KEY_AKTIVITAS_TERAKHIR) || Date.now());
    if (adaSesiAktif() && Date.now() - terakhir > BATAS_IDLE_MS) {
      keluarKarenaIdle();
    } else {
      catatAktivitas();
    }

    const interval = setInterval(() => {
      const t = Number(sessionStorage.getItem(KEY_AKTIVITAS_TERAKHIR) || Date.now());
      if (Date.now() - t > BATAS_IDLE_MS) keluarKarenaIdle();
    }, INTERVAL_CEK_MS);

    EVENT_AKTIVITAS.forEach((ev) => window.addEventListener(ev, catatAktivitas, { passive: true }));

    return () => {
      clearInterval(interval);
      EVENT_AKTIVITAS.forEach((ev) => window.removeEventListener(ev, catatAktivitas));
    };
  }, [navigate, showToast]);
}
