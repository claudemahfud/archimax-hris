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
│   │   └── penilaian/     → /hrd/penilaian      (Form Penilaian khusus Level User HOD)
│   └── hod/                ROUTING TERPISAH: PORTAL HOD
│       ├── akses/         → /hod/akses          (pilih Divisi + PIN)
│       ├── monitoring/    → /hod/monitoring     (Monitoring & Rekap Staff divisi)
│       └── penilaian/     → /hod/penilaian      (Form Penilaian KPI Staff)
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
- `settings/aksesHod` — `{ [namaDivisi]: kodeAkses }` PIN per Divisi Portal HOD (belum ada
  default, isi manual dulu di Firebase Console sebelum dipakai untuk divisi terkait)
- `settings/superadmin` — `{ username, password }` login untuk menu **Ganti Kode Akses**
  (default sebelum diatur: `Superadmin` / `Admin123`, lihat `SUPERADMIN_DEFAULT` di file yang
  sama). Dokumen ini read-only dari client — untuk mengganti dari default, isi manual di
  Firebase Console.

### Menu "Ganti Kode Akses" (`/ganti-kode-akses`, tombol di Welcome Page)

Halaman ini butuh login Superadmin dulu (username/password default di atas, atau **Login
dengan Akun Google** via Firebase Auth — akun Google mana pun yang berhasil login dianggap
Superadmin, belum ada whitelist email). Setelah login, Kode Akses Master File HRD atau Portal
HOD per divisi bisa diganti langsung dari app (tersimpan ke `settings/aksesHrd` /
`settings/aksesHod`) tanpa perlu buka Firebase Console lagi.

> Firebase Auth: kalau login Google gagal dengan error `auth/operation-not-allowed` atau
> `auth/unauthorized-domain`, aktifkan provider **Google** di Firebase Console → Authentication
> → Sign-in method, lalu tambahkan domain deploy (mis. domain Vercel) ke **Authorized domains**.

### Aturan bisnis yang dipertahankan dari GAS asli

- Master File HRD hanya menilai KPI untuk karyawan `levelUser = "HOD"`.
- Portal HOD hanya menilai `levelUser = "Staff"` **di divisinya sendiri** (query difilter `divisi`).
- Rumus Skor Kedisiplinan/SOP: `100 − Σ(poin pengurang)`, minimum 0 — lihat
  `src/shared/constants/kpi.ts` (`hitungSkorKedisiplinan`), nilai poin identik dengan
  `hitungSoftSkills()` di Code.gs asli.
- 8 Aspek Hard Skill per Divisi (hardcode) — `ASPEK_HARDSKILL_PER_DIVISI` di file yang sama.

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
