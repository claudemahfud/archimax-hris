// ============================================================
// Import Excel Karyawan → Karyawan + riwayat PenilaianKpi
// ============================================================
// Kenapa label-based, bukan cell tetap (mis. "ambil selalu dari D8"):
// dari sampel 100 file karyawan yang sudah dicek, tata letak antar file TIDAK 100% seragam
// (ada 2 sumber utama data per karyawan dalam satu sheet "Data Diri Karyawan": baris
// header+data di baris 1-2, DAN blok "Label : Nilai" ala kop surat mulai baris 7). Sheet
// "RAPORT-KPI" jauh lebih konsisten (kolom tetap), jadi itu dibaca positional.
//
// Prioritas sumber data per field:
// 1. Baris header+data (baris 1-2) → dianggap sumber utama untuk field yang tersedia di sana
//    (field finansial, tanggal lahir, NIK, dst — ini yang konsisten dengan Master File HRD).
// 2. Blok "Label : Nilai" → dipakai untuk field yang TIDAK ada di baris header+data
//    (Nama Lengkap, Jabatan, Divisi, dst).
// 3. Kalau field penting kosong di keduanya, atau nilainya beda signifikan antara sumber 1 & 2
//    (mis. NIK di baris atas ≠ NIK di blok cetak) → dicatat di `peringatan` supaya HRD cek manual
//    sebelum data disimpan, TIDAK ditebak sendiri oleh sistem.
// ============================================================

import * as XLSX from 'xlsx';
import { DAFTAR_BRAND } from '../constants/brand';
import type { Karyawan, HasilImportExcel, PenilaianKpiForm } from '../types';

type Grid = (string | number | Date | null)[][];

function normalisasiLabel(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[:.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatTanggal(v: unknown): string {
  if (v instanceof Date) {
    const dd = String(v.getDate()).padStart(2, '0');
    const mm = String(v.getMonth() + 1).padStart(2, '0');
    return `${dd}-${mm}-${v.getFullYear()}`;
  }
  if (v === null || v === undefined || v === '') return '';
  return String(v).trim();
}

function toAngka(v: unknown): number {
  if (typeof v === 'number') return v;
  if (v instanceof Date) return 0;
  const n = parseFloat(String(v ?? '0').replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function sheetKeGrid(ws: XLSX.WorkSheet): Grid {
  return XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
  }) as Grid;
}

/** Cari nilai dari baris header (berisi label kolom) + baris data tepat di bawahnya. */
function ambilDariHeaderRow(grid: Grid, aliases: string[]): string | number | null {
  if (grid.length < 2) return null;
  const headerRow = grid[0];
  for (let i = 0; i < headerRow.length; i++) {
    const label = normalisasiLabel(headerRow[i]);
    if (aliases.some((a) => label === normalisasiLabel(a))) {
      const nilai = grid[1]?.[i];
      return nilai === null || nilai === undefined ? null : (nilai as string | number);
    }
  }
  return null;
}

/** Cari nilai dari blok "Label : Nilai" (scan semua baris, cari sel ':' lalu ambil sel sesudahnya). */
function ambilDariBlokLabel(grid: Grid, aliases: string[]): string | null {
  const aliasNorm = aliases.map(normalisasiLabel);
  for (const row of grid) {
    const idxTitikDua = row.findIndex((c) => String(c ?? '').trim() === ':');
    if (idxTitikDua < 1) continue;
    const label = normalisasiLabel(row[idxTitikDua - 1]);
    if (!aliasNorm.some((a) => label === a || label.startsWith(a))) continue;
    for (let j = idxTitikDua + 1; j < row.length; j++) {
      const v = row[j];
      if (v !== null && v !== undefined && String(v).trim() !== '') {
        return formatTanggal(v);
      }
    }
    return null;
  }
  return null;
}

function ambilField(
  grid: Grid,
  headerAliases: string[],
  blokAliases: string[],
  peringatan: string[],
  namaField: string,
  wajib = false,
): string {
  const dariHeader = ambilDariHeaderRow(grid, headerAliases);
  const dariBlok = ambilDariBlokLabel(grid, blokAliases);
  const nilaiHeader = dariHeader !== null ? formatTanggal(dariHeader) : '';
  const nilaiBlok = dariBlok || '';

  if (nilaiHeader && nilaiBlok && nilaiHeader !== nilaiBlok) {
    peringatan.push(
      `"${namaField}" berbeda antara baris data (${nilaiHeader}) dan blok cetak (${nilaiBlok}) — dipakai nilai baris data, mohon cek manual.`,
    );
  }
  const hasil = nilaiHeader || nilaiBlok;
  if (!hasil && wajib) peringatan.push(`"${namaField}" tidak ditemukan di file, dikosongkan — mohon lengkapi manual.`);
  return hasil;
}

const HEADER_LEVEL_USER = ['Level User'];
const HEADER_BRAND = ['Brand'];

export async function parseKaryawanExcel(file: File): Promise<HasilImportExcel> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const peringatan: string[] = [];

  const sheetDiri = wb.Sheets['Data Diri Karyawan'];
  if (!sheetDiri) {
    throw new Error('Sheet "Data Diri Karyawan" tidak ditemukan di file ini. Pastikan nama sheet persis sama.');
  }
  const grid = sheetKeGrid(sheetDiri);

  const namaLengkap = ambilField(grid, ['Nama Lengkap'], ['Nama Lengkap', 'Nama'], peringatan, 'Nama Lengkap', true);
  const nip = ambilField(grid, ['NIP'], ['NIP'], peringatan, 'NIP', true);
  const levelUserRaw = (ambilDariHeaderRow(grid, HEADER_LEVEL_USER) as string) || 'Staff';
  const brandRaw = (ambilDariHeaderRow(grid, HEADER_BRAND) as string) || '';
  if (!brandRaw) peringatan.push('"Brand" tidak ditemukan di file, dikosongkan ke default Archimax — mohon cek manual.');

  const karyawan: Omit<Karyawan, 'id' | 'createdAt' | 'updatedAt'> = {
    nip,
    namaLengkap,
    namaPanggilan: ambilField(grid, ['Nama Panggilan'], ['Nama Panggilan'], peringatan, 'Nama Panggilan'),
    jabatan: ambilField(grid, ['Jabatan'], ['Jabatan'], peringatan, 'Jabatan', true),
    divisi: ambilField(grid, ['Divisi'], ['Divisi'], peringatan, 'Divisi', true),
    brand: (DAFTAR_BRAND as readonly string[]).includes(brandRaw) ? brandRaw : DAFTAR_BRAND[0],
    bergabungSejak: ambilField(grid, ['Bergabung Sejak'], ['Bergabung Sejak'], peringatan, 'Bergabung Sejak'),
    pengalamanKerja: ambilField(grid, ['Pengalaman Kerja'], ['Pengalaman Kerja'], peringatan, 'Pengalaman Kerja'),
    statusKaryawan: ambilField(grid, ['Status Karyawan'], ['Status Karyawan'], peringatan, 'Status Karyawan'),
    masaKontrak: ambilField(grid, ['Masa Kontrak'], ['Masa Kontrak'], peringatan, 'Masa Kontrak'),
    gajiPokok: toAngka(ambilDariHeaderRow(grid, ['Gaji Pokok'])),
    tunjanganKehadiran: toAngka(ambilDariHeaderRow(grid, ['Tunjangan Kehadiran'])),
    tunjanganKompetensi: toAngka(ambilDariHeaderRow(grid, ['Tunjangan Kompetensi'])),
    tunjanganJabatan: toAngka(ambilDariHeaderRow(grid, ['Tunjangan Jabatan'])),
    tunjanganTransportasi: toAngka(ambilDariHeaderRow(grid, ['Tunjangan Transportasi'])),
    performanceInsentive: toAngka(ambilDariHeaderRow(grid, ['Performance Insentive', 'Performance Insentife'])),
    estimasiTakeHomePay: toAngka(ambilDariHeaderRow(grid, ['Estimasi Take Home Pay'])),
    nik: ambilField(grid, ['NIK'], ['NIK'], peringatan, 'NIK'),
    tempatLahir: ambilField(grid, ['Tempat Lahir'], ['Tempat Lahir', 'Tempat/Tgl Lahir'], peringatan, 'Tempat Lahir'),
    tanggalLahir: ambilField(grid, ['Tanggal Lahir'], ['Tanggal Lahir', 'Tempat/Tgl Lahir'], peringatan, 'Tanggal Lahir'),
    jenisKelamin: ambilField(grid, ['Jenis Kelamin'], ['Jenis Kelamin'], peringatan, 'Jenis Kelamin'),
    alamatKtp: ambilField(grid, ['Alamat KTP'], ['Alamat KTP'], peringatan, 'Alamat KTP'),
    alamatDomisili: ambilField(grid, ['Alamat Domisili'], ['Alamat Domisili'], peringatan, 'Alamat Domisili'),
    agama: ambilField(grid, ['Agama'], ['Agama'], peringatan, 'Agama'),
    statusPerkawinan: ambilField(grid, ['Status Perkawinan'], ['Status Perkawinan'], peringatan, 'Status Perkawinan'),
    kewarganegaraan: ambilField(grid, ['Kewarganegaraan'], ['Kewarganegaraan'], peringatan, 'Kewarganegaraan'),
    noHp: ambilField(grid, ['No HP'], ['No Hp'], peringatan, 'No HP'),
    kontakDarurat: ambilField(grid, ['Kontak Darurat'], ['Kontak Darurat'], peringatan, 'Kontak Darurat'),
    email: ambilField(grid, ['Email'], ['Email'], peringatan, 'Email'),
    jumlahIstri: toAngka(ambilDariHeaderRow(grid, ['Jumlah Istri'])),
    jumlahAnak: toAngka(ambilDariHeaderRow(grid, ['Jumlah Anak'])),
    pendidikanTerakhir: ambilField(grid, ['Pendidikan Terakhir'], ['Pendidikan Terakhir'], peringatan, 'Pendidikan Terakhir'),
    levelUser: (levelUserRaw === 'HOD' ? 'HOD' : levelUserRaw === 'EKSEKUTIF' ? 'EKSEKUTIF' : 'Staff'),
    fotoUrl: '',
    kodeAksesRapor: '',
  };

  // ---- RAPORT-KPI: kolom sudah konsisten & sudah sama struktur dengan PenilaianKpiForm,
  // jadi dibaca positional per baris (baris 1 = header, baris 2 dst = riwayat mingguan).
  const riwayatKpi: PenilaianKpiForm[] = [];
  const sheetRaport = wb.Sheets['RAPORT-KPI'];
  if (sheetRaport) {
    const gridRaport = sheetKeGrid(sheetRaport);
    for (let r = 1; r < gridRaport.length; r++) {
      const row = gridRaport[r];
      if (!row || row.every((c) => c === null || c === '')) continue;
      const num = (i: number) => toAngka(row[i]);
      riwayatKpi.push({
        karyawanId: '', // diisi setelah karyawan tersimpan (butuh id dokumen Firestore)
        namaKaryawan: namaLengkap,
        divisi: karyawan.divisi,
        periodeMinggu: formatTanggal(row[1]),
        aspek1: num(3), aspek2: num(4), aspek3: num(5), aspek4: num(6),
        aspek5: num(7), aspek6: num(8), aspek7: num(9), aspek8: num(10),
        totalSkor: num(2),
        cuti: num(11), izin: num(12), sakitTanpaSurat: num(13), sakitDenganSurat: num(14),
        alpha: num(15), keterlambatan: num(16),
        sp1: num(17), sp2: num(18), sp3: num(19),
        tidakBersepatu: num(20), merokokKantor: num(21), tidakBerseragam: num(22),
        minumMiras: num(23), makananBerat: num(24), customPoin: num(25),
        keteranganCustom: String(row[26] ?? ''),
        skorKedisiplinan: num(27),
        kelebihan: String(row[28] ?? ''), kekurangan: String(row[29] ?? ''),
        rekomendasi: String(row[30] ?? ''), potensiKarier: String(row[31] ?? ''),
        statusRekomendasi: String(row[32] ?? ''), kenaikanSalary: String(row[33] ?? ''),
        training: String(row[34] ?? ''), evaluasiBerikutnya: String(row[35] ?? ''),
      });
    }
  } else {
    peringatan.push('Sheet "RAPORT-KPI" tidak ditemukan — karyawan diimpor tanpa riwayat KPI (bisa dinilai baru dari sistem).');
  }

  if (!karyawan.divisi) peringatan.push('Divisi kosong — karyawan ini tidak akan muncul di monitoring HOD divisi manapun sampai diisi manual.');

  return { karyawan, riwayatKpi, peringatan };
}
