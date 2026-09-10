import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';

// ==== KONFIGURASI FIREBASE — Project: archimax-hris ====
// Nilai default di bawah adalah config asli yang diberikan user. Tetap bisa dioverride lewat
// .env (lihat .env.example) — berguna kalau nanti pindah ke project Firebase lain / staging.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyB4ru-wHEJwbHKbgocUWoqbY4KxV2zcD_4',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'archimax-hris.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'archimax-hris',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'archimax-hris.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1039300075701',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1039300075701:web:a7821d67059e1a7d8a5efc',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-RSPYQP1VYV',
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// ==== Firebase Auth — dipakai untuk opsi "Login dengan Google" & Login manual Username/Password
// (Akun Portal HRD/HOD) di Welcome Page / halaman Ganti Kode Akses ====
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// ==== App Firebase KEDUA (instance terpisah, project SAMA) — khusus untuk membuat akun HRD/HOD
// baru (createUserWithEmailAndPassword). Firebase Auth otomatis login sebagai user yang baru
// dibuat pada instance yang dipakai; kalau kita pakai `auth` utama, sesi Superadmin yang sedang
// login akan ikut tertimpa/keluar. Dengan instance kedua ini, pembuatan akun baru terjadi di
// "ruang" terpisah lalu langsung sign-out dari situ — sesi Superadmin di `auth` utama tidak
// terganggu sama sekali. Lihat daftarkanAkunPortal() di firestore.ts.
const secondaryApp = getApps().some((a) => a.name === 'secondary')
  ? getApp('secondary')
  : initializeApp(firebaseConfig, 'secondary');
export const secondaryAuth = getAuth(secondaryApp);

// Analytics hanya berjalan di browser yang mendukung (butuh cookie/IndexedDB) — dicek dulu
// via isSupported() supaya tidak error saat build/prerender atau di browser yang memblokirnya.
export let analytics: Analytics | undefined;
isSupported().then((ok) => {
  if (ok) analytics = getAnalytics(app);
});
