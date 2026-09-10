// Util format tampilan tanggal — dipakai untuk menampilkan nilai dari <input type="date">
// (yang selalu tersimpan sebagai ISO "yyyy-mm-dd") dalam format Day/Month/Year ("dd/mm/yyyy").
export function formatTanggalTampilan(nilaiIso: string | undefined | null): string {
  if (!nilaiIso) return '-';
  const cocok = /^(\d{4})-(\d{2})-(\d{2})/.exec(nilaiIso);
  if (!cocok) return nilaiIso; // bukan format ISO (mis. sudah teks bebas) — tampilkan apa adanya
  const [, tahun, bulan, hari] = cocok;
  return `${hari}/${bulan}/${tahun}`;
}
