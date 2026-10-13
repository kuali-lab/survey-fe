/**
 * Turns what a respondent types into the region picker's search box into the
 * text the /regions `q` search can match. Region names are stored spelled out
 * ("Daerah Khusus Ibukota Jakarta", "Kabupaten Tangerang", "Kota Administrasi
 * Jakarta Pusat"), while people type the short forms they know: "DKI",
 * "DIY", "NTT", "Kab. Tangerang", "Kota Adm. Jakarta Pusat", "Kec. Gambir".
 */

// Whole-query abbreviations → a word every matching region name contains.
const ALIASES: Record<string, string> = {
  dki: 'jakarta',
  'dki jakarta': 'jakarta',
  diy: 'yogyakarta',
  jogja: 'yogyakarta',
  jogjakarta: 'yogyakarta',
  ntb: 'nusa tenggara barat',
  ntt: 'nusa tenggara timur',
  babel: 'bangka belitung',
  kepri: 'kepulauan riau',
  sulsel: 'sulawesi selatan',
  sulut: 'sulawesi utara',
  sulteng: 'sulawesi tengah',
  sultra: 'sulawesi tenggara',
  sulbar: 'sulawesi barat',
  sumut: 'sumatera utara',
  sumbar: 'sumatera barat',
  sumsel: 'sumatera selatan',
  kalbar: 'kalimantan barat',
  kalteng: 'kalimantan tengah',
  kalsel: 'kalimantan selatan',
  kaltim: 'kalimantan timur',
  kaltara: 'kalimantan utara',
  jabar: 'jawa barat',
  jateng: 'jawa tengah',
  jatim: 'jawa timur',
}

// Level prefixes people type but that the name either spells out differently
// or that would only narrow nothing useful: drop them and search the rest.
const PREFIX = /^(prov(insi)?|propinsi|kab(upaten)?|kota(\s+adm(inistrasi)?)?|adm(inistrasi)?|kec(amatan)?|kel(urahan)?|desa)\b\.?\s*/i

export function normalizeRegionQuery(raw: string): string {
  let q = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!q) return ''
  q = q.replace(/\bd\.k\.i\.?/g, 'dki').replace(/\bd\.i\.y\.?/g, 'diy')
  if (ALIASES[q]) return ALIASES[q]
  // Strip repeated prefixes ("kota adm. jakarta pusat", "kab. adm. kep. seribu").
  let prev = ''
  while (prev !== q) {
    prev = q
    q = q.replace(PREFIX, '')
  }
  q = q.replace(/\bkep\.\s*/g, 'kepulauan ')
  if (ALIASES[q]) return ALIASES[q]
  // A bare prefix ("kab", "kota") has nothing left to search: keep the original
  // so the server still filters by it.
  return q.trim() || raw.trim()
}
