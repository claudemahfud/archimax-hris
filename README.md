# HRIS-Archimax (React + Firebase)

Migrasi dari Google Apps Script (Master File HRD + Portal HOD, spreadsheet-based) ke
React + TypeScript + Vite + Firebase Firestore, siap deploy Vercel.

## Struktur Folder (1 slug = 1 file, 1 folder = 1 fitur)

```
src/
├── pages/
│   ├── landing/          → "/"              (pilih portal)
│   ├── hrd/               ROUTING TERPISAH: MASTER KARYAWAN (HRD)
│   │   ├── akses/         → /hrd/akses
│   │   ├── dashboard/     → /hrd/dashboard      (Homepage & Grafik)
│   │   ├── karyawan/      → /hrd/karyawan       (Kelola Data Karyawan)
│   │   └── penilaian/     → /hrd/penilaian      (Form Penilaian khusus Level User HOD/Branch Manager/EKSEKUTIF)
│   ├── hod/                 ROUTING TERPISAH: PORTAL HOD
│   │   ├── akses/         → /hod/akses          (pilih Divisi + Kode Akses pribadi akun HOD)
│   │   ├── monitoring/    → /hod/monitoring     (Monitoring & Rekap Staff divisi)
│   │   └── penilaian/     → /hod/penilaian      (Form Penilaian KPI Staff)
│   ├── branch-manager/       ROUTING TERPISAH: PORTAL BRANCH MANAGER (setara HOD)
│   │   ├── akses/         → /branch-manager/akses       (pilih Divisi + Kode Akses pribadi akun Branch Manager)
│   │   ├── monitoring/    → /branch-manager/monitoring  (Monitoring & Rekap Staff divisi)
│   │   └── penilaian/     → /branch-manager/penilaian   (Form Penilaian KPI Staff)
│   └── settings/
│       ├── ganti-kode-akses/       → /ganti-kode-akses          (Kode Akses Master File HRD)
│       └── kelola-kode-akses-hod/  → /kelola-kode-akses-hod     (Kode Akses pribadi tiap akun HOD & Branch Manager)
├── shared/                 dipakai ≥2 halaman (Rule of Two): firebase, komponen, hooks, constants
├── router/routes.ts        satu-satunya sumber routing (App.tsx menyatukan semua di sini)
└── App.tsx / main.tsx
```

## Setup

1. `npm install`
2. Firebase config **sudah terisi** (project `archimax-hris`, termasuk Analytics/`measurementId`)
   — di-hardcode sebagai fallback di `src/shared/lib/firebase.ts` dan juga di `.env` (file ini
   di-gitignore, jadi tidak ikut ter-push ke GitHub; kalau perlu ganti project, isi `.env.example`
   → `.env` dengan nilai project baru).
3. Di Firebase Console (project `archimax-hris`): aktifkan **Firestore Database** (mode production)
   kalau belum aktif.
4. `npm run dev` untuk cek lokal.

### Struktur data Firestore (dibuat otomatis saat pertama kali dipakai)

- `karyawan/{id}` — data master karyawan (34 field, identik `HEADER_KARYAWAN` GAS asli)
- `penilaianKpi/{id}` — riwayat penilaian KPI mingguan per karyawan
- `settings/aksesHrd` — `{ kodeAkses: string }` PIN Master File HRD (default sebelum diatur:
  **`120200MFD`**, lihat `KODE_AKSES_HRD_DEFAULT` di `src/shared/lib/firestore.ts`)
- `settings/superadmin` — `{ username, password }` login untuk menu **Ganti Kode Akses** &
  **Kelola Kode Akses HOD** (default sebelum diatur: `Superadmin` / `Admin123`, lihat
  `SUPERADMIN_DEFAULT` di file yang sama). Dokumen ini read-only dari client — untuk mengganti
  dari default, isi manual di Firebase Console.
- `akunPortal/{id}.kodeAkses` — PIN **pribadi** Portal HOD / Portal Branch Manager, satu per akun
  (bukan lagi kode
  bersama per divisi). Diisi otomatis `000000` saat akun HOD baru didaftarkan Superadmin (lihat
  `KODE_AKSES_HOD_DEFAULT` di `src/shared/lib/firestore.ts`); akun HOD lama yang field ini masih
  kosong juga otomatis dianggap `000000` sampai diganti — tidak perlu migrasi data manual.

### Menu "Ganti Kode Akses" (`/ganti-kode-akses`, tombol di Welcome Page)

Halaman ini butuh login Superadmin dulu (username/password default di atas, atau **Login
dengan Akun Google** via Firebase Auth — akun Google mana pun yang berhasil login dianggap
Superadmin, belum ada whitelist email). Setelah login, Kode Akses Master File HRD bisa diganti
langsung dari app (tersimpan ke `settings/aksesHrd`) tanpa perlu buka Firebase Console lagi.

### Menu "Kelola Kode Akses HOD & Branch Manager" (`/kelola-kode-akses-hod`, tombol di Welcome Page)

Juga butuh login Superadmin. Menampilkan seluruh akun HOD dan Branch Manager terdaftar
dikelompokkan per portal lalu per Divisi, lengkap Kode Akses pribadi masing-masing — bisa
diganti atau direset ke `000000` satu per satu. Login Portal HOD (`/hod/akses`) maupun Portal
Branch Manager (`/branch-manager/akses`) tetap memilih Divisi dari dropdown lebih dulu, lalu
Kode Akses yang diketik dicocokkan ke seluruh akun pada Divisi & role itu (satu Divisi boleh
punya lebih dari satu akun HOD dan/atau Branch Manager, masing-masing kodenya berbeda). Ada
juga link "Lupa Kode Akses" yang membuka WhatsApp Admin (`wa.me/6282234651413`) dengan pesan
template `Pengajuan Reset Kode Akses HOD {Nama Divisi}` atau `Pengajuan Reset Kode Akses Branch
Manager {Nama Divisi}` otomatis terisi sesuai Divisi & role yang sedang dipilih.

> Firebase Auth: kalau login Google gagal dengan error `auth/operation-not-allowed` atau
> `auth/unauthorized-domain`, aktifkan provider **Google** di Firebase Console → Authentication
> → Sign-in method, lalu tambahkan domain deploy (mis. domain Vercel) ke **Authorized domains**.

### Aturan bisnis yang dipertahankan dari GAS asli

- Master File HRD hanya menilai KPI untuk karyawan `levelUser = "HOD"`, `"Branch Manager"`,
  atau `"EKSEKUTIF"`.
- Portal HOD & Portal Branch Manager (setara HOD — akses, fitur, dan Kode Akses pribadi per akun
  bekerja identik, hanya beda label/route) masing-masing hanya menilai `levelUser = "Staff"`
  **di divisinya sendiri** (query difilter `divisi`). KPI HOD maupun Branch Manager sendiri
  dinilai oleh HRD lewat Master File HRD di atas.
- Rumus Skor Kedisiplinan/SOP: `100 − Σ(poin pengurang)`, minimum 0 — lihat
  `src/shared/constants/kpi.ts` (`hitungSkorKedisiplinan`), nilai poin identik dengan
  `hitungSoftSkills()` di Code.gs asli.
- 8 Aspek Hard Skill per Divisi (hardcode) — `ASPEK_HARDSKILL_PER_DIVISI` di file yang sama.

### Akun Portal HRD/HOD/Branch Manager — Username, Password & Email (+ Magic Link Reset Password)

Superadmin bisa mendaftarkan akun HRD/HOD/Branch Manager lewat tombol **"+ Daftarkan Akun HRD"**,
**"+ Daftarkan Akun HOD"**, atau **"+ Daftarkan Akun Branch Manager"** di
Welcome Page. Form pendaftaran berisi 3 field: **Username**, **Password**, **Email**.

- `akunPortal/{id}` — `{ username, email, role: 'HRD'|'HOD'|'Branch Manager', divisi?, createdAt }`. Password
  **tidak** disimpan di sini — hanya tersimpan aman di **Firebase Authentication** (dibuat via
  `createUserWithEmailAndPassword`, lihat `daftarkanAkunPortal()` di
  `src/shared/lib/firestore.ts`). Pembuatan akun baru memakai instance Firebase App KEDUA
  (`secondaryAuth` di `src/shared/lib/firebase.ts`) supaya sesi Superadmin yang sedang login
  tidak ikut ter-sign-out/tertimpa.
- Login akun HRD/HOD/Branch Manager bisa lewat 2 jalur: (1) **Username/Email + Password** di form Login utama
  (`loginAkunPortal()`), atau (2) **Login dengan Google** (email harus cocok dengan yang
  didaftarkan, jalur lama yang sudah ada sebelumnya).
- **Ubah Akun** — Superadmin bisa mengubah **Username** kapan saja secara bebas (murni field
  Firestore, lihat `ubahUsernameAkunPortal()`). Mengubah **Email** hanya bisa dilakukan
  BERSAMAAN dengan Password baru (lihat `resetEmailPasswordAkunPortal()`) — ini keterbatasan
  keamanan Firebase Auth: dari sisi client, Superadmin tidak bisa mengganti kredensial akun
  ORANG LAIN tanpa tahu password lamanya, jadi yang sebenarnya terjadi adalah membuat kredensial
  Firebase Auth baru (email+password baru) lalu memperbarui field `email` di Firestore supaya
  Username-Email-Password tetap satu identitas yang terikat/konsisten. Akun Firebase Auth lama
  (kalau email diganti) otomatis jadi tidak terpakai — aman diabaikan, atau dihapus manual lewat
  Firebase Console kalau perlu beres-beres.
- **Magic Link Reset Password** — link **"Lupa Password?"** di form Login (dan tombol "Kirim
  Magic Link Ganti Password" di halaman **Profil Saya**, `/profil`, setelah login) memakai
  `sendPasswordResetEmail` (Firebase Auth) dengan `handleCodeInApp: true`, sehingga email berisi
  link yang mengarah balik ke halaman `/reset-password` di app ini (bukan halaman bawaan
  Firebase). Halaman itu (`src/pages/reset-password/`) memverifikasi `oobCode` lalu membiarkan
  user mengatur password baru — dipakai baik untuk "lupa password" maupun sekadar "ganti
  password" (tidak perlu tahu password lama).

  > **Penting:** Password akun HRD/HOD/Branch Manager di atas HANYA berlaku untuk login ke website ini
  > (tersimpan di Firebase Authentication milik project `archimax-hris`). Walaupun emailnya
  > memakai alamat Gmail asli, sistem ini **sama sekali terpisah** dari akun Google pribadi
  > pemilik email — Magic Link Reset Password tidak pernah membaca maupun mengubah password
  > akun Google/Gmail aslinya.

> **Wajib di Firebase Console** sebelum fitur ini berfungsi: Authentication → Sign-in method →
> aktifkan provider **Email/Password**. Kalau app di-deploy ke domain custom (mis. Vercel),
> tambahkan juga domain tsb ke **Authorized domains** — kalau tidak, `sendPasswordResetEmail`
> akan gagal dengan error `auth/unauthorized-continue-uri`.

### Catatan keamanan PIN & Superadmin

Verifikasi Kode Akses dan login Superadmin (username/password) saat ini berjalan di client
(setara alur PIN GAS lama yang di-deploy "Anyone"). Login Google memakai Firebase Auth
sungguhan, tapi belum ada whitelist email tertentu. Untuk keamanan produksi lebih baik,
tambahkan Firestore Security Rules yang membatasi baca/tulis koleksi `karyawan` &
`penilaianKpi`, whitelist email Google via Firestore Rules/Cloud Function, atau pindahkan
verifikasi ke Cloud Function/Firebase App Check.

## Deploy ke Vercel (Auto-Deploy dari GitHub)

1. Push repo ini ke GitHub (repo baru, root project langsung ini).
2. Di Vercel: **New Project** → import repo GitHub tsb → framework otomatis terdeteksi (Vite).
3. Environment Variables **opsional** di Vercel — config Firebase sudah ada sebagai fallback
   hardcode di kode, jadi build tetap jalan tanpa env vars. Tambahkan lewat Project Settings →
   Environment Variables hanya kalau nanti ingin pindah/override ke project Firebase lain.
4. Deploy. Setiap push ke branch utama otomatis re-deploy (`vercel.json` sudah mengatur
   SPA rewrite ke `index.html` supaya routing React Router tidak 404 saat reload).

## Menambah halaman/menu baru

Ikuti pola solo-project-structure: buat folder baru di `src/pages/hrd/<slug>/` atau
`src/pages/hod/<slug>/` berisi `<Nama>.tsx` + `index.ts` (barrel), lalu tambah satu baris
di `src/router/routes.ts` dan `src/router/ROUTES.ts`. Jangan ubah struktur lain.
