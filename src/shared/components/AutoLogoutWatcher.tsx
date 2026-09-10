import { useAutoLogout } from '../hooks/useAutoLogout';

// Tidak merender apa-apa — cuma menjalankan hook pemantau idle/auto-logout.
export function AutoLogoutWatcher() {
  useAutoLogout();
  return null;
}
