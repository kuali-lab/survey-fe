import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { shadeHex, surveyStyleVars, surveyStyleAttr, type SurveyStyle } from './surveyStyle'

// Gaya kustom survei: dokumen `settings.style` dari BE diubah menjadi custom
// property CSS yang dipasang di elemen akar permukaan responden.
//
// Yang diuji di sini bukan "apakah warnanya bagus", tapi tiga hal yang bisa
// gagal diam-diam:
//   1. dokumen sebagian / kosong / rusak tidak boleh melumpuhkan halaman,
//   2. nilai yang bukan warna heks TIDAK BOLEH sampai ke atribut style
//      (injeksi CSS — BE sudah menolaknya, ini lapis kedua di tempat nilainya
//      benar-benar dipasang),
//   3. warna tekan/hover diturunkan dari warna tombol, bukan tertinggal kuning
//      platform.

describe('shadeHex', () => {
	it('menggelapkan dan mencerahkan dengan bentuk #rrggbb', () => {
		expect(shadeHex('#808080', -0.5)).toBe('#404040')
		expect(shadeHex('#808080', 0.5)).toBe('#c0c0c0')
	})

	it('memuai bentuk pendek #rgb', () => {
		expect(shadeHex('#fff', 0)).toBe('#ffffff')
		expect(shadeHex('#f00', -1)).toBe('#000000')
	})

	it('tidak keluar dari rentang 0-255', () => {
		expect(shadeHex('#000000', -1)).toBe('#000000')
		expect(shadeHex('#ffffff', 1)).toBe('#ffffff')
	})

	it('mengembalikan null untuk nilai yang bukan heks', () => {
		expect(shadeHex('red', -0.2)).toBeNull()
		expect(shadeHex('#12345', -0.2)).toBeNull()
		expect(shadeHex('var(--primary)', -0.2)).toBeNull()
	})
})

describe('surveyStyleVars', () => {
	it('mengembalikan objek kosong saat gaya tidak diatur', () => {
		expect(surveyStyleVars(null)).toEqual({})
		expect(surveyStyleVars(undefined)).toEqual({})
		expect(surveyStyleVars({})).toEqual({})
	})

	it('memetakan slot question ke token teks judul', () => {
		const vars = surveyStyleVars({ colors: { question: '#111827' } })
		expect(vars['--text-primary']).toBe('#111827')
		// Slot lain tidak ikut disetel: token yang tidak diatur harus tetap
		// jatuh ke bawaan platform, bukan ke warna slot yang kebetulan ada.
		expect(vars['--text-body']).toBeUndefined()
		expect(vars['--ink']).toBeUndefined()
	})

	it('memetakan slot answer ke token teks isi', () => {
		const vars = surveyStyleVars({ colors: { answer: '#374151' } })
		expect(vars['--text-body']).toBe('#374151')
	})

	it('memetakan slot button ke seluruh token permukaan utama plus warna tekannya', () => {
		const vars = surveyStyleVars({ colors: { button: '#2563eb' } })
		expect(vars['--primary']).toBe('#2563eb')
		expect(vars['--ink']).toBe('#2563eb')
		// Hover/tekan diturunkan lebih gelap dari warna pilihan pemilik survei.
		// Kalau ini tertinggal, tombol biru berubah kuning platform saat disentuh.
		expect(vars['--ink-elevated']).toBe(shadeHex('#2563eb', -0.15))
		expect(vars['--primary-60']).toBe(shadeHex('#2563eb', -0.15))
	})

	it('memetakan slot buttonText ke token teks di atas permukaan utama', () => {
		const vars = surveyStyleVars({ colors: { buttonText: '#ffffff' } })
		expect(vars['--on-ink']).toBe('#ffffff')
		expect(vars['--primary-on']).toBe('#ffffff')
		expect(vars['--text-on-ink']).toBe('#ffffff')
	})

	it('memetakan slot card ke --canvas dan menurunkan sub-permukaannya', () => {
		// Lima halaman keadaan memakai --canvas sebagai permukaan kartunya — T1
		// mengeluarkan sambutan dan penutup dari cakupan ini — jadi satu
		// penimpaan mewarnai kelimanya. --canvas-soft/-softer diturunkan supaya
		// blok DI DALAM kartu tidak tertinggal abu platform.
		const terang = surveyStyleVars({ colors: { card: '#ffffff' } })
		expect(terang['--canvas']).toBe('#ffffff')
		expect(terang['--canvas-soft']).toBe(shadeHex('#ffffff', -0.03))
		expect(terang['--canvas-softer']).toBe(shadeHex('#ffffff', -0.08))

		// Kartu GELAP dicerahkan, bukan digelapkan: menggelapkan yang sudah gelap
		// melebur sub-bloknya jadi satu bidang tanpa batas yang terlihat.
		const gelap = surveyStyleVars({ colors: { card: '#111827' } })
		expect(gelap['--canvas-soft']).toBe(shadeHex('#111827', 0.03))
		expect(gelap['--canvas-softer']).toBe(shadeHex('#111827', 0.08))
	})

	it('padding kartu menyala hanya saat salah satu permukaan diwarnai', () => {
		// 🔴 Tanpa gaya kustom, kartu tujuh halaman keadaan putih di atas halaman
		// putih. Padding di sana tidak membungkus apa pun — ia cuma menyempitkan
		// tombol di ribuan survei yang sudah terbit.
		expect(surveyStyleVars(null)['--card-padding']).toBeUndefined()
		expect(surveyStyleVars({ borderRadius: 'large' })['--card-padding']).toBeUndefined()
		expect(surveyStyleVars({ colors: { button: '#2563eb' } })['--card-padding']).toBeUndefined()

		expect(surveyStyleVars({ colors: { card: '#111827' } })['--card-padding']).toBe('24px')
		expect(surveyStyleVars({ colors: { background: '#0b1220' } })['--card-padding']).toBe('24px')

		// 🔴 GAMBAR latar tanpa warna apa pun juga permukaan kustom, dan justru
		// yang paling terlihat: kartu tanpa padding di atas foto membuat teks
		// menempel ke tepinya.
		expect(
			surveyStyleVars({ background: { imageUrl: '/api/v1/media/abc/file' } })['--card-padding'],
		).toBe('24px')

		// URL yang bukan media platform tidak pernah dipasang sebagai latar, jadi
		// ia juga tidak boleh menyalakan paddingnya.
		expect(surveyStyleVars({ background: { imageUrl: 'javascript:alert(1)' } })['--card-padding']).toBeUndefined()
	})

	it('slot card TIDAK menyentuh latar halaman, dan sebaliknya', () => {
		// Keduanya permukaan berbeda: latar halaman ada di belakang kartu.
		const kartuSaja = surveyStyleVars({ colors: { card: '#111827' } })
		expect(kartuSaja['--page-bg']).toBeUndefined()

		const latarSaja = surveyStyleVars({ colors: { background: '#0b1220' } })
		expect(latarSaja['--canvas']).toBeUndefined()
		expect(latarSaja['--canvas-soft']).toBeUndefined()
	})

	it('memetakan slot background ke --page-bg, BUKAN ke --canvas', () => {
		// --canvas dipakai kartu dan kotak isian. Kalau latar kustom menimpanya,
		// latar gelap pilihan pemilik survei membuat teks di dalam kotak isian
		// tidak terbaca, dan itu terjadi tanpa galat apa pun.
		// --canvas hanya berubah lewat slot `card` yang eksplisit, tidak pernah
		// sebagai efek samping slot latar.
		const vars = surveyStyleVars({ colors: { background: '#0f172a' } })
		expect(vars['--page-bg']).toBe('#0f172a')
		expect(vars['--canvas']).toBeUndefined()
		expect(vars['--canvas-soft']).toBeUndefined()
	})

	it('menerjemahkan borderRadius ke seluruh token radius', () => {
		const none = surveyStyleVars({ borderRadius: 'none' })
		expect(none['--radius-card']).toBe('0px')
		expect(none['--radius-pill']).toBe('0px')

		const large = surveyStyleVars({ borderRadius: 'large' })
		expect(large['--radius-card']).toBe('24px')
		expect(large['--radius-pill']).toBe('999px')

		// Radius tidak diatur = token platform utuh.
		expect(surveyStyleVars({ colors: { button: '#2563eb' } })['--radius-card']).toBeUndefined()
	})

	it('membuang nilai yang bukan warna heks', () => {
		const vars = surveyStyleVars({
			colors: {
				question: 'red',
				answer: '#fff;} body{display:none',
				button: 'var(--primary)',
				buttonText: '',
				background: '#abc'
			} as SurveyStyle['colors']
		})
		expect(vars['--text-primary']).toBeUndefined()
		expect(vars['--text-body']).toBeUndefined()
		expect(vars['--ink']).toBeUndefined()
		expect(vars['--on-ink']).toBeUndefined()
		// Yang sah tetap lolos: satu nilai buruk tidak membatalkan sisanya.
		expect(vars['--page-bg']).toBe('#abc')
	})

	it('membuang borderRadius yang tidak dikenal', () => {
		expect(surveyStyleVars({ borderRadius: 'medium' as SurveyStyle['borderRadius'] })).toEqual({})
	})
})

describe('surveyStyleAttr', () => {
	it('mengembalikan string kosong saat tidak ada gaya', () => {
		expect(surveyStyleAttr(null)).toBe('')
		expect(surveyStyleAttr({})).toBe('')
	})

	it('menyusun deklarasi custom property', () => {
		const attr = surveyStyleAttr({ colors: { question: '#111827' } })
		expect(attr).toContain('--text-primary:#111827')
		expect(attr.endsWith(';')).toBe(true)
	})

	it('menyusun lapisan gambar latar di atas warna latar', () => {
		const attr = surveyStyleAttr({
			colors: { background: '#0f172a' },
			background: { imageUrl: '/api/v1/media/abc/file', layout: 'cover' }
		})
		// Jalur relatif diselesaikan terhadap origin API (lihat $lib/mediaUrl.ts),
		// jadi yang dikunci adalah jalurnya — bukan origin yang berbeda per lingkungan.
		expect(attr).toContain('/api/v1/media/abc/file")')
		expect(attr).toContain('--page-bg-image:url("')
		// cover = mengisi layar di desktop maupun ponsel, tanpa mengulang.
		expect(attr).toContain('--page-bg-size:cover')
		expect(attr).toContain('--page-bg-repeat:no-repeat')
	})

	it('memetakan layout contain dan repeat', () => {
		const contain = surveyStyleAttr({ background: { imageUrl: '/api/v1/media/a/file', layout: 'contain' } })
		expect(contain).toContain('--page-bg-size:contain')
		expect(contain).toContain('--page-bg-repeat:no-repeat')

		const repeat = surveyStyleAttr({ background: { imageUrl: '/api/v1/media/a/file', layout: 'repeat' } })
		expect(repeat).toContain('--page-bg-size:auto')
		expect(repeat).toContain('--page-bg-repeat:repeat')
	})

	it('menerjemahkan brightness ke lapisan overlay', () => {
		const darker = surveyStyleAttr({ background: { imageUrl: '/api/v1/media/a/file', brightness: -0.4 } })
		expect(darker).toContain('--page-bg-overlay:rgba(0,0,0,0.4)')

		const lighter = surveyStyleAttr({ background: { imageUrl: '/api/v1/media/a/file', brightness: 0.4 } })
		expect(lighter).toContain('--page-bg-overlay:rgba(255,255,255,0.4)')

		// brightness 0 tidak menambah lapisan sama sekali.
		expect(surveyStyleAttr({ background: { imageUrl: '/api/v1/media/a/file', brightness: 0 } }))
			.not.toContain('--page-bg-overlay')
	})

	// Tabel emas: nilai yang sama persis dipakai pratinjau dashboard-fe. Salah satu
	// sisi berubah tanpa yang lain berarti pratinjau berbohong soal latar terbit.
	it.each([
		[-0.4, 'rgba(0,0,0,0.4)'],
		[0.25, 'rgba(255,255,255,0.25)'],
		[0, null],
		[1.5, null]
	])('brightness %s -> overlay %s', (brightness, overlay) => {
		const attr = surveyStyleAttr({ background: { imageUrl: '/api/v1/media/a/file', brightness } })
		if (overlay === null) expect(attr).not.toContain('--page-bg-overlay')
		else expect(attr).toContain(`--page-bg-overlay:${overlay};`)
	})

	it('menerima URL absolut saat CDN media aktif', () => {
		// Backend mengirim bentuk absolut begitu MEDIA_CDN_URL diset. Kalau modul ini
		// hanya menerima bentuk relatif, latar DIAM-DIAM tidak tampil di seluruh
		// lingkungan ber-CDN: nol galat, gambarnya sekadar absen.
		const attr = surveyStyleAttr({ background: { imageUrl: 'https://cdn.contoh.id/media/abc.jpg' } })
		expect(attr).toContain('--page-bg-image:url("https://cdn.contoh.id/media/abc.jpg")')
	})

	it('menolak URL gambar yang bisa keluar dari deklarasi CSS', () => {
		// Ini lapis kedua: BE sudah membatasi imageUrl ke media platform. Yang
		// dijaga di sini adalah BENTUKNYA, karena nilainya masuk ke atribut style.
		//
		// 🔴 Yang sengaja TIDAK dijaga di sini: asal URL. survey-fe tidak tahu
		// origin CDN mana yang dikonfigurasi backend, sementara backend adalah
		// satu-satunya penulis kolom ini. Penjaga asal tiruan di sisi ini justru
		// berbahaya: ia akan menolak CDN yang sah dan membuat latar hilang tanpa
		// satu pun galat. Otoritas asal = ValidateSurveyStyle.
		for (const imageUrl of [
			'/api/v1/media/a/file") ; background:red; x:url("',
			'javascript:alert(1)',
			'https://cdn.contoh.id/x.jpg") ; background:red; x:url("',
			'https://cdn.contoh.id/ruang kosong.jpg',
			'/api/v1/media/a/file\n'
		]) {
			expect(surveyStyleAttr({ background: { imageUrl } })).not.toContain('--page-bg-image')
		}
	})

	it('tidak pernah memuat gambar latar tanpa imageUrl', () => {
		const attr = surveyStyleAttr({ background: { layout: 'cover', brightness: -0.5 } })
		expect(attr).not.toContain('--page-bg-image')
		expect(attr).not.toContain('--page-bg-overlay')
	})
})

// Cakupan slot `card` (T1, keputusan user 27 Sep 2026). Halaman sambutan dan
// penutup dibuat transparan supaya latar kustom terlihat utuh; lima halaman
// keadaan lain mempertahankan permukaannya karena memuat daftar syarat, ikon
// status, dan aksi yang butuh terbaca sebagai satu blok keputusan. Tujuh berkas
// di bawah, bukan lima: gerbang lokasi dan selfie masing-masing punya varian
// "ditolak" tersendiri.
//
// Diuji dari sumber karena yang dijaga adalah BATAS keputusannya, bukan nilai
// warnanya: satu `background: var(--canvas)` yang kembali ke sambutan/penutup
// mengembalikan kartu yang memotong latar, tanpa satu pun uji lain memerah.
// Kontrol positifnya adalah berkas yang WAJIB masih memuatnya — tanpa itu, uji
// ini juga lulus kalau penanda permukaannya sekadar berganti nama.
describe('cakupan slot card di halaman keadaan (T1, T5)', () => {
	const CARD_SURFACE = 'background: var(--canvas);'

	function componentSource(name: string): string {
		return readFileSync(fileURLToPath(new URL(`./components/${name}.svelte`, import.meta.url)), 'utf8')
	}

	const BERKARTU = [
		'LocationPromptPage',
		'LocationDeniedPage',
		'SelfieCapturePage',
		'SelfieDeniedPage',
		'InviteBlockedPage',
		'ErrorPage',
		'ClosedPage'
	]

	// Isi aturan kartu saja, bukan seluruh berkas: padding/radius yang nyasar ke
	// elemen lain tidak boleh ikut meluluskan uji T5 di bawah.
	function cardRuleBody(name: string): string {
		const src = componentSource(name)
		const at = src.indexOf(CARD_SURFACE)
		expect(at).toBeGreaterThan(-1)
		return src.slice(at, src.indexOf('}', at))
	}

	it.each(BERKARTU)('%s mempertahankan permukaan kartunya', (name) => {
		expect(componentSource(name)).toContain(CARD_SURFACE)
	})

	it.each(['WelcomePage', 'ClosingPage'])('%s tidak memakai permukaan kartu', (name) => {
		expect(componentSource(name)).not.toContain(CARD_SURFACE)
	})

	// T5: permukaan tanpa padding dan radius menggugurkan alasan T1 mempertahankan
	// kartunya — begitu slot `card` diwarnai ia jadi blok warna bertepi keras.
	//
	// 🔴 Paddingnya lewat var, bukan angka mati (keputusan user 28 Sep): tanpa gaya
	// kustom kartu ini putih di atas halaman putih, jadi padding di sana cuma
	// menyempitkan tombol di survei yang sudah terbit tanpa kotak yang terlihat.
	it.each(BERKARTU)('%s memberi kartunya padding bersyarat dan radius (T5)', (name) => {
		const rule = cardRuleBody(name)
		expect(rule).toContain('padding: var(--card-padding, 0px)')
		expect(rule).toContain('border-radius: var(--radius-card)')
	})

	// Gambar penutup melebar menembus padding kartu supaya lebarnya persis seperti
	// sebelum T5. Kompensasinya WAJIB ikut var yang sama — kalau ia tetap 48px mati
	// sementara paddingnya 0, gambarnya meluber keluar kartu di survei bawaan.
	it('ClosedPage menjaga gambar penutup selebar kartu di kedua keadaan', () => {
		const src = componentSource('ClosedPage')
		expect(src).toContain('width: calc(100% + var(--card-padding, 0px) * 2)')
		expect(src).toContain('margin: calc(var(--card-padding, 0px) * -1)')
	})

	// Jarak atas ilustrasi menyusut seiring padding kartu: tanpa gaya kustom ia
	// kembali ke angka sebelum T5, dengan gaya kustom padding kartunya yang
	// menyediakan jaraknya. Tanpa ini salah satu dari dua keadaan jadi dobel.
	it.each([
		['ErrorPage', '16px'],
		['ClosedPage', '24px']
	])('%s menjaga jarak atas ilustrasi di kedua keadaan', (name, angka) => {
		expect(componentSource(name)).toContain(`max(0px, calc(${angka} - var(--card-padding, 0px)))`)
	})
})

// Kerangka survei (bilah kemajuan di atas, bilah navigasi di bawah pada ponsel)
// duduk di atas HALAMAN, bukan di dalam kartu — tapi keduanya mengecat diri
// dengan `--canvas`, yang dipetakan dari slot KARTU. Akibatnya survei yang cuma
// mengunggah foto latar mendapat dua balok putih melintang di atas fotonya:
// `--canvas` tetap putih platform karena slot kartunya tidak diisi.
//
// `--chrome-surface` mematikan kedua balok itu, dan HANYA saat ada permukaan
// kustom di belakangnya — syarat yang sama persis dengan `--card-padding`.
// Tanpa syarat itu, ribuan survei yang sudah terbit kehilangan latar bilah
// lengketnya dan teks yang tergulir menembusnya.
describe('permukaan kerangka survei (R3)', () => {
	function componentSource(name: string): string {
		return readFileSync(fileURLToPath(new URL(`./components/${name}.svelte`, import.meta.url)), 'utf8')
	}

	it('permukaan kerangka jadi transparan hanya saat salah satu permukaan kustom aktif', () => {
		expect(surveyStyleVars(null)['--chrome-surface']).toBeUndefined()
		expect(surveyStyleVars({ borderRadius: 'large' })['--chrome-surface']).toBeUndefined()
		expect(surveyStyleVars({ colors: { button: '#2563eb' } })['--chrome-surface']).toBeUndefined()

		expect(surveyStyleVars({ colors: { card: '#111827' } })['--chrome-surface']).toBe('transparent')
		expect(surveyStyleVars({ colors: { background: '#0b1220' } })['--chrome-surface']).toBe('transparent')

		// Kasus yang melahirkan butir ini: FOTO latar tanpa warna apa pun.
		expect(
			surveyStyleVars({ background: { imageUrl: '/api/v1/media/abc/file' } })['--chrome-surface'],
		).toBe('transparent')

		// URL yang bukan media platform tidak pernah dipasang sebagai latar, jadi
		// ia juga tidak boleh mematikan latar bilahnya.
		expect(
			surveyStyleVars({ background: { imageUrl: 'javascript:alert(1)' } })['--chrome-surface'],
		).toBeUndefined()
	})

	// Cadangan `var(--canvas)` adalah inti butir ini: ia yang menjamin survei
	// tanpa gaya kustom tampil persis seperti sebelumnya. Uji ini menolak bentuk
	// `var(--chrome-surface)` tanpa cadangan, yang akan membuat bilahnya
	// transparan di SEMUA survei.
	it.each([
		['ProgressBar', 'bilah kemajuan'],
		['SurveyStage', 'bilah navigasi lengket di ponsel']
	])('%s mengecat permukaannya lewat --chrome-surface berikut cadangannya', (name) => {
		const src = componentSource(name)
		expect(src).toContain('background: var(--chrome-surface, var(--canvas));')
		// Kontrol positif: tidak ada lagi permukaan `--canvas` gundul yang
		// tertinggal di berkas ini, karena satu saja yang tertinggal sudah cukup
		// untuk memunculkan kembali balok putihnya.
		expect(src).not.toContain('background: var(--canvas);')
	})
})
