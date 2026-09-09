// ============================================================
// Cloudinary — upload gambar tanpa backend (unsigned upload preset).
// Kenapa unsigned: project ini React SPA murni tanpa server, jadi
// API Secret Cloudinary TIDAK BOLEH ditaruh di sini (akan terekspos
// ke publik lewat bundle JS). Unsigned upload preset dibuat khusus
// supaya browser bisa upload langsung tanpa API Secret, dengan batasan
// (folder, tipe file, ukuran) yang sudah diatur dari dashboard Cloudinary.
// ============================================================

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface CloudinaryUploadResult {
  url: string; // secure_url — dipakai untuk ditampilkan/disimpan
  publicId: string;
}

export function cloudinaryTerkonfigurasi(): boolean {
  return Boolean(CLOUD_NAME && UPLOAD_PRESET);
}

/**
 * Upload satu file gambar ke Cloudinary lewat unsigned upload preset.
 * onProgress opsional (0-100) untuk progress bar upload.
 */
export function uploadGambarKeCloudinary(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    if (!cloudinaryTerkonfigurasi()) {
      reject(new Error('Cloudinary belum dikonfigurasi. Isi VITE_CLOUDINARY_CLOUD_NAME dan VITE_CLOUDINARY_UPLOAD_PRESET di file .env.'));
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      reject(new Error('Format file tidak didukung. Gunakan JPG, PNG, atau WEBP.'));
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      reject(new Error('Ukuran file maksimal 5 MB.'));
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET as string);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && res.secure_url) {
          resolve({ url: res.secure_url as string, publicId: res.public_id as string });
        } else {
          reject(new Error(res.error?.message || 'Upload ke Cloudinary gagal.'));
        }
      } catch {
        reject(new Error('Respons Cloudinary tidak valid.'));
      }
    };

    xhr.onerror = () => reject(new Error('Koneksi ke Cloudinary terputus. Periksa jaringan internet.'));
    xhr.send(formData);
  });
}
