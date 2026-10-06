# Long Ha (Bon) — interactive résumé site

Interactive ASCII "trading-terminal universe" résumé: a candlestick planet → monogram → wormhole → a map of four
destinations (Track record, PnL, Character sheet, Open order). Plain HTML + CSS + vanilla JS — no build step, no
dependencies. Works without JavaScript (falls back to a normal, linear résumé page).

## Credits & license

The rendering engines (`js/ascii-engine.js`, `js/galaxy.js`, `js/trajectory.js`, `js/space-bg.js`, and the structure of
`js/app.js`) are adapted from **cudam321.com** by Cudam — <https://github.com/cudam321/cudam321.com> — released under the
MIT License. His copyright and permission notice is kept in `LICENSE` and must stay with the code.

The MIT license covers **code only**. Cudam's written copy, photos, ASCII art, and branding are not licensed for reuse and
none of them are in this repo. Everything visible on this site (text, monogram, candlestick texture, icons) is original.

## Run locally

```bash
cd bon-site
python3 -m http.server 8000      # or: npx serve .
# open http://localhost:8000
```

Opening `index.html` straight from disk can block image loading in some browsers — use a local server.

## Deploy

It's a static folder, so any static host works.

- **Vercel / Netlify / Cloudflare Pages:** import the folder (or the GitHub repo) — no build command, output dir `.`.
  `vercel.json` already sets cache and security headers.
- **GitHub Pages:** push to a repo, Settings → Pages → deploy from branch `/ (root)`.

After you have a domain:

1. In `index.html`, add `<link rel="canonical" href="https://YOUR-DOMAIN/">`.
2. Make `og:image` and `twitter:image` absolute, e.g. `https://YOUR-DOMAIN/images/og.png` (crawlers need absolute URLs).
3. Add the domain to `sameAs` / `url` in the JSON-LD block if you want.

## Things to check before you publish (marked `TODO(Bon)` in the code)

- **Skill levels** (Character sheet): the `LV x` bars are self-rated placeholders — set them to what you actually believe.
- **Bullet.xyz percentages** (+309% likes, +632% reposts, +222% profile visits): add the comparison baseline (e.g.
  "vs. the previous 30 days") to the PnL note once you've confirmed it in X analytics.
- **Sparklines** on the PnL cards are decorative and labelled as such; don't present them as real data.
- **Degen persona**: deliberately not on the site until it's confirmed.
- **Contact details**: X, Telegram and email are in `index.html` (and the JSON-LD block). Phone number is intentionally absent.

## Where things live

| File | What it does |
| --- | --- |
| `index.html` | All content (experience, PnL cards, skills, contact) as semantic HTML |
| `css/style.css` | Theme (mint = long, amber = accent, red = short) and layout |
| `js/app.js` | Scroll cinematic, overlays, flight HUD data (`SYS`), console commands |
| `js/ascii-engine.js` | Image/globe → ASCII renderer |
| `js/galaxy.js` · `js/trajectory.js` · `js/space-bg.js` | Map, flight game, section backgrounds |
| `images/` | `market.jpg` (planet texture), `mark.jpg` (monogram), `og.png` (share card) |

Console easter eggs (click the prompt at the bottom): `help`, `ls`, `cd track|results|skills|contact`, `map`, `gm`, `wagmi`,
`rekt`, `ngmi`, `long`, `short`, `sudo hire-me`.
