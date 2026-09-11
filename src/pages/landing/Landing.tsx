import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithPopup, signOut } from 'firebase/auth';
import { ROUTES } from '../../router/routePaths';
import { LOGO_ARCHIMAX_URL } from '../../shared/constants/branding';
import { DAFTAR_DIVISI } from '../../shared/constants/kpi';
import { auth, googleProvider } from '../../shared/lib/firebase';
import {
  getWhitelistSuperadmin, cariAkunPortalByEmail, daftarkanAkunPortal, hapusAkunPortal, listAkunPortal,
  loginAkunPortal, kirimMagicLinkResetPassword, ubahUsernameAkunPortal, resetEmailPasswordAkunPortal,
  kodeAksesHodDefault, SudahAdaEmailSamaError,
} from '../../shared/lib/firestore';
import { simpanSesiAkun } from '../../shared/lib/akunSession';
import type { AkunPortal } from '../../shared/types';
import { useAksesSuperadmin } from '../../shared/hooks/useAksesSuperadmin';
import { useAksesGate } from '../../shared/hooks/useAksesGate';
import { useAksesHod } from '../../shared/hooks/useAksesHod';
import { useAksesBranchManager } from '../../shared/hooks/useAksesBranchManager';
import { useToast } from '../../shared/hooks/useToast';
import { Spinner } from '../../shared/components/Loading';
import { PortalNav } from '../../shared/components/PortalNav';

// Susunan dekorasi geometris (facet) latar Welcome Page — posisi & ukuran tetap (bukan acak)
// supaya tampilan konsisten setiap render, meniru pola mozaik diamond pada referensi desain.
const FACETS = [
  { top: '6%', left: '8%', size: 70, rotate: 45, tone: 'light' },
  { top: '14%', left: '22%', size: 40, rotate: 45, tone: 'light' },
  { top: '4%', left: '68%', size: 90, rotate: 45, tone: 'dark' },
  { top: '20%', left: '80%', size: 50, rotate: 45, tone: 'light' },
  { top: '34%', left: '4%', size: 55, rotate: 45, tone: 'dark' },
  { top: '46%', left: '88%', size: 65, rotate: 45, tone: 'light' },
  { top: '62%', left: '10%', size: 45, rotate: 45, tone: 'light' },
  { top: '70%', left: '30%', size: 80, rotate: 45, tone: 'dark' },
  { top: '78%', left: '72%', size: 55, rotate: 45, tone: 'light' },
  { top: '86%', left: '86%', size: 40, rotate: 45, tone: 'dark' },
  { top: '88%', left: '18%', size: 60, rotate: 45, tone: 'light' },
  { top: '2%', left: '46%', size: 35, rotate: 45, tone: 'dark' },
] as const;

type Mode = 'hero' | 'login';
type DaftarMode = 'hrd' | 'hod' | 'bm' | null;

export default function Landing() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const { terverifikasi: terverifikasiSuperadmin, loginManual, konfirmasiSuperadmin, keluar: keluarSuperadmin } = useAksesSuperadmin();
  const { terverifikasi: terverifikasiHrd, keluar: keluarHrd } = useAksesGate('akses_hrd');
  const { terverifikasi: terverifikasiHod, divisi: divisiHod, keluar: keluarHod } = useAksesHod();
  const { terverifikasi: terverifikasiBm, divisi: divisiBm, keluar: keluarBm } = useAksesBranchManager();

  const [mode, setMode] = useState<Mode>('hero');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  // Kelola Akun Portal (HRD/HOD) — khusus Superadmin, tambahan di samping Kode Akses (PIN)
  // yang tetap berfungsi seperti biasa. Form pendaftaran berisi Username, Password & Email.
  const [daftarMode, setDaftarMode] = useState<DaftarMode>(null);
  const [usernameAkunBaru, setUsernameAkunBaru] = useState('');
  const [emailAkunBaru, setEmailAkunBaru] = useState('');
  const [passwordAkunBaru, setPasswordAkunBaru] = useState('');
  const [konfirmasiPasswordAkunBaru, setKonfirmasiPasswordAkunBaru] = useState('');
  const [divisiAkunBaru, setDivisiAkunBaru] = useState<string>(DAFTAR_DIVISI[0]);
  const [loadingDaftarAkun, setLoadingDaftarAkun] = useState(false);
  const [daftarAkun, setDaftarAkun] = useState<AkunPortal[]>([]);

  // Ubah Akun (Username / Email+Password) — Username bisa diubah bebas (field Firestore
  // biasa); Email+Password HARUS diubah BERSAMAAN (keterbatasan keamanan Firebase Auth: client
  // tidak bisa mengganti kredensial akun orang lain tanpa tahu password lama, jadi yang
  // dilakukan sebenarnya membuat kredensial baru — lihat resetEmailPasswordAkunPortal).
  const [editAkunId, setEditAkunId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editKonfirmasiPassword, setEditKonfirmasiPassword] = useState('');
  const [loadingEditAkun, setLoadingEditAkun] = useState(false);

  // Lupa/Ganti Password — Magic Link Reset via Firebase (lihat kirimMagicLinkResetPassword
  // di shared/lib/firestore.ts). Sama-sama mengirim email berisi link ke /reset-password.
  const [lupaPasswordTerbuka, setLupaPasswordTerbuka] = useState(false);
  const [identitasLupaPassword, setIdentitasLupaPassword] = useState('');
  const [loadingLupaPassword, setLoadingLupaPassword] = useState(false);

  useEffect(() => {
    if (!terverifikasiSuperadmin) return;
    listAkunPortal().then(setDaftarAkun).catch(() => undefined);
  }, [terverifikasiSuperadmin]);

  // Satu form Username + Password untuk SEMUA role: dicoba berurutan sebagai Superadmin dulu,
  // kalau bukan lalu dicoba sebagai akun HRD/HOD terdaftar (username/email + password Firebase
  // Auth sungguhan — lihat daftarkanAkunPortal & loginAkunPortal di shared/lib/firestore.ts).
  async function handleLoginManual(e: FormEvent) {
    e.preventDefault();
    setLoadingLogin(true);
    try {
      const okSuperadmin = await loginManual(username, password);
      if (okSuperadmin) {
        showToast('success', 'Login berhasil. Selamat datang, Superadmin.');
        return;
      }

      const akun = await loginAkunPortal(username, password);
      if (akun?.role === 'HRD') {
        sessionStorage.setItem('akses_hrd', '1');
        simpanSesiAkun({ username: akun.username, email: akun.email });
        showToast('success', 'Login berhasil. Selamat datang, HRD.');
        navigate(ROUTES.HRD_DASHBOARD);
        return;
      }
      if (akun?.role === 'HOD' && akun.divisi) {
        sessionStorage.setItem('akses_hod', '1');
        sessionStorage.setItem('akses_hod_divisi', akun.divisi);
        simpanSesiAkun({ username: akun.username, email: akun.email });
        showToast('success', `Login berhasil. Selamat datang, HOD ${akun.divisi}.`);
        navigate(ROUTES.HOD_MONITORING);
        return;
      }
      if (akun?.role === 'Branch Manager' && akun.divisi) {
        sessionStorage.setItem('akses_branch_manager', '1');
        sessionStorage.setItem('akses_branch_manager_divisi', akun.divisi);
        simpanSesiAkun({ username: akun.username, email: akun.email });
        showToast('success', `Login berhasil. Selamat datang, Branch Manager ${akun.divisi}.`);
        navigate(ROUTES.BM_MONITORING);
        return;
      }

      showToast('error', 'Username atau password salah.');
    } catch (err) {
      showToast('error', `Gagal login: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingLogin(false);
    }
  }

  async function handleLupaPassword(e: FormEvent) {
    e.preventDefault();
    const bersih = identitasLupaPassword.trim();
    if (!bersih) return;
    setLoadingLupaPassword(true);
    try {
      const email = await kirimMagicLinkResetPassword(bersih);
      showToast('success', `Magic Link Reset Password telah dikirim ke ${email}. Cek email Anda (termasuk folder Spam).`);
      setIdentitasLupaPassword('');
      setLupaPasswordTerbuka(false);
    } catch (err) {
      showToast('error', `Gagal mengirim Magic Link: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingLupaPassword(false);
    }
  }

  // Satu tombol "Login dengan Google" untuk SEMUA role (Superadmin / HRD / HOD). Setelah popup
  // Google berhasil, email dicocokkan berurutan: whitelist Superadmin dulu (akses 100%), lalu
  // akun HRD/HOD yang didaftarkan Superadmin (lihat handleDaftarAkun di bawah). Kode Akses (PIN)
  // di halaman /hrd/akses & /hod/akses TETAP berfungsi seperti biasa untuk yang belum/tidak
  // punya akun Google terdaftar — ini jalur tambahan, bukan pengganti.
  async function handleLoginGoogle() {
    setLoadingGoogle(true);
    try {
      const hasil = await signInWithPopup(auth, googleProvider);
      const email = (hasil.user.email || '').toLowerCase().trim();

      const whitelist = await getWhitelistSuperadmin();
      if (whitelist.includes(email)) {
        konfirmasiSuperadmin();
        showToast('success', 'Login dengan Google berhasil. Selamat datang, Superadmin.');
        return;
      }

      const akun = await cariAkunPortalByEmail(email);
      if (akun?.role === 'HRD') {
        sessionStorage.setItem('akses_hrd', '1');
        simpanSesiAkun({ username: akun.username, email: akun.email });
        showToast('success', 'Login dengan Google berhasil. Selamat datang, HRD.');
        navigate(ROUTES.HRD_DASHBOARD);
        return;
      }
      if (akun?.role === 'HOD' && akun.divisi) {
        sessionStorage.setItem('akses_hod', '1');
        sessionStorage.setItem('akses_hod_divisi', akun.divisi);
        simpanSesiAkun({ username: akun.username, email: akun.email });
        showToast('success', `Login dengan Google berhasil. Selamat datang, HOD ${akun.divisi}.`);
        navigate(ROUTES.HOD_MONITORING);
        return;
      }
      if (akun?.role === 'Branch Manager' && akun.divisi) {
        sessionStorage.setItem('akses_branch_manager', '1');
        sessionStorage.setItem('akses_branch_manager_divisi', akun.divisi);
        simpanSesiAkun({ username: akun.username, email: akun.email });
        showToast('success', `Login dengan Google berhasil. Selamat datang, Branch Manager ${akun.divisi}.`);
        navigate(ROUTES.BM_MONITORING);
        return;
      }

      await signOut(auth).catch(() => undefined);
      showToast('error', `Email ${email || 'ini'} belum terdaftar. Hubungi Superadmin untuk didaftarkan.`);
    } catch (err) {
      showToast('error', `Gagal login dengan Google: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingGoogle(false);
    }
  }

  async function handleDaftarAkun(e: FormEvent) {
    e.preventDefault();
    if (!daftarMode) return;
    const usernameBersih = usernameAkunBaru.trim();
    const emailBersih = emailAkunBaru.trim();
    if (!usernameBersih || !emailBersih || !passwordAkunBaru) return;
    if (passwordAkunBaru !== konfirmasiPasswordAkunBaru) {
      showToast('error', 'Konfirmasi Password tidak sama.');
      return;
    }
    setLoadingDaftarAkun(true);
    try {
      await daftarkanAkunPortal({
        username: usernameBersih,
        email: emailBersih,
        password: passwordAkunBaru,
        role: daftarMode === 'hrd' ? 'HRD' : daftarMode === 'hod' ? 'HOD' : 'Branch Manager',
        divisi: (daftarMode === 'hod' || daftarMode === 'bm') ? divisiAkunBaru : undefined,
      });
      setDaftarAkun(await listAkunPortal());
      showToast(
        'success',
        daftarMode === 'hrd'
          ? `Akun HRD "${usernameBersih}" (${emailBersih}) berhasil didaftarkan.`
          : `Akun ${daftarMode === 'hod' ? 'HOD' : 'Branch Manager'} "${usernameBersih}" (${emailBersih}) berhasil didaftarkan. Kode Akses awal: ${kodeAksesHodDefault()} — bisa diganti lewat menu Kelola Kode Akses HOD & Branch Manager.`,
      );
      setUsernameAkunBaru('');
      setEmailAkunBaru('');
      setPasswordAkunBaru('');
      setKonfirmasiPasswordAkunBaru('');
      setDaftarMode(null);
    } catch (err) {
      showToast('error', `Gagal mendaftarkan akun: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingDaftarAkun(false);
    }
  }

  async function handleHapusAkun(akun: AkunPortal) {
    setLoadingDaftarAkun(true);
    try {
      await hapusAkunPortal(akun.id);
      setDaftarAkun(await listAkunPortal());
      showToast('success', `Akun ${akun.email} berhasil dihapus.`);
    } catch (err) {
      showToast('error', `Gagal menghapus akun: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingDaftarAkun(false);
    }
  }

  function bukaEditAkun(akun: AkunPortal) {
    setEditAkunId(akun.id);
    setEditUsername(akun.username);
    setEditEmail(akun.email);
    setEditPassword('');
    setEditKonfirmasiPassword('');
  }

  function tutupEditAkun() {
    setEditAkunId(null);
    setEditUsername('');
    setEditEmail('');
    setEditPassword('');
    setEditKonfirmasiPassword('');
  }

  async function handleSimpanEditAkun(e: FormEvent) {
    e.preventDefault();
    if (!editAkunId) return;
    const akunAsli = daftarAkun.find((a) => a.id === editAkunId);
    if (!akunAsli) return;

    const usernameBaru = editUsername.trim();
    const emailBaru = editEmail.trim();
    const emailBerubah = emailBaru.toLowerCase() !== akunAsli.email.toLowerCase();

    if (emailBerubah && !editPassword) {
      showToast('error', 'Untuk mengubah Email, isi juga Password baru — Email & Password harus diganti bersamaan.');
      return;
    }
    if (editPassword && editPassword !== editKonfirmasiPassword) {
      showToast('error', 'Konfirmasi Password baru tidak sama.');
      return;
    }

    setLoadingEditAkun(true);
    try {
      if (usernameBaru && usernameBaru.toLowerCase() !== akunAsli.username.toLowerCase()) {
        await ubahUsernameAkunPortal(editAkunId, usernameBaru);
      }
      if (editPassword) {
        await resetEmailPasswordAkunPortal(editAkunId, { email: emailBaru, password: editPassword });
      }
      setDaftarAkun(await listAkunPortal());
      showToast('success', 'Akun berhasil diperbarui.');
      tutupEditAkun();
    } catch (err) {
      if (err instanceof SudahAdaEmailSamaError) {
        // Bukan kegagalan sungguhan — Magic Link sudah terkirim, hanya password-nya tidak
        // langsung diganti dari sini (lihat catatan di resetEmailPasswordAkunPortal).
        showToast('success', err.message);
        setDaftarAkun(await listAkunPortal());
        tutupEditAkun();
      } else {
        showToast('error', `Gagal memperbarui akun: ${err instanceof Error ? err.message : String(err)}`);
      }
    } finally {
      setLoadingEditAkun(false);
    }
  }

  const Logo = (size: number) => (
    <Link to={ROUTES.LANDING} className="login-logo-link" aria-label="Beranda">
      <img
        src={LOGO_ARCHIMAX_URL}
        alt="Logo PT Archimax Architect Indonesia"
        style={{ width: '100%', maxWidth: size, height: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto' }}
      />
    </Link>
  );

  // ==== Sudah login sebagai Superadmin (akun kendali penuh — Full Akses 100%) ====
  if (terverifikasiSuperadmin) {
    return (
      <div>
        <PortalNav title="Archimax HRIS" items={[]} onKeluar={keluarSuperadmin} />
        <div className="page">
          <div className="card" style={{ maxWidth: 480, margin: '32px auto', textAlign: 'center' }}>
            {Logo(140)}
            <h1 className="login-title">Selamat Datang, Superadmin</h1>
            <p className="login-subtitle">Pilih portal yang ingin dikelola.</p>
            <div className="dashboard-links">
              <Link to={ROUTES.HRD_DASHBOARD} className="btn">Master File HRD</Link>
              <Link to={ROUTES.HOD_AKSES} className="btn btn-secondary">Portal HOD</Link>
              <Link to={ROUTES.BM_AKSES} className="btn btn-secondary">Portal Branch Manager</Link>
              <Link to={ROUTES.GANTI_KODE_AKSES} className="btn btn-secondary">Ganti Kode Akses</Link>
              <Link to={ROUTES.KELOLA_KODE_AKSES_HOD} className="btn btn-secondary">Kelola Kode Akses HOD &amp; BM</Link>
              <Link to={ROUTES.PROFIL} className="btn btn-secondary">Profil Saya</Link>
            </div>

            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--grey-light, #e5e5e5)', textAlign: 'left' }}>
              <p style={{ fontWeight: 700, marginBottom: 10, textAlign: 'center' }}>Kelola Akun Portal (Login via Google)</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 12 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDaftarMode(daftarMode === 'hrd' ? null : 'hrd')}
                >
                  + Daftarkan Akun HRD
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDaftarMode(daftarMode === 'hod' ? null : 'hod')}
                >
                  + Daftarkan Akun HOD
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDaftarMode(daftarMode === 'bm' ? null : 'bm')}
                >
                  + Daftarkan Akun Branch Manager
                </button>
              </div>

              {daftarMode && (
                <form onSubmit={handleDaftarAkun} style={{ marginBottom: 16 }}>
                  <div className="form-field">
                    <label htmlFor="usernameAkunBaruInput">Username {daftarMode === 'hrd' ? 'HRD' : daftarMode === 'hod' ? 'HOD' : 'Branch Manager'}</label>
                    <input
                      id="usernameAkunBaruInput"
                      type="text"
                      value={usernameAkunBaru}
                      onChange={(e) => setUsernameAkunBaru(e.target.value)}
                      placeholder="mis. hrd.archimax"
                      required
                      autoFocus
                      autoComplete="off"
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="passwordAkunBaruInput">Password</label>
                    <input
                      id="passwordAkunBaruInput"
                      type="password"
                      value={passwordAkunBaru}
                      onChange={(e) => setPasswordAkunBaru(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="konfirmasiPasswordAkunBaruInput">Konfirmasi Password</label>
                    <input
                      id="konfirmasiPasswordAkunBaruInput"
                      type="password"
                      value={konfirmasiPasswordAkunBaru}
                      onChange={(e) => setKonfirmasiPasswordAkunBaru(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="emailAkunBaruInput">Email {daftarMode === 'hrd' ? 'HRD' : daftarMode === 'hod' ? 'HOD' : 'Branch Manager'} (untuk Login dengan Google &amp; Magic Link Reset Password)</label>
                    <input
                      id="emailAkunBaruInput"
                      type="email"
                      value={emailAkunBaru}
                      onChange={(e) => setEmailAkunBaru(e.target.value)}
                      placeholder="nama@gmail.com"
                      required
                    />
                  </div>
                  <p style={{ fontSize: '0.82rem', marginTop: -6, marginBottom: 10 }}>
                    Password di atas hanya berlaku untuk login ke website ini — <strong>bukan</strong>
                    {' '}password akun Google/Gmail pribadi. Boleh pakai alamat Gmail yang sudah ada,
                    aman: sistem ini tidak pernah membaca/mengubah password akun Google aslinya.
                  </p>
                  {(daftarMode === 'hod' || daftarMode === 'bm') && (
                    <div className="form-field">
                      <label htmlFor="divisiAkunBaruSelect">Divisi</label>
                      <select
                        id="divisiAkunBaruSelect"
                        value={divisiAkunBaru}
                        onChange={(e) => setDivisiAkunBaru(e.target.value)}
                      >
                        {DAFTAR_DIVISI.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  )}
                  <button type="submit" className="btn" disabled={loadingDaftarAkun} style={{ width: '100%' }}>
                    {loadingDaftarAkun ? <Spinner label="Menyimpan..." /> : 'Daftarkan Akun'}
                  </button>
                </form>
              )}

              {daftarAkun.length === 0 ? (
                <p style={{ textAlign: 'center' }}>Belum ada akun HRD/HOD/Branch Manager terdaftar.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {daftarAkun.map((akun) => (
                    <li
                      key={akun.id}
                      style={{
                        border: '1px solid var(--grey-light, #e5e5e5)', borderRadius: 10, padding: '8px 12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        <span>
                          <strong>{akun.role}</strong>{akun.divisi ? ` · ${akun.divisi}` : ''} — {akun.username} ({akun.email})
                          {(akun.role === 'HOD' || akun.role === 'Branch Manager') && (
                            <> · Kode Akses: <strong>{akun.kodeAkses || kodeAksesHodDefault()}</strong></>
                          )}
                        </span>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={loadingDaftarAkun}
                            onClick={() => (editAkunId === akun.id ? tutupEditAkun() : bukaEditAkun(akun))}
                            style={{ padding: '4px 12px', fontSize: '0.85rem' }}
                          >
                            {editAkunId === akun.id ? 'Batal' : 'Ubah'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={loadingDaftarAkun}
                            onClick={() => handleHapusAkun(akun)}
                            style={{ padding: '4px 12px', fontSize: '0.85rem' }}
                          >
                            Hapus
                          </button>
                        </div>
                      </div>

                      {editAkunId === akun.id && (
                        <form onSubmit={handleSimpanEditAkun} style={{ marginTop: 12, borderTop: '1px dashed var(--grey-light, #e5e5e5)', paddingTop: 12 }}>
                          <div className="form-field">
                            <label htmlFor={`editUsername-${akun.id}`}>Username</label>
                            <input
                              id={`editUsername-${akun.id}`}
                              type="text"
                              value={editUsername}
                              onChange={(e) => setEditUsername(e.target.value)}
                              required
                            />
                          </div>
                          <div className="form-field">
                            <label htmlFor={`editEmail-${akun.id}`}>Email</label>
                            <input
                              id={`editEmail-${akun.id}`}
                              type="email"
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              required
                            />
                          </div>
                          <p style={{ fontSize: '0.82rem', marginTop: -6, marginBottom: 10 }}>
                            Ganti Email hanya berlaku kalau Password baru juga diisi (Email &amp;
                            Password saling terikat — keduanya diganti bersamaan). Kosongkan
                            Password kalau cuma mau mengubah Username. Kalau Password diisi TAPI
                            Email dibiarkan sama, sistem akan mengirim Magic Link Reset Password
                            ke email tersebut (Firebase tidak mengizinkan mengganti password akun
                            orang lain secara langsung) — pemilik akun mengatur password barunya
                            sendiri lewat email itu.
                          </p>
                          <div className="form-field">
                            <label htmlFor={`editPassword-${akun.id}`}>Password Baru (opsional)</label>
                            <input
                              id={`editPassword-${akun.id}`}
                              type="password"
                              value={editPassword}
                              onChange={(e) => setEditPassword(e.target.value)}
                              placeholder="Kosongkan kalau tidak diganti"
                              minLength={6}
                              autoComplete="new-password"
                            />
                          </div>
                          {editPassword && (
                            <div className="form-field">
                              <label htmlFor={`editKonfirmasiPassword-${akun.id}`}>Konfirmasi Password Baru</label>
                              <input
                                id={`editKonfirmasiPassword-${akun.id}`}
                                type="password"
                                value={editKonfirmasiPassword}
                                onChange={(e) => setEditKonfirmasiPassword(e.target.value)}
                                required
                                minLength={6}
                                autoComplete="new-password"
                              />
                            </div>
                          )}
                          <button type="submit" className="btn" disabled={loadingEditAkun} style={{ width: '100%' }}>
                            {loadingEditAkun ? <Spinner label="Menyimpan..." /> : 'Simpan Perubahan'}
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==== Sudah login sebagai HRD (akun Google terdaftar) — TANPA Portal HOD & Ganti Kode Akses ====
  if (terverifikasiHrd) {
    return (
      <div>
        <PortalNav title="Archimax HRIS" items={[]} onKeluar={keluarHrd} />
        <div className="page">
          <div className="card" style={{ maxWidth: 480, margin: '32px auto', textAlign: 'center' }}>
            {Logo(140)}
            <h1 className="login-title">Selamat Datang, HRD</h1>
            <p className="login-subtitle">Pilih portal yang ingin dikelola.</p>
            <div className="dashboard-links">
              <Link to={ROUTES.HRD_DASHBOARD} className="btn">Master File HRD</Link>
              <Link to={ROUTES.HRD_KARYAWAN} className="btn btn-secondary">Kelola Karyawan</Link>
              <Link to={ROUTES.PROFIL} className="btn btn-secondary">Profil Saya</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==== Sudah login sebagai HOD (akun Google terdaftar per divisi) ====
  if (terverifikasiHod) {
    return (
      <div>
        <PortalNav title="Archimax HRIS" items={[]} onKeluar={keluarHod} />
        <div className="page">
          <div className="card" style={{ maxWidth: 480, margin: '32px auto', textAlign: 'center' }}>
            {Logo(140)}
            <h1 className="login-title">Selamat Datang, HOD {divisiHod}</h1>
            <p className="login-subtitle">Pilih portal yang ingin dikelola.</p>
            <div className="dashboard-links">
              <Link to={ROUTES.HOD_MONITORING} className="btn">Portal HOD</Link>
              <Link to={ROUTES.PROFIL} className="btn btn-secondary">Profil Saya</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==== Sudah login sebagai Branch Manager (akun Google terdaftar per divisi) ====
  if (terverifikasiBm) {
    return (
      <div>
        <PortalNav title="Archimax HRIS" items={[]} onKeluar={keluarBm} />
        <div className="page">
          <div className="card" style={{ maxWidth: 480, margin: '32px auto', textAlign: 'center' }}>
            {Logo(140)}
            <h1 className="login-title">Selamat Datang, Branch Manager {divisiBm}</h1>
            <p className="login-subtitle">Pilih portal yang ingin dikelola.</p>
            <div className="dashboard-links">
              <Link to={ROUTES.BM_MONITORING} className="btn">Portal Branch Manager</Link>
              <Link to={ROUTES.PROFIL} className="btn btn-secondary">Profil Saya</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==== Belum login: Welcome Page hero bergaya geometris, tanpa navbar ====
  return (
    <div className="welcome-scene">
      <div className="welcome-deco" aria-hidden="true">
        <span className="deco-wedge deco-wedge-dark" />
        <span className="deco-wedge deco-wedge-mid" />
        {FACETS.map((f, i) => (
          <span
            key={i}
            className={`deco-facet deco-facet-${f.tone}`}
            style={{ top: f.top, left: f.left, width: f.size, height: f.size, transform: `rotate(${f.rotate}deg)` }}
          />
        ))}
      </div>

      <div key={mode} className="card welcome-card welcome-anim-in">
        {mode === 'hero' ? (
          <div className="welcome-hero-inner">
            <h1 className="welcome-heading">WELCOME!</h1>
            {Logo(150)}
            <p className="welcome-hris-label">HRIS (Human Resource Information System)</p>
            <p className="welcome-desc">
              Portal terpusat manajemen data karyawan &amp; penilaian KPI PT Archimax Architect Indonesia.
            </p>
            <button type="button" className="btn welcome-login-btn" onClick={() => setMode('login')}>
              Login
            </button>
          </div>
        ) : (
          <div className="welcome-login-inner">
            <button type="button" className="link-muted welcome-back-btn" onClick={() => setMode('hero')}>
              &larr; Kembali
            </button>
            {Logo(120)}
            <h1 className="login-title">Archimax HRD &amp; KPI Portal</h1>
            <p className="login-subtitle">PT Archimax Architect Indonesia</p>

            <form onSubmit={handleLoginManual}>
              <div className="form-field">
                <label htmlFor="landingUsername">Username</label>
                <input
                  id="landingUsername"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                />
              </div>
              <div className="form-field">
                <label htmlFor="landingPassword">Password</label>
                <input
                  id="landingPassword"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <button type="submit" className="btn" disabled={loadingLogin || loadingGoogle} style={{ width: '100%' }}>
                {loadingLogin ? <Spinner label="Memverifikasi..." /> : 'Masuk'}
              </button>
            </form>

            <button
              type="button"
              className="link-muted"
              style={{ display: 'block', margin: '10px auto 0', textAlign: 'center' }}
              onClick={() => setLupaPasswordTerbuka((v) => !v)}
            >
              Lupa Password?
            </button>

            {lupaPasswordTerbuka && (
              <form onSubmit={handleLupaPassword} style={{ marginTop: 10 }}>
                <p style={{ fontSize: '0.9rem' }}>
                  Masukkan Username atau Email akun HRD/HOD Anda. Kami akan mengirim Magic Link
                  lewat email untuk mengatur password baru — password ini hanya berlaku di
                  website ini, sama sekali tidak menyentuh password akun Google/Gmail pribadi
                  Anda.
                </p>
                <div className="form-field">
                  <label htmlFor="identitasLupaPasswordInput">Username atau Email</label>
                  <input
                    id="identitasLupaPasswordInput"
                    type="text"
                    value={identitasLupaPassword}
                    onChange={(e) => setIdentitasLupaPassword(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <button type="submit" className="btn btn-secondary" disabled={loadingLupaPassword} style={{ width: '100%' }}>
                  {loadingLupaPassword ? <Spinner label="Mengirim Magic Link..." /> : 'Kirim Magic Link Reset Password'}
                </button>
              </form>
            )}

            <div className="divider-or"><span>atau</span></div>

            <button
              type="button"
              className="btn btn-google"
              onClick={handleLoginGoogle}
              disabled={loadingLogin || loadingGoogle}
              style={{ width: '100%', marginBottom: 10 }}
            >
              {loadingGoogle ? (
                <Spinner label="Menghubungkan ke Google..." />
              ) : (
                <>
                  <GoogleIcon /> Login dengan Google
                </>
              )}
            </button>

            <button
              type="button"
              className="btn btn-google btn-apple"
              disabled
              style={{ width: '100%' }}
              title="Login dengan Apple ID akan segera tersedia"
            >
              <AppleIcon /> Login dengan Apple ID
              <span className="badge badge-soon">Segera Hadir</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.8 2.73v2.27h2.92c1.7-1.57 2.68-3.88 2.68-6.64z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34C2.44 15.98 5.48 18 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72c-.18-.54-.28-1.11-.28-1.72s.1-1.18.28-1.72V4.94H.96A8.996 8.996 0 000 9c0 1.45.35 2.83.96 4.06l3.01-2.34z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="18" viewBox="0 0 16 18" aria-hidden="true" fill="currentColor">
      <path d="M12.94 9.55c-.02-2.05 1.68-3.03 1.76-3.08-.96-1.4-2.45-1.6-2.98-1.62-1.27-.13-2.48.75-3.12.75-.64 0-1.63-.73-2.68-.71-1.38.02-2.65.8-3.36 2.03-1.43 2.48-.37 6.15 1.03 8.16.68.98 1.5 2.08 2.57 2.04 1.03-.04 1.42-.66 2.67-.66 1.24 0 1.6.66 2.68.64 1.11-.02 1.81-1 2.48-1.99.78-1.14 1.1-2.25 1.12-2.3-.02-.01-2.14-.82-2.17-3.26zM10.9 3.48c.56-.68.94-1.62.83-2.56-.81.03-1.79.54-2.37 1.21-.52.6-.97 1.56-.85 2.48.9.07 1.83-.46 2.39-1.13z" />
    </svg>
  );
}
