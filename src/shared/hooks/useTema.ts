import { useCallback, useEffect, useState } from 'react';

// Mode tampilan Gelap/Cerah untuk seluruh portal. Dipakai oleh AppShell (dipakai
// semua halaman portal) sehingga ditaruh di shared/ sesuai Rule of Two.

const KEY_TEMA = 'hris_tema';
export type Tema = 'terang' | 'gelap';

function bacaTemaTersimpan(): Tema {
  try {
    return window.localStorage.getItem(KEY_TEMA) === 'gelap' ? 'gelap' : 'terang';
  } catch {
    return 'terang';
  }
}

export function useTema() {
  const [tema, setTema] = useState<Tema>(bacaTemaTersimpan);

  useEffect(() => {
    document.documentElement.setAttribute('data-tema', tema);
    try {
      window.localStorage.setItem(KEY_TEMA, tema);
    } catch {
      // Abaikan kalau localStorage tidak tersedia (mis. mode privat ketat).
    }
  }, [tema]);

  const toggleTema = useCallback(() => {
    setTema((t) => (t === 'gelap' ? 'terang' : 'gelap'));
  }, []);

  return { tema, toggleTema };
}
