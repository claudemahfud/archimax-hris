import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '../../shared/lib/firebase';
import { ROUTES } from '../../router/routePaths';
import { LOGO_ARCHIMAX_URL } from '../../shared/constants/branding';
import { Spinner } from '../../shared/components/Loading';

// Halaman ini dibuka dari Magic Link yang dikirim Firebase lewat email (fitur "Lupa Password" /
// "Ganti Password" — lihat kirimMagicLinkResetPassword di shared/lib/firestore.ts). Link berisi
// query string ?mode=resetPassword&oobCode=... yang ditangani di sini (bukan halaman bawaan
// Firebase) supaya tampilannya konsisten dengan branding Archimax HRIS.

type Status = 'memverifikasi' | 'valid' | 'tidak-valid' | 'berhasil';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get('oobCode') || '';
  const mode = searchParams.get('mode') || '';

  const [status, setStatus] = useState<Status>('memverifikasi');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [passwordBaru, setPasswordBaru] = useState('');
  const [konfirmasiPassword, setKonfirmasiPassword] = useState('');
  const [loadingSimpan, setLoadingSimpan] = useState(false);

  useEffect(() => {
    if (mode !== 'resetPassword' || !oobCode) {
      setStatus('tidak-valid');
      setErrorMsg('Link tidak valid. Pastikan Anda membuka link Magic Link Reset Password terbaru dari email.');
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then((emailAkun) => {
        setEmail(emailAkun);
        setStatus('valid');
      })
      .catch((err) => {
        setStatus('tidak-valid');
        setErrorMsg(
          `Link sudah tidak berlaku atau sudah pernah dipakai. Silakan minta Magic Link baru lewat menu "Lupa Password". (${err instanceof Error ? err.message : String(err)})`,
        );
      });
  }, [mode, oobCode]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (passwordBaru.length < 6) {
      setErrorMsg('Password baru minimal 6 karakter.');
      return;
    }
    if (passwordBaru !== konfirmasiPassword) {
      setErrorMsg('Konfirmasi password baru tidak sama.');
      return;
    }
    setErrorMsg('');
    setLoadingSimpan(true);
    try {
      await confirmPasswordReset(auth, oobCode, passwordBaru);
      setStatus('berhasil');
    } catch (err) {
      setErrorMsg(`Gagal menyimpan password baru: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingSimpan(false);
    }
  }

  return (
    <div className="gate-wrap">
      <div className="card gate-card" style={{ textAlign: 'center' }}>
        <img
          src={LOGO_ARCHIMAX_URL}
          alt="Logo PT Archimax Architect Indonesia"
          style={{ width: '100%', maxWidth: 110, height: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto 12px' }}
        />
        <h1>Reset Password</h1>

        {status === 'memverifikasi' && <Spinner label="Memverifikasi Magic Link..." />}

        {status === 'tidak-valid' && (
          <>
            <p style={{ color: 'var(--red, #c0392b)' }}>{errorMsg}</p>
            <Link to={ROUTES.LANDING} className="btn btn-secondary" style={{ textDecoration: 'none', display: 'inline-block', marginTop: 8 }}>
              Kembali ke Welcome Page
            </Link>
          </>
        )}

        {status === 'valid' && (
          <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
            <p style={{ textAlign: 'center' }}>
              Buat password baru untuk akun <strong>{email}</strong>.
            </p>
            <div className="form-field">
              <label htmlFor="passwordBaruInput">Password Baru</label>
              <input
                id="passwordBaruInput"
                type="password"
                value={passwordBaru}
                onChange={(e) => setPasswordBaru(e.target.value)}
                required
                autoFocus
                autoComplete="new-password"
              />
            </div>
            <div className="form-field">
              <label htmlFor="konfirmasiPasswordInput">Konfirmasi Password Baru</label>
              <input
                id="konfirmasiPasswordInput"
                type="password"
                value={konfirmasiPassword}
                onChange={(e) => setKonfirmasiPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            {errorMsg && <p style={{ color: 'var(--red, #c0392b)' }}>{errorMsg}</p>}
            <button type="submit" className="btn" disabled={loadingSimpan} style={{ width: '100%' }}>
              {loadingSimpan ? <Spinner label="Menyimpan..." /> : 'Simpan Password Baru'}
            </button>
          </form>
        )}

        {status === 'berhasil' && (
          <>
            <p>Password berhasil diganti. Silakan login kembali dengan password baru Anda.</p>
            <Link to={ROUTES.LANDING} className="btn" style={{ textDecoration: 'none', display: 'inline-block', marginTop: 8 }}>
              Ke Halaman Login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
