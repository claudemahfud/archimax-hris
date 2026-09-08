import { useCallback, useState } from 'react';

export function useAksesHod() {
  const [terverifikasi] = useState<boolean>(() => sessionStorage.getItem('akses_hod') === '1');
  const [divisi] = useState<string>(() => sessionStorage.getItem('akses_hod_divisi') || '');

  const keluar = useCallback(() => {
    sessionStorage.removeItem('akses_hod');
    sessionStorage.removeItem('akses_hod_divisi');
    window.location.reload();
  }, []);

  return { terverifikasi, divisi, keluar };
}
