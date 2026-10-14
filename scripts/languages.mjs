import fs from 'node:fs'

const USER = process.env.GH_USER || 'Abhiramcodegit'
const TOKEN = process.env.GITHUB_TOKEN
const headers = {
  Accept: 'application/vnd.github+json',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
}

const COLORS = {
  Python: '#38bdf8',
  TypeScript: '#86efac',
  JavaScript: '#fbbf24',
  HTML: '#ff6b35',
  CSS: '#a78bfa',
  Shell: '#9ca3af',
}
const FALLBACK = ['#ec4899', '#c4b5fd', '#fdba9f', '#7dd3fc', '#fde68a', '#6ee7b7']

async function get(url) {
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function main() {
  let repos = []
  for (let page = 1; ; page++) {
    const batch = await get(
      `https://api.github.com/users/${USER}/repos?per_page=100&type=owner&page=${page}`
    )
    repos = repos.concat(batch)
    if (batch.length < 100) break
  }
  repos = repos.filter((r) => !r.fork)

  const totals = {}
  for (const repo of repos) {
    const langs = await get(repo.languages_url)
    for (const [name, bytes] of Object.entries(langs)) {
      totals[name] = (totals[name] || 0) + bytes
    }
  }

  const sum = Object.values(totals).reduce((a, b) => a + b, 0)
  if (!sum) throw new Error('No language data found')
  let items = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([name, bytes]) => ({ name, pct: (bytes / sum) * 100 }))
  const top = items.slice(0, 8)
  const rest = items.slice(8).reduce((a, b) => a + b.pct, 0)
  if (rest > 0) top.push({ name: 'Other', pct: rest })
  items = top

  let fb = 0
  for (const it of items) {
    it.color = COLORS[it.name] || (it.name === 'Other' ? '#6b7280' : FALLBACK[fb++ % FALLBACK.length])
  }

  const W = 1200
  const rows = Math.ceil(items.length / 2)
  const H = 270 + rows * 52 + 70
  const BAR_X = 58
  const BAR_W = 1084

  let x = BAR_X
  const segs = items
    .map((it) => {
      const w = (it.pct / 100) * BAR_W
      const seg = `<rect x="${x.toFixed(1)}" y="170" width="${w.toFixed(1)}" height="26" fill="${it.color}"/>`
      x += w
      return seg
    })
    .join('')

  const max = items[0].pct
  const legend = items
    .map((it, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const tx = col === 0 ? 58 : 612
      const ty = 240 + row * 52
      const barW = Math.max(4, (it.pct / max) * 330)
      return `<g transform="translate(${tx} ${ty})"><circle cx="8" cy="8" r="7" fill="${it.color}"/><text x="26" y="13" fill="#fff" font-size="18" font-weight="700">${esc(it.name)}</text><text x="530" y="13" text-anchor="end" fill="#d1d5db" font-size="16">${it.pct.toFixed(1)}%</text><rect x="26" y="26" width="${barW.toFixed(1)}" height="6" rx="3" fill="${it.color}" fill-opacity=".85"/></g>`
    })
    .join('')

  const date = new Date().toISOString().slice(0, 10)

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc">
<title id="title">Abhiram's most used languages</title><desc id="desc">${esc(items.map((i) => `${i.name} ${i.pct.toFixed(1)}%`).join(', '))}</desc>
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#080a16"/><stop offset="1" stop-color="#150d20"/></linearGradient><linearGradient id="a" x1="0" x2="1"><stop stop-color="#8b5cf6"/><stop offset="1" stop-color="#ff6b35"/></linearGradient><pattern id="g" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="#a78bfa" stroke-opacity=".055"/></pattern><clipPath id="bar"><rect x="${BAR_X}" y="170" width="${BAR_W}" height="26" rx="13"/></clipPath></defs>
<rect width="${W}" height="${H}" rx="28" fill="url(#bg)"/><rect width="${W}" height="${H}" rx="28" fill="url(#g)"/><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="27" fill="none" stroke="url(#a)" stroke-opacity=".6" stroke-width="2"/>
<text x="58" y="70" fill="#a78bfa" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="15" letter-spacing="3">MOST USED LANGUAGES</text><text x="58" y="112" fill="#f9fafb" font-family="ui-sans-serif,system-ui,sans-serif" font-size="34" font-weight="800">What the code is written in</text><rect x="58" y="130" width="1084" height="2" fill="url(#a)"/>
<g clip-path="url(#bar)">${segs}</g>
<g font-family="ui-sans-serif,system-ui,sans-serif">${legend}</g>
<text x="600" y="${H - 28}" text-anchor="middle" fill="#9ca3af" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="14">public repositories · updated ${date}</text></svg>
`

  fs.mkdirSync('assets', { recursive: true })
  fs.writeFileSync('assets/languages.svg', svg)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
