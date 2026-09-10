import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ROUTES } from '../../router/routePaths';
import { LOGO_ARCHIMAX_URL } from '../../shared/constants/branding';
import { useAksesSuperadmin } from '../../shared/hooks/useAksesSuperadmin';
import { useAksesGate } from '../../shared/hooks/useAksesGate';
import { useAksesHod } from '../../shared/hooks/useAksesHod';
import { useToast } from '../../shared/hooks/useToast';
import { bacaSesiAkun } from '../../shared/lib/akunSession';
import { kirimMagicLinkResetPassword } from '../../shared/lib/firestore';
import { Spinner } from '../../shared/components/Loading';
import { PortalNav } from '../../shared/components/PortalNav';

// Halaman "Kelola Akun Sendiri" — dibuka dari tombol "Profil Saya" di kartu Welcome Page
// (Superadmin/HRD/HOD, lihat Landing.tsx). Info Username/Email hanya tersedia untuk akun yang
// login lewat Username+Password atau Google yang cocok dengan Akun Portal (lihat
// shared/lib/akunSession.ts) — akses lewat Kode Akses (PIN) murni tidak punya akun personal.

export default function Profil() {
  const { showToast } = useToast();
  const { terverifikasi: isSuperadmin, keluar: keluarSuperadmin } = useAksesSuperadmin();
  const { terverifikasi: isHrd, keluar: keluarHrd } = useAksesGate('akses_hrd');
  const { terverifikasi: isHod, divisi: divisiHod, keluar: keluarHod } = useAksesHod();

  const [loadingGantiPassword, setLoadingGantiPassword] = useState(false);

  if (!isSuperadmin && !isHrd && !isHod) return <Navigate to={ROUTES.LANDING} replace />;

  const sesiAkun = bacaSesiAkun();
  const role = isSuperadmin ? 'Superadmin' : isHod ? `HOD${divisiHod ? ` · ${divisiHod}` : ''}` : 'HRD';
  const keluar = isSuperadmin ? keluarSuperadmin : isHod ? keluarHod : keluarHrd;

  async function handleGantiPassword() {
    if (!sesiAkun) return;
    setLoadingGantiPassword(true);
    try {
      const email = await kirimMagicLinkResetPassword(sesiAkun.email);
      showToast('success', `Magic Link Ganti Password telah dikirim ke ${email}. Cek email Anda (termasuk folder Spam).`);
    } catch (err) {
      showToast('error', `Gagal mengirim Magic Link: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingGantiPassword(false);
    }
  }

  return (
    <div>
      <PortalNav title="Archimax HRIS" items={[]} onKeluar={keluar} />
      <div className="page">
        <div className="card" style={{ maxWidth: 480, margin: '32px auto' }}>
          <div style={{ textAlign: 'center' }}>
            <img
              src={LOGO_ARCHIMAX_URL}
              alt="Logo PT Archimax Architect Indonesia"
              style={{ width: '100%', maxWidth: 100, height: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto 12px' }}
            />
            <h1>Profil Saya</h1>
            <p>Kelola informasi akun Anda sendiri.</p>
          </div>

          {sesiAkun ? (
            <>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <InfoBaris label="Username" value={sesiAkun.username} />
                <InfoBaris label="Email" value={sesiAkun.email} />
                <InfoBaris label="Role" value={role} />
              </div>

              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--grey-light, #e5e5e5)' }}>
                <p style={{ fontWeight: 700, marginBottom: 6 }}>Ganti Password</p>
                <p style={{ fontSize: '0.9rem', marginBottom: 6 }}>
                  Kami akan mengirim Magic Link lewat email <strong>{sesiAkun.email}</strong> untuk
                  mengatur password baru — tidak perlu mengetik password lama.
                </p>
                <p style={{ fontSize: '0.82rem', marginBottom: 12, color: 'var(--grey, #666)' }}>
                  Password ini hanya berlaku untuk login ke website ini. Proses reset TIDAK PERNAH
                  menyentuh atau mengubah password akun Google/Gmail pribadi Anda, walau alamat
                  emailnya sama.
                </p>
                <button type="button" className="btn" disabled={loadingGantiPassword} onClick={handleGantiPassword} style={{ width: '100%' }}>
                  {loadingGantiPassword ? <Spinner label="Mengirim Magic Link..." /> : 'Kirim Magic Link Ganti Password'}
                </button>
              </div>
            </>
          ) : (
            <div style={{ marginTop: 16 }}>
              <InfoBaris label="Role" value={role} />
              <p style={{ marginTop: 16 }}>
                Anda masuk lewat Kode Akses (PIN){isSuperadmin ? ' / login Superadmin manual' : ''},
                bukan Akun Portal (Username + Password + Email). Belum ada password pribadi yang
                bisa diganti lewat halaman ini.
              </p>
              <p>
                Kalau ingin punya Username/Password sendiri (supaya bisa login manual & memakai
                fitur Ganti Password di sini), minta Superadmin mendaftarkan Anda lewat menu
                &quot;+ Daftarkan Akun HRD/HOD&quot; di Welcome Page.
              </p>
            </div>
          )}

          <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link to={ROUTES.LANDING} className="btn btn-secondary" style={{ textDecoration: 'none' }}>
              &larr; Kembali ke Welcome Page
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBaris({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--grey, #666)' }}>{label}</div>
      <div>{value}</div>
    </div>
  );
}
