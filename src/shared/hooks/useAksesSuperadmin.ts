import { useCallback, useState } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { getSuperadminCredentials, getWhitelistSuperadmin } from '../lib/firestore';
import { hapusSesiAkun } from '../lib/akunSession';

// Catatan keamanan: sama seperti Kode Akses (lihat useAksesGate.ts), pengecekan username/password
// di sini berjalan di client. Login Google memakai Firebase Auth sungguhan (popup akun Google),
// dan SEKARANG divalidasi ke whitelist email Superadmin (koleksi settings/whitelistSuperadmin,
// diatur lewat halaman "Ganti Kode Akses") — akun Google yang emailnya tidak terdaftar akan
// ditolak & otomatis sign-out, supaya "Full Akses 100%" benar-benar eksklusif untuk Superadmin.

const STORAGE_KEY = 'akses_superadmin';

export function useAksesSuperadmin() {
  const [terverifikasi, setTerverifikasi] = useState<boolean>(
    () => sessionStorage.getItem(STORAGE_KEY) === '1',
  );

  const loginManual = useCallback(async (username: string, password: string): Promise<boolean> => {
    const kredensial = await getSuperadminCredentials();
    const ok = username.trim() === kredensial.username && password === kredensial.password;
    if (ok) {
      tandaiSesiPenuh();
    }
    return ok;
  }, []);

  const loginGoogle = useCallback(async (): Promise<string> => {
    const hasil = await signInWithPopup(auth, googleProvider);
    const email = (hasil.user.email || '').toLowerCase().trim();
    const whitelist = await getWhitelistSuperadmin();
    if (!whitelist.includes(email)) {
      await signOut(auth).catch(() => undefined);
      throw new Error(`Email ${email || 'ini'} belum terdaftar sebagai Superadmin.`);
    }
    tandaiSesiPenuh();
    return hasil.user.displayName || email || 'Akun Google';
  }, []);

  // Dipakai Welcome Page: setelah popup Google sudah jalan & email sudah dicocokkan sendiri
  // ke whitelist (lihat handleLoginGoogle di Landing.tsx), tinggal tandai sesi terverifikasi
  // tanpa membuka popup Google kedua kalinya.
  const konfirmasiSuperadmin = useCallback(() => {
    tandaiSesiPenuh();
  }, []);

  // Superadmin = otoritas tertinggi, akses 100% ke SEMUA portal — begitu login Superadmin
  // terverifikasi, Kode Akses (PIN) Master File HRD & Portal HOD ikut otomatis terbuka
  // (tidak perlu isi PIN lagi). PIN tetap wajib seperti biasa untuk siapa pun yang BUKAN
  // Superadmin/akun HRD-HOD terdaftar.
  function tandaiSesiPenuh() {
    sessionStorage.setItem(STORAGE_KEY, '1');
    sessionStorage.setItem('akses_hrd', '1');
    setTerverifikasi(true);
  }

  const keluar = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem('akses_hrd');
    sessionStorage.removeItem('akses_hod');
    sessionStorage.removeItem('akses_hod_divisi');
    hapusSesiAkun();
    setTerverifikasi(false);
    if (auth.currentUser) signOut(auth).catch(() => undefined);
  }, []);

  return { terverifikasi, loginManual, loginGoogle, konfirmasiSuperadmin, keluar };
}
