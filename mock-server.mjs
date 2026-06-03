// Tiny mock API for the survey-fe redesign preview. Run with:
//   node mock-server.mjs
// Then start dev with PUBLIC_API_BASE_URL=http://localhost:3001
//
// Endpoints implement just enough surface for the respondent + surveyor flows
// to render every question type. Submissions are accepted and logged to stdout
// (not persisted). Drafts are in-memory only.

import http from 'node:http'

const PORT = 3001

// Per-slug display-mode override so the same survey body can be served as
// one-per-page (default) or scroll mode for the demo. The runner reads
// settings.displayMode and renders accordingly.
function buildSurvey(displayMode = 'one_per_page') {
  return { ...SURVEY, settings: { ...SURVEY.settings, displayMode } }
}

const SURVEY = {
  id: 'demo-survey-1',
  title: 'Survei Kepuasan Pelanggan (Demo)',
  status: 'active',
  closeMessage: null,
  closeImageUrl: null,
  skipRules: [],
  settings: {
    showProgress: true,
    showBranding: true,
    showNavArrows: true,
    showNumbers: true,
    requireLocation: false,
    requireSelfie: false,
    displayMode: 'one_per_page',
  },
  questions: [
    {
      id: 'q-welcome',
      type: 'welcome_page',
      title: 'Selamat datang!',
      description: 'Terima kasih sudah meluangkan waktu mengisi survei ini. Sekitar 5 menit — jawaban Anda membantu kami memperbaiki layanan.',
      required: false,
      sortOrder: 0,
      groupId: null,
      imageUrl: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop',
      imageLayout: null,
    },
    {
      id: 'q1',
      type: 'short_text',
      title: 'Siapa nama lengkap Anda?',
      description: null,
      required: true,
      sortOrder: 1,
      groupId: null,
      imageUrl: null,
      imageLayout: null,
      placeholder: 'Contoh: Budi Setiawan',
    },
    {
      id: 'q2',
      type: 'email',
      title: 'Apa alamat email Anda?',
      description: 'Kami akan kirim ringkasan hasil ke alamat ini.',
      required: true,
      sortOrder: 2,
      groupId: null,
      imageUrl: null,
      imageLayout: null,
    },
    {
      id: 'q3',
      type: 'phone',
      title: 'Nomor telepon yang aktif?',
      description: null,
      required: false,
      sortOrder: 3,
      groupId: null,
      imageUrl: null,
      imageLayout: null,
    },
    {
      id: 'q4',
      type: 'website',
      title: 'URL website / portofolio Anda?',
      description: null,
      required: false,
      sortOrder: 4,
      groupId: null,
      imageUrl: null,
      imageLayout: null,
      placeholder: 'contohnama.com',
    },
    {
      id: 'q5',
      type: 'number',
      title: 'Berapa kali Anda menggunakan layanan kami bulan ini?',
      description: null,
      required: true,
      sortOrder: 5,
      groupId: null,
      imageUrl: null,
      imageLayout: null,
      minValue: 0,
      maxValue: 100,
    },
    {
      id: 'q6',
      type: 'date',
      title: 'Kapan terakhir kali Anda menggunakan layanan kami?',
      description: null,
      required: false,
      sortOrder: 6,
      groupId: null,
      imageUrl: null,
      imageLayout: null,
      dateFormat: 'DD/MM/YYYY',
    },
    {
      id: 'q7',
      type: 'long_text',
      title: 'Ceritakan pengalaman Anda menggunakan layanan kami',
      description: 'Tulis sebebas-bebasnya — yang baik maupun yang perlu diperbaiki.',
      required: false,
      sortOrder: 7,
      groupId: null,
      imageUrl: null,
      imageLayout: null,
      placeholder: 'Mulai mengetik di sini…',
    },
    {
      id: 'q8',
      type: 'single_choice',
      title: 'Bagaimana Anda mengetahui layanan kami?',
      description: null,
      required: true,
      sortOrder: 8,
      groupId: null,
      imageUrl: null,
      imageLayout: null,
      options: [
        { id: 'q8-a', label: 'Media sosial',  sortOrder: 0 },
        { id: 'q8-b', label: 'Teman / rekan', sortOrder: 1 },
        { id: 'q8-c', label: 'Iklan online',  sortOrder: 2 },
        { id: 'q8-d', label: 'Lainnya',       sortOrder: 3, isOther: true },
      ],
    },
    {
      id: 'q9',
      type: 'checkbox',
      title: 'Fitur mana yang paling sering Anda pakai? (pilih hingga 3)',
      description: null,
      required: false,
      sortOrder: 9,
      groupId: null,
      imageUrl: null,
      imageLayout: null,
      maxSelections: 3,
      options: [
        { id: 'q9-a', label: 'Pencarian',       sortOrder: 0 },
        { id: 'q9-b', label: 'Notifikasi',      sortOrder: 1 },
        { id: 'q9-c', label: 'Riwayat pesanan', sortOrder: 2 },
        { id: 'q9-d', label: 'Live chat',       sortOrder: 3 },
        { id: 'q9-e', label: 'Lainnya',         sortOrder: 4, isOther: true },
      ],
    },
    {
      id: 'q10',
      type: 'dropdown',
      title: 'Dari mana Anda mengakses layanan ini paling sering?',
      description: null,
      required: false,
      sortOrder: 10,
      groupId: null,
      imageUrl: null,
      imageLayout: null,
      options: [
        { id: 'q10-a', label: 'Jakarta',   sortOrder: 0 },
        { id: 'q10-b', label: 'Bandung',   sortOrder: 1 },
        { id: 'q10-c', label: 'Surabaya',  sortOrder: 2 },
        { id: 'q10-d', label: 'Yogyakarta',sortOrder: 3 },
        { id: 'q10-e', label: 'Bali',      sortOrder: 4 },
        { id: 'q10-f', label: 'Lainnya',   sortOrder: 5, isOther: true },
      ],
    },
    {
      id: 'q11',
      type: 'yes_no',
      title: 'Apakah Anda akan merekomendasikan layanan ini ke teman?',
      description: null,
      required: true,
      sortOrder: 11,
      groupId: null,
      imageUrl: null,
      imageLayout: null,
    },
    {
      id: 'q12',
      type: 'rating',
      title: 'Beri penilaian untuk pengalaman Anda secara keseluruhan',
      description: null,
      required: true,
      sortOrder: 12,
      groupId: null,
      imageUrl: null,
      imageLayout: null,
      maxStars: 5,
    },
    {
      id: 'q13',
      type: 'nps',
      title: 'Seberapa besar kemungkinan Anda merekomendasikan kami ke kolega?',
      description: '0 = sangat tidak mungkin, 10 = sangat mungkin',
      required: true,
      sortOrder: 13,
      groupId: null,
      imageUrl: null,
      imageLayout: null,
      minLabel: 'Tidak mungkin',
      maxLabel: 'Sangat mungkin',
    },
    {
      id: 'q14',
      type: 'opinion_scale',
      title: 'Seberapa setuju pernyataan: "Layanan ini sepadan dengan harganya"',
      description: null,
      required: true,
      sortOrder: 14,
      groupId: null,
      imageUrl: null,
      imageLayout: null,
      minValue: 1,
      maxValue: 7,
      minLabel: 'Sangat tidak setuju',
      maxLabel: 'Sangat setuju',
      midLabel: 'Netral',
    },
    {
      id: 'q15',
      type: 'matrix',
      title: 'Bagaimana Anda menilai aspek-aspek berikut?',
      description: null,
      required: false,
      sortOrder: 15,
      groupId: null,
      imageUrl: null,
      imageLayout: null,
      matrixRows: [
        { id: 'r-speed',    label: 'Kecepatan layanan', sortOrder: 0 },
        { id: 'r-quality',  label: 'Kualitas produk',   sortOrder: 1 },
        { id: 'r-support',  label: 'Dukungan pelanggan',sortOrder: 2 },
        { id: 'r-price',    label: 'Harga',             sortOrder: 3 },
      ],
      matrixCols: [
        { id: 'c-bad',   label: 'Buruk',       sortOrder: 0 },
        { id: 'c-meh',   label: 'Biasa saja',  sortOrder: 1 },
        { id: 'c-good',  label: 'Baik',        sortOrder: 2 },
        { id: 'c-great', label: 'Sangat baik', sortOrder: 3 },
      ],
    },
    {
      id: 'q16',
      type: 'image_choice',
      title: 'Pilih gambar yang paling mewakili gaya hidup Anda',
      description: null,
      required: false,
      sortOrder: 16,
      groupId: null,
      imageUrl: null,
      imageLayout: null,
      showLabel: true,
      options: [
        { id: 'q16-a', label: 'Petualang outdoor', sortOrder: 0, imageUrl: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&auto=format&fit=crop' },
        { id: 'q16-b', label: 'Urban kreatif',     sortOrder: 1, imageUrl: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=600&auto=format&fit=crop' },
        { id: 'q16-c', label: 'Foodie',            sortOrder: 2, imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop' },
        { id: 'q16-d', label: 'Pekerja remote',    sortOrder: 3, imageUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&auto=format&fit=crop' },
      ],
    },
    {
      id: 'q17',
      type: 'contact_info',
      title: 'Informasi kontak (opsional)',
      description: 'Untuk follow-up jika diperlukan.',
      required: false,
      sortOrder: 17,
      groupId: null,
      imageUrl: null,
      imageLayout: null,
    },
    {
      id: 'q18',
      type: 'file_upload',
      title: 'Unggah lampiran (opsional)',
      description: 'Gambar, PDF, atau dokumen. Maks. 10 MB.',
      required: false,
      sortOrder: 18,
      groupId: null,
      imageUrl: null,
      imageLayout: null,
    },
    {
      id: 'q19',
      type: 'statement',
      title: 'Hampir selesai',
      description: 'Klik "Selesai" di bawah untuk mengirim jawaban Anda. Kami menjaga data Anda sesuai kebijakan privasi.',
      required: false,
      sortOrder: 19,
      groupId: null,
      imageUrl: null,
      imageLayout: null,
    },
    {
      id: 'q-closing',
      type: 'closing_page',
      title: 'Terima kasih!',
      description: 'Jawaban Anda telah tersimpan. Selamat beraktivitas kembali.',
      required: false,
      sortOrder: 20,
      groupId: null,
      imageUrl: 'https://images.unsplash.com/photo-1531058020387-3be344556be6?w=1200&auto=format&fit=crop',
      imageLayout: null,
    },
  ],
}

// Surveyor demo session payload.
const SURVEYOR = {
  surveyor: { id: 'surv-001', displayName: 'Dewi Petugas', email: 'dewi@logikastatistik.id' },
  survey:   { slug: 'demo' },
  stats:    { todayCount: 7, totalCount: 142 },
}

// In-memory draft store keyed by `${slug}:${sessionKey}`.
const drafts = new Map()

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key')
}

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8') || '{}'
      try { resolve(JSON.parse(raw)) } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  setCors(res)
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end() }

  const url = new URL(req.url, `http://${req.headers.host}`)
  const path = url.pathname
  const method = req.method
  console.log(`${method} ${path}`)

  // Survey — slug picks the displayMode so the same content shows in both modes.
  //   /s/demo          → one-per-page (default)
  //   /s/demo-scroll   → scroll (all questions visible at once)
  if (method === 'GET' && /^\/s\/[^/]+$/.test(path)) {
    const slug = path.split('/')[2]
    const mode = slug.endsWith('-scroll') ? 'scroll' : 'one_per_page'
    return sendJson(res, 200, { survey: buildSurvey(mode) })
  }
  if (method === 'POST' && /^\/s\/[^/]+\/submit$/.test(path)) {
    const body = await readJsonBody(req).catch(() => ({}))
    console.log('  submission keys:', Object.keys(body.answers ?? {}).length)
    return sendJson(res, 200, { ok: true, submissionId: body.submissionId ?? 'mock-sub-' + Date.now() })
  }

  // Drafts
  if (method === 'PUT' && /^\/s\/[^/]+\/draft$/.test(path)) {
    const body = await readJsonBody(req).catch(() => ({}))
    const slug = path.split('/')[2]
    drafts.set(`${slug}:${body.sessionKey}`, { answers: body.answers, currentPageIndex: body.currentPageIndex })
    return sendJson(res, 200, { ok: true })
  }
  if (method === 'GET' && /^\/s\/[^/]+\/draft$/.test(path)) {
    const slug = path.split('/')[2]
    const key = url.searchParams.get('sessionKey') ?? ''
    const d = drafts.get(`${slug}:${key}`)
    if (!d) { res.statusCode = 404; return res.end() }
    return sendJson(res, 200, d)
  }
  if (method === 'DELETE' && /^\/s\/[^/]+\/draft$/.test(path)) {
    const slug = path.split('/')[2]
    const key = url.searchParams.get('sessionKey') ?? ''
    drafts.delete(`${slug}:${key}`)
    return sendJson(res, 200, { ok: true })
  }

  // File upload — accept and return a static URL
  if (method === 'POST' && /^\/s\/[^/]+\/upload$/.test(path)) {
    return sendJson(res, 200, { url: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=600&auto=format&fit=crop', name: 'mock-upload.jpg' })
  }

  // Invitations (best-effort no-ops)
  if (method === 'POST' && /^\/invitations\/[^/]+\/track$/.test(path)) {
    return sendJson(res, 200, { ok: true })
  }
  if (method === 'POST' && /^\/invitations\/[^/]+\/progress$/.test(path)) {
    return sendJson(res, 200, { ok: true })
  }
  if (method === 'GET' && /^\/invitations\/[^/]+\/status$/.test(path)) {
    return sendJson(res, 200, { state: 'ok' })
  }

  // Surveyor: login + stats
  if (method === 'POST' && path === '/surveyor/login') {
    const body = await readJsonBody(req).catch(() => ({}))
    // Accept any 6-char code for demo purposes.
    if (typeof body.code !== 'string' || body.code.length !== 6) {
      return sendJson(res, 401, { error: 'bad code' })
    }
    return sendJson(res, 200, SURVEYOR)
  }
  if (method === 'GET' && path === '/surveyor/me/stats') {
    return sendJson(res, 200, { ...SURVEYOR.stats, surveyorId: SURVEYOR.surveyor.id, slug: SURVEYOR.survey.slug })
  }

  res.statusCode = 404
  res.end('Not found: ' + method + ' ' + path)
})

server.listen(PORT, () => {
  console.log(`Mock API listening at http://localhost:${PORT}`)
  console.log('Routes:')
  console.log('  Respondent (one per page): http://localhost:5174/s/demo')
  console.log('  Respondent (all at once):  http://localhost:5174/s/demo-scroll')
  console.log('  Surveyor (interviewer):    http://localhost:5174/surveyor/s/demo  (any 6-char code, e.g. DEMO12)')
})
