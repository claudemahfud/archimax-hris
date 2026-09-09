import { useCallback, useState } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { getSuperadminCredentials } from '../lib/firestore';

// Catatan keamanan: sama seperti Kode Akses (lihat useAksesGate.ts), pengecekan username/password
// di sini berjalan di client. Login Google memakai Firebase Auth sungguhan (popup akun Google),
// namun akun Google mana pun yang berhasil login akan dianggap Superadmin — belum ada whitelist
// email. Untuk produksi, sebaiknya tambahkan validasi email lewat Firestore Security Rules atau
// Cloud Function.

const STORAGE_KEY = 'akses_superadmin';

export function useAksesSuperadmin() {
  const [terverifikasi, setTerverifikasi] = useState<boolean>(
    () => sessionStorage.getItem(STORAGE_KEY) === '1',
  );

  const loginManual = useCallback(async (username: string, password: string): Promise<boolean> => {
    const kredensial = await getSuperadminCredentials();
    const ok = username.trim() === kredensial.username && password === kredensial.password;
    if (ok) {
      sessionStorage.setItem(STORAGE_KEY, '1');
      setTerverifikasi(true);
    }
    return ok;
  }, []);

  const loginGoogle = useCallback(async (): Promise<string> => {
    const hasil = await signInWithPopup(auth, googleProvider);
    sessionStorage.setItem(STORAGE_KEY, '1');
    setTerverifikasi(true);
    return hasil.user.displayName || hasil.user.email || 'Akun Google';
  }, []);

  const keluar = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setTerverifikasi(false);
    if (auth.currentUser) signOut(auth).catch(() => undefined);
  }, []);

  return { terverifikasi, loginManual, loginGoogle, keluar };
}
