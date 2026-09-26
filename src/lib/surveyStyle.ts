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
 * 2. **Latar kustom tidak boleh membuat isian tak terbaca.** Slot `background`
 *    dipetakan ke `--page-bg` (khusus latar halaman), BUKAN ke `--canvas` yang
 *    dipakai kartu dan kotak isian. Dengan begitu latar gelap atau foto ramai
 *    tetap menyisakan kartu berpermukaan platform yang teksnya pasti terbaca.
 */

/** Dokumen gaya, cermin surveyStyleDoc di internal/service/survey_style.go. */
export type SurveyStyle = {
	colors?: {
		question?: string
		answer?: string
		button?: string
		buttonText?: string
		background?: string
	}
	background?: {
		imageUrl?: string
		layout?: 'cover' | 'contain' | 'repeat'
		brightness?: number
	}
	borderRadius?: 'none' | 'small' | 'large'
}

/** #rgb atau #rrggbb, sama persis dengan surveyStyleColorPattern di BE. */
const HEX_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/**
 * Bentuk URL media platform yang boleh dimuat sebagai gambar latar. Sengaja
 * dipatok ke pola, bukan sekadar "bukan javascript:", supaya tanda kutip,
 * tanda kurung, dan baris baru — bahan untuk keluar dari `url("...")` — tidak
 * punya jalan masuk.
 */
const MEDIA_PATH_PATTERN = /^\/api\/v1\/media\/[A-Za-z0-9_-]+\/file$/

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

function isHex(value: unknown): value is string {
	return typeof value === 'string' && HEX_PATTERN.test(value)
}

/**
 * Menggelapkan (amount < 0) atau mencerahkan (amount > 0) warna heks, hasilnya
 * selalu #rrggbb. Mengembalikan null kalau masukannya bukan heks, supaya
 * pemanggil tidak pernah menyisipkan nilai tak dikenal ke CSS.
 */
export function shadeHex(hex: string, amount: number): string | null {
	if (!isHex(hex)) return null
	const full =
		hex.length === 4
			? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
			: hex.toLowerCase()

	const channels = [1, 3, 5].map((index) => parseInt(full.slice(index, index + 2), 16))
	const shaded = channels.map((channel) => {
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
	if (background?.imageUrl && MEDIA_PATH_PATTERN.test(background.imageUrl)) {
		vars['--page-bg-image'] = `url("${background.imageUrl}")`

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
