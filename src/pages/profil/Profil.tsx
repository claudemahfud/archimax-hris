import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ROUTES } from '../../router/routePaths';
import { useAksesSuperadmin } from '../../shared/hooks/useAksesSuperadmin';
import { useAksesGate } from '../../shared/hooks/useAksesGate';
import { useAksesHod } from '../../shared/hooks/useAksesHod';
import { useAksesBranchManager } from '../../shared/hooks/useAksesBranchManager';
import { useToast } from '../../shared/hooks/useToast';
import { bacaSesiAkun } from '../../shared/lib/akunSession';
import { kirimMagicLinkResetPassword } from '../../shared/lib/firestore';
import { Spinner } from '../../shared/components/Loading';
import { AppShell } from '../../shared/components/AppShell';

// Halaman "Kelola Akun Sendiri" — dibuka dari tombol "Profil Saya" di kartu Welcome Page
// (Superadmin/HRD/HOD/Branch Manager, lihat Landing.tsx). Info Username/Email hanya tersedia untuk akun yang
// login lewat Username+Password atau Google yang cocok dengan Akun Portal (lihat
// shared/lib/akunSession.ts) — akses lewat Kode Akses (PIN) murni tidak punya akun personal.

export default function Profil() {
  const { showToast } = useToast();
  const { terverifikasi: isSuperadmin, keluar: keluarSuperadmin } = useAksesSuperadmin();
  const { terverifikasi: isHrd, keluar: keluarHrd } = useAksesGate('akses_hrd');
  const { terverifikasi: isHod, divisi: divisiHod, keluar: keluarHod } = useAksesHod();
  const { terverifikasi: isBm, divisi: divisiBm, keluar: keluarBm } = useAksesBranchManager();

  const [loadingGantiPassword, setLoadingGantiPassword] = useState(false);

  if (!isSuperadmin && !isHrd && !isHod && !isBm) return <Navigate to={ROUTES.LANDING} replace />;

  const sesiAkun = bacaSesiAkun();
  const role = isSuperadmin
    ? 'Superadmin'
    : isHod ? `HOD${divisiHod ? ` · ${divisiHod}` : ''}`
    : isBm ? `Branch Manager${divisiBm ? ` · ${divisiBm}` : ''}`
    : 'HRD';
  const keluar = isSuperadmin ? keluarSuperadmin : isHod ? keluarHod : isBm ? keluarBm : keluarHrd;

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
    <AppShell portalTitle="Archimax HRIS" pageTitle="Profil Saya" items={[]} onKeluar={keluar}>
        <div className="card" style={{ maxWidth: 480, margin: '32px auto' }}>
          <div style={{ textAlign: 'center' }}>
            <span
              aria-hidden="true"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 72, height: 72, borderRadius: '50%', margin: '0 auto 12px',
                background: 'var(--gradient-brand)', color: 'var(--white)', fontSize: '1.8rem', fontWeight: 800,
              }}
            >
              {(sesiAkun?.username || role).trim().charAt(0).toUpperCase()}
            </span>
            <h1 style={{ marginBottom: 4 }}>Profil Saya</h1>
            <span className="kpi-summary-chip kpi-summary-amber" style={{ marginBottom: 8 }}>{role}</span>
            <p>Kelola informasi akun Anda sendiri.</p>
          </div>

          {sesiAkun ? (
            <>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <InfoBaris label="Username" value={sesiAkun.username} />
                <InfoBaris label="Email" value={sesiAkun.email} />
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
              <p style={{ marginTop: 0 }}>
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
    </AppShell>
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
