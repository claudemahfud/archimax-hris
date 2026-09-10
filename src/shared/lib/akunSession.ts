// Menyimpan info Akun Portal (Username + Email) yang berhasil login lewat
// Username/Password ATAU Google — dipakai halaman Profil Saya (src/pages/profil/) untuk
// menampilkan info akun & tombol "Ganti Password" (Magic Link). Akses via Kode Akses (PIN)
// TIDAK mengisi ini karena bukan akun sungguhan (tidak ada Username/Password/Email terdaftar).

const KEY_USERNAME = 'akses_akun_username';
const KEY_EMAIL = 'akses_akun_email';

export interface SesiAkun {
  username: string;
  email: string;
}

export function simpanSesiAkun(akun: SesiAkun): void {
  sessionStorage.setItem(KEY_USERNAME, akun.username);
  sessionStorage.setItem(KEY_EMAIL, akun.email);
}

export function bacaSesiAkun(): SesiAkun | null {
  const username = sessionStorage.getItem(KEY_USERNAME);
  const email = sessionStorage.getItem(KEY_EMAIL);
  if (!username || !email) return null;
  return { username, email };
}

export function hapusSesiAkun(): void {
  sessionStorage.removeItem(KEY_USERNAME);
  sessionStorage.removeItem(KEY_EMAIL);
}
