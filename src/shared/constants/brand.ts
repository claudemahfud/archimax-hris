// Sumber tunggal daftar Brand karyawan — ditampilkan di kolom "Brand" pada Daftar Karyawan
// (menggantikan kolom Level User di tampilan list).
export const DAFTAR_BRAND = ['Archimax', 'Maxpro', 'Maxcon'] as const;

export type NamaBrand = (typeof DAFTAR_BRAND)[number];
