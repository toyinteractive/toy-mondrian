import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

/**
 * Screenshots `public/social/og-preview.html` (toy + hero titles + enlarged footer)
 * into platform-ready social preview PNGs.
 *
 * Not part of `pnpm build` (Vercel/CI have no Playwright Chromium). Commit the
 * generated `public/og.png` and `public/social/twitter-card.png` after running locally.
 *
 * First time: `pnpm exec playwright install chromium`
 * Preview: http://localhost:5173/social/og-preview.html (`pnpm dev` or `pnpm preview:og`)
 * Regenerate after editing og-preview: `pnpm social-images`
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const socialDir = path.join(publicDir, 'social');
const PREVIEW_URL_PATH = '/social/og-preview.html';
const previewHtml = path.join(socialDir, 'og-preview.html');

/** @type {{ file: string; width: number; height: number; label: string }[]} */
const VARIANTS = [
  {
    file: 'og.png',
    width: 1200,
    height: 630,
    label: 'Open Graph (Facebook, LinkedIn, Slack, iMessage, Discord)',
  },
  {
    file: path.join('social', 'twitter-card.png'),
    width: 1200,
    height: 600,
    label: 'Twitter / X summary_large_image (2:1)',
  },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

if (!fs.existsSync(previewHtml)) {
  console.error('Missing public/social/og-preview.html');
  process.exit(1);
}

fs.mkdirSync(socialDir, { recursive: true });

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const urlPath = (req.url ?? '/').split('?')[0];
      const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, '');
      const filePath = path.join(publicDir, safePath === '/' ? PREVIEW_URL_PATH.slice(1) : safePath);

      if (!filePath.startsWith(publicDir)) {
        res.writeHead(403);
        res.end();
        return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end();
          return;
        }
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
        res.end(data);
      });
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

const { server, baseUrl } = await startStaticServer();

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const variant of VARIANTS) {
    const outPath = path.join(publicDir, variant.file);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    await page.setViewportSize({ width: variant.width, height: variant.height });
    await page.goto(`${baseUrl}${PREVIEW_URL_PATH}`, { waitUntil: 'networkidle' });
    await page.evaluate('document.fonts.ready');

    await page.screenshot({
      path: outPath,
      type: 'png',
      fullPage: false,
    });

    const { size } = fs.statSync(outPath);
    console.log(`Wrote public/${variant.file} — ${variant.width}×${variant.height} (${size} bytes) — ${variant.label}`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('Executable doesn') || message.includes('browserType.launch')) {
    console.error('Playwright Chromium is not installed. Run:\n  pnpm exec playwright install chromium');
  }
  throw error;
} finally {
  await browser?.close();
  server.close();
}
