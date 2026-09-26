import { describe, it, expect } from 'vitest'
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

	it('memetakan slot background ke --page-bg, BUKAN ke --canvas', () => {
		// --canvas dipakai kartu dan kotak isian. Kalau latar kustom menimpanya,
		// latar gelap pilihan pemilik survei membuat teks di dalam kotak isian
		// tidak terbaca, dan itu terjadi tanpa galat apa pun.
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
