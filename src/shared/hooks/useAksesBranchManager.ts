import { useCallback, useState } from 'react';
import { hapusSesiAkun } from '../lib/akunSession';

export function useAksesBranchManager() {
  const [terverifikasi] = useState<boolean>(() => sessionStorage.getItem('akses_branch_manager') === '1');
  const [divisi] = useState<string>(() => sessionStorage.getItem('akses_branch_manager_divisi') || '');

  const keluar = useCallback(() => {
    sessionStorage.removeItem('akses_branch_manager');
    sessionStorage.removeItem('akses_branch_manager_divisi');
    hapusSesiAkun();
    window.location.reload();
  }, []);

  return { terverifikasi, divisi, keluar };
}
