import { initializeApp } from 'firebase/app';
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

// ==== Firebase Auth — dipakai untuk opsi "Login dengan Google" di halaman Ganti Kode Akses ====
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Analytics hanya berjalan di browser yang mendukung (butuh cookie/IndexedDB) — dicek dulu
// via isSupported() supaya tidak error saat build/prerender atau di browser yang memblokirnya.
export let analytics: Analytics | undefined;
isSupported().then((ok) => {
  if (ok) analytics = getAnalytics(app);
});
