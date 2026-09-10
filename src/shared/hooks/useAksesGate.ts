import { useCallback, useState } from 'react';
import { hapusSesiAkun } from '../lib/akunSession';

// Catatan keamanan: pengecekan PIN di sini berjalan di client (parity dengan alur PIN GAS lama
// yang di-deploy "Anyone"). Untuk produksi, sebaiknya validasi ulang lewat Firestore Security
// Rules atau Cloud Function supaya PIN tidak bisa dilewati lewat DevTools. Lihat README.

export function useAksesGate(storageKey: string) {
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
  }, [storageKey]);

  return { terverifikasi, verifikasi, keluar };
}
