/**
 * Gaya kustom per survei (Kustom Styling Survei).
 *
 * Dokumen `settings.style` datang dari BE (kolom `surveys.style`, sudah
 * divalidasi ketat di sisi tulis) dan diubah di sini menjadi custom property CSS
 * yang dipasang pada elemen akar permukaan responden. Karena seluruh komponen
 * survey-fe sudah membaca token `app.css` (`--text-primary`, `--ink`, dst),
 * menimpa token di akar cukup untuk mengubah hampir semua permukaan sekaligus —
 * tidak perlu satu prop warna per komponen.
 *
 * Dua hal yang dijaga modul ini:
 *
 * 1. **Lapis kedua terhadap injeksi CSS.** Nilai di sini berakhir di atribut
 *    `style`, jadi nilai seperti `#fff;} body{display:none` akan keluar dari
 *    deklarasinya. BE sudah menolaknya; modul ini menolaknya lagi di tempat
 *    nilainya benar-benar dipasang, karena itulah satu-satunya titik yang tahu
 *    nilai itu akan jadi CSS.
 *
 * 2. **Slot `background` dan `card` adalah dua permukaan berbeda.** `background`
 *    dipetakan ke `--page-bg` (latar halaman), `card` ke `--canvas` (permukaan
 *    kartu). Kotak isian ikut `--canvas`, jadi mewarnai kartu ikut mewarnai
 *    isian — itu disengaja, keduanya permukaan yang sama bagi responden.
 *
 *    🔴 Latar gelap TIDAK lagi otomatis aman: sejak halaman sambutan dan penutup
 *    kartunya dibuat transparan, teks di sana berdiri langsung di atas latar
 *    halaman. Yang mencegah kombinasi tak terbaca adalah peringatan kontras di
 *    dashboard, bukan kartu putih.
 */

import { resolveMediaUrl } from './mediaUrl'

/** Tujuh permukaan kartu; gerbang lokasi dan selfie berbagi kuncinya dengan varian "ditolak". */
export const CARD_SURFACES = ['welcome', 'closing', 'location', 'selfie', 'invite', 'error', 'closed'] as const
export type CardSurface = (typeof CARD_SURFACES)[number]

/** Keadaan sebelum `cards` ada: dipakai selama pemilik survei belum memilih apa pun untuk permukaan itu. */
export const LEGACY_CARD_DEFAULT: Record<CardSurface, boolean> = {
	welcome: false,
	closing: false,
	location: true,
	selfie: true,
	invite: true,
	error: true,
	closed: true
}

/** Dokumen gaya, cermin surveyStyleDoc di internal/service/survey_style.go. */
export type SurveyStyle = {
	colors?: {
		question?: string
		answer?: string
		button?: string
		buttonText?: string
		background?: string
		card?: string
	}
	background?: {
		imageUrl?: string
		layout?: 'cover' | 'contain' | 'repeat'
		brightness?: number
	}
	borderRadius?: 'none' | 'small' | 'large'
	cards?: {
		enabled?: boolean
		opacity?: number
		matchPageBackground?: boolean
		surfaces?: Partial<Record<CardSurface, boolean>>
	} | null
}

/** #rgb atau #rrggbb, sama persis dengan surveyStyleColorPattern di BE. */
const HEX_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/**
 * Bentuk relatif URL media, yaitu yang dikirim backend saat CDN tidak
 * dikonfigurasi: /api/v1/media/<id>/file.
 */
const MEDIA_PATH_PATTERN = /^\/api\/v1\/media\/[A-Za-z0-9_-]+\/file$/

/**
 * Bentuk absolut, yaitu yang dikirim backend saat MEDIA_CDN_URL aktif. Asalnya
 * TIDAK diperiksa di sini — itu tugas ValidateSurveyStyle di BE, satu-satunya
 * pihak yang tahu asal mana yang dikonfigurasi. Yang diperiksa di sini adalah
 * hal yang hanya penting di titik ini: bahwa nilainya tidak bisa keluar dari
 * `url("...")`.
 */
const MEDIA_ABSOLUTE_PATTERN = /^https?:\/\/[^\s"'();\\]+$/

/**
 * Apakah URL ini boleh dipasang sebagai gambar latar. Menerima kedua bentuk yang
 * benar-benar dikirim backend — relatif (tanpa CDN) dan absolut (dengan CDN).
 *
 * 🔴 Hanya menerima bentuk relatif akan membuat latar DIAM-DIAM tidak tampil di
 * setiap lingkungan yang memakai CDN: tidak ada galat, gambarnya sekadar absen,
 * dan halaman jatuh ke warna latar. Itu kelas bug yang sama seperti favicon
 * branding yang rusak saat CDN mati (lihat $lib/mediaUrl.ts).
 */
function isPlatformMediaUrl(url: string): boolean {
	return MEDIA_PATH_PATTERN.test(url) || MEDIA_ABSOLUTE_PATTERN.test(url)
}

/**
 * Jarak tepi kartu saat gaya kustom aktif. Komponen memakainya lewat
 * `--card-padding` dan `--state-card-padding-<permukaan>`, jadi nilai ini satu-satunya
 * tempat angkanya hidup di sisi responden.
 */
const CARD_PADDING = '24px'

/** Jumlah gelap yang dipakai untuk keadaan hover/tekan tombol. */
const PRESSED_SHADE = -0.15

/**
 * Peta radius. Nilainya dipilih dari token `app.css` yang sudah ada supaya tiga
 * pilihan ini tetap terasa bagian dari design system, bukan angka acak:
 * `small` mendekati bawaan platform, `large` memakai --radius-2xl, `none`
 * mematikan seluruh pembulatan termasuk pada tombol.
 */
const RADIUS_PRESETS: Record<NonNullable<SurveyStyle['borderRadius']>, Record<string, string>> = {
	none: {
		'--radius-card': '0px',
		'--radius-input': '0px',
		'--radius-option': '0px',
		'--radius-md': '0px',
		'--radius-lg': '0px',
		'--radius-pill': '0px'
	},
	small: {
		'--radius-card': '8px',
		'--radius-input': '6px',
		'--radius-option': '8px',
		'--radius-md': '6px',
		'--radius-lg': '8px',
		'--radius-pill': '8px'
	},
	large: {
		'--radius-card': '24px',
		'--radius-input': '12px',
		'--radius-option': '16px',
		'--radius-md': '12px',
		'--radius-lg': '16px',
		'--radius-pill': '999px'
	}
}

/**
 * Arah tint sub-permukaan kartu: kartu terang digelapkan (seperti platform),
 * kartu gelap justru DICERAHKAN. Menggelapkan kartu yang sudah gelap membuat
 * sub-bloknya melebur jadi satu bidang hitam tanpa batas yang terlihat.
 */
function cardTintDirection(card: string): number {
	const channels = hexChannels(card)
	const perceived = (channels[0] * 299 + channels[1] * 587 + channels[2] * 114) / 1000
	return perceived < 128 ? 1 : -1
}

function isHex(value: unknown): value is string {
	return typeof value === 'string' && HEX_PATTERN.test(value)
}

/** Kanal [r, g, b] dari heks yang sudah lolos isHex, bentuk pendek dimuaikan. */
function hexChannels(hex: string): number[] {
	const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex
	return [1, 3, 5].map((index) => parseInt(full.slice(index, index + 2), 16))
}

/**
 * Warna kartu dengan opasitas, disusun dari bilangan hasil parse heks dan alfa
 * yang dijepit 0..1 — tidak ada string dari dokumen yang masuk ke CSS. Opasitas
 * yang bukan bilangan dianggap 1.
 */
export function cardBackground(hex: string, opacity: number): string | null {
	if (!isHex(hex)) return null
	const alpha = typeof opacity === 'number' && Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 1
	const [red, green, blue] = hexChannels(hex)
	return `rgba(${red},${green},${blue},${alpha})`
}

/**
 * Menggelapkan (amount < 0) atau mencerahkan (amount > 0) warna heks, hasilnya
 * selalu #rrggbb. Mengembalikan null kalau masukannya bukan heks, supaya
 * pemanggil tidak pernah menyisipkan nilai tak dikenal ke CSS.
 */
export function shadeHex(hex: string, amount: number): string | null {
	if (!isHex(hex)) return null
	const shaded = hexChannels(hex).map((channel) => {
		const target = amount < 0 ? 0 : 255
		const moved = Math.round(channel + (target - channel) * Math.abs(amount))
		return Math.min(255, Math.max(0, moved))
	})
	return `#${shaded.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Menerjemahkan dokumen gaya ke peta custom property CSS. Slot yang tidak diatur
 * TIDAK menghasilkan entri, sehingga token platform tetap berlaku — itulah cara
 * "reset per-slot" bekerja tanpa mekanisme tersendiri.
 */
/**
 * Apakah ada permukaan kustom di belakang kartu halaman keadaan?
 *
 * 🔴 GAMBAR latar ikut dihitung, bukan hanya warna. Versi pertama hanya
 * memeriksa `colors.card`/`colors.background`, jadi survei yang memasang FOTO
 * latar tanpa warna apa pun mendapat radius tanpa padding — teks menempel ke
 * tepi kartu, di atas latar yang justru paling terlihat. Itu persis mode gagal
 * yang T5 lahir untuk menutup, dan kemungkinan besar bentuk kustomisasi yang
 * paling umum.
 */
function hasCustomSurface(style: SurveyStyle): boolean {
	const colors = style.colors ?? {}
	if (isHex(colors.card) || isHex(colors.background)) return true
	const image = style.background?.imageUrl
	return Boolean(image && isPlatformMediaUrl(image))
}

/**
 * Variabel kartu per permukaan dari `style.cards`. Dokumen tanpa satu pun field
 * `cards` yang sah menghasilkan objek kosong, jadi survei lama tidak menerima
 * variabel baru dan komponen jatuh ke cadangan lamanya.
 *
 * Warna kartu putih (#ffffff = --canvas platform) bila slot yang dipilih kosong,
 * karena rgba butuh saluran warna pasti untuk menerapkan opasitas.
 */
function cardSurfaceVars(style: SurveyStyle): Record<string, string> {
	const cards = style.cards
	if (!cards || typeof cards !== 'object') return {}

	const enabled = typeof cards.enabled === 'boolean' ? cards.enabled : undefined
	const matchPage = typeof cards.matchPageBackground === 'boolean' ? cards.matchPageBackground : undefined
	const opacity = typeof cards.opacity === 'number' && Number.isFinite(cards.opacity) ? cards.opacity : undefined
	const surfaces = cards.surfaces && typeof cards.surfaces === 'object' ? cards.surfaces : {}
	const anySurface = CARD_SURFACES.some((surface) => typeof surfaces[surface] === 'boolean')
	if (enabled === undefined && matchPage === undefined && opacity === undefined && !anySurface) return {}

	const colors = style.colors ?? {}
	const source = matchPage ? colors.background : colors.card
	const fill = cardBackground(isHex(source) ? source : '#ffffff', opacity ?? 1) ?? 'transparent'

	const vars: Record<string, string> = {}
	for (const surface of CARD_SURFACES) {
		const own = surfaces[surface]
		const visible = (typeof own === 'boolean' ? own : enabled) ?? LEGACY_CARD_DEFAULT[surface]
		vars[`--state-card-bg-${surface}`] = visible ? fill : 'transparent'
		vars[`--state-card-padding-${surface}`] = visible ? CARD_PADDING : '0px'
	}
	return vars
}

export function surveyStyleVars(style: SurveyStyle | null | undefined): Record<string, string> {
	const vars: Record<string, string> = {}
	if (!style) return vars

	const colors = style.colors ?? {}

	// Judul pertanyaan dan seluruh heading membaca --text-primary.
	if (isHex(colors.question)) vars['--text-primary'] = colors.question

	// Label pilihan, deskripsi, dan teks bantu membaca --text-body.
	if (isHex(colors.answer)) vars['--text-body'] = colors.answer

	// Tombol utama membaca --ink/--primary; keadaan hover membaca --ink-elevated
	// dan --primary-60. Keduanya DITURUNKAN dari warna pilihan pemilik survei,
	// karena kalau tidak, tombol birunya berubah kuning platform saat disentuh.
	if (isHex(colors.button)) {
		const pressed = shadeHex(colors.button, PRESSED_SHADE)
		vars['--primary'] = colors.button
		vars['--ink'] = colors.button
		if (pressed) {
			vars['--primary-60'] = pressed
			vars['--primary-70'] = pressed
			vars['--ink-elevated'] = pressed
		}
	}

	// Teks dan ikon di ATAS permukaan utama. Tiga nama untuk satu hal adalah
	// warisan app.css (alias back-compat); ketiganya disetel supaya tidak ada
	// komponen yang tertinggal memakai nama lama.
	if (isHex(colors.buttonText)) {
		vars['--on-ink'] = colors.buttonText
		vars['--primary-on'] = colors.buttonText
		vars['--text-on-ink'] = colors.buttonText
	}

	// Latar HALAMAN saja — lihat catatan di kepala berkas soal --canvas.
	if (isHex(colors.background)) vars['--page-bg'] = colors.background

	// Permukaan KARTU. Lima halaman keadaan memakainya: gerbang lokasi, gerbang
	// selfie, gerbang undangan, galat, dan tutup. Sambutan dan penutup tanpa kartu
	// (T1) kecuali `style.cards` menyalakannya per permukaan.
	//
	// --canvas-soft dan --canvas-softer DITURUNKAN dari warna kartu, bukan
	// dibiarkan abu platform: keduanya adalah blok di DALAM kartu (baris petunjuk
	// gerbang, sub-blok QuestionCard), dan abu terang di dalam kartu gelap
	// terbaca sebagai tambalan yang salah tempel. Selisih 3% dan 8% menyalin
	// hubungan yang sudah ada di app.css antara --canvas, --canvas-soft, dan
	// --canvas-softer.
	if (isHex(colors.card)) {
		vars['--canvas'] = colors.card
		const soft = shadeHex(colors.card, cardTintDirection(colors.card) * 0.03)
		const softer = shadeHex(colors.card, cardTintDirection(colors.card) * 0.08)
		if (soft) vars['--canvas-soft'] = soft
		if (softer) vars['--canvas-softer'] = softer
	}

	// Padding kartu dinyalakan hanya kalau ada permukaan kustom di belakangnya.
	// Tanpa itu kartu halaman keadaan putih di atas halaman putih — jaraknya tidak
	// membungkus apa pun, cuma menyempitkan tombol di survei yang sudah terbit.
	//
	// Syarat yang sama mematikan latar bilah kemajuan dan bilah navigasi: keduanya
	// duduk di atas HALAMAN, tapi mengecat diri dengan --canvas yang dipetakan
	// dari slot KARTU. Survei yang cuma mengunggah foto latar karena itu mendapat
	// dua balok putih melintang di atas fotonya. Komponennya memakai cadangan
	// `var(--chrome-surface, var(--canvas))`, jadi survei tanpa gaya kustom tetap
	// punya latar lengket seperti sebelumnya.
	if (hasCustomSurface(style)) {
		vars['--card-padding'] = CARD_PADDING
		vars['--chrome-surface'] = 'transparent'
	}

	Object.assign(vars, cardSurfaceVars(style))

	const radius = style.borderRadius
	if (radius && radius in RADIUS_PRESETS) Object.assign(vars, RADIUS_PRESETS[radius])

	return vars
}

/**
 * Menyusun isi atribut `style` untuk elemen akar: custom property warna/radius
 * plus lapisan gambar latar. Selalu berakhir dengan ';' atau string kosong.
 */
export function surveyStyleAttr(style: SurveyStyle | null | undefined): string {
	const vars = surveyStyleVars(style)

	const background = style?.background
	// Gambar latar hanya dipasang kalau URL-nya berbentuk media platform. Tanpa
	// gambar, seluruh field latar lain tidak punya arti dan diabaikan — overlay
	// kecerahan tanpa gambar hanya akan menutupi warna latar yang baru dipilih.
	if (background?.imageUrl && isPlatformMediaUrl(background.imageUrl)) {
		// Bentuk relatif diselesaikan terhadap origin API, bukan origin halaman:
		// tanpa ini `/api/v1/media/...` menunjuk ke host survey-fe yang tidak
		// punya berkasnya. Alasan lengkapnya di $lib/mediaUrl.ts.
		vars['--page-bg-image'] = `url("${resolveMediaUrl(background.imageUrl)}")`

		const layout = background.layout ?? 'cover'
		if (layout === 'repeat') {
			vars['--page-bg-size'] = 'auto'
			vars['--page-bg-repeat'] = 'repeat'
		} else {
			// cover dan contain sama-sama tampil sekali dan berpusat: itulah yang
			// membuat satu gambar unggahan tetap masuk akal di layar lebar maupun
			// ponsel sempit, tanpa pengaturan terpisah per peranti.
			vars['--page-bg-size'] = layout
			vars['--page-bg-repeat'] = 'no-repeat'
		}

		const brightness = background.brightness
		if (typeof brightness === 'number' && brightness !== 0 && brightness >= -1 && brightness <= 1) {
			const channel = brightness < 0 ? '0,0,0' : '255,255,255'
			vars['--page-bg-overlay'] = `rgba(${channel},${Math.abs(brightness)})`
		}
	}

	const declarations = Object.entries(vars).map(([name, value]) => `${name}:${value}`)
	return declarations.length ? `${declarations.join(';')};` : ''
}
