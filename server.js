// ============================================================
// Project Dashboard - Backend (Express + JSON file storage)
// ============================================================
import express from 'express';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 9000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'projects.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
// Optional URL prefix when behind a reverse proxy that does NOT strip it.
// Example: BASE_PATH=/dockdock/fun-dashboard
const BASE_PATH = (process.env.BASE_PATH || '').replace(/\/+$/, '');

const DEFAULT_PROJECTS = [
  { id: 'p1', name: 'Temp Number', url: 'https://prodev.ut.ac.id/dockdock/temp-number/', desc: 'Layanan nomor sementara untuk verifikasi.', icon: '📱' },
  { id: 'p2', name: 'Temp Email',  url: 'https://prodev.ut.ac.id/dockdock/temp-email/',  desc: 'Layanan email sementara cepat dan praktis.', icon: '📧' },
  { id: 'p3', name: 'Static Demo', url: 'https://unmetropolitan-unfostered-julian.ngrok-free.dev/static/index.html', desc: 'Demo halaman statis via ngrok.', icon: '🌐' },
];

// ---------- Token store (in-memory) ----------
const tokens = new Set();

function newToken() {
  const t = crypto.randomBytes(24).toString('hex');
  tokens.add(t);
  return t;
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token || !tokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ---------- Storage ----------
async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(DEFAULT_PROJECTS, null, 2), 'utf8');
  }
}

async function readProjects() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// Atomic write to prevent corruption
async function writeProjects(list) {
  const tmp = DATA_FILE + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(list, null, 2), 'utf8');
  await fs.rename(tmp, DATA_FILE);
}

// ---------- Validation ----------
function isSafeUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function sanitizeProject(body) {
  const name = String(body?.name || '').trim().slice(0, 80);
  const url = String(body?.url || '').trim();
  const desc = String(body?.desc || '').trim().slice(0, 240);
  const icon = String(body?.icon || '').trim().slice(0, 4) || '🚀';
  if (!name) return { error: 'Nama wajib diisi' };
  if (!isSafeUrl(url)) return { error: 'URL harus valid (http/https)' };
  return { data: { name, url, desc, icon } };
}

function uid() {
  return 'p_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
}

// ---------- App ----------
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

// Strip optional reverse-proxy prefix (e.g. "/dockdock/fun-dashboard")
// so the app works whether the proxy preserves the prefix or not.
app.use((req, _res, next) => {
  if (BASE_PATH && req.url.startsWith(BASE_PATH)) {
    req.url = req.url.slice(BASE_PATH.length) || '/';
  }
  next();
});

// Static frontend
app.use(express.static(PUBLIC_DIR, {
  etag: true,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=604800, must-revalidate');
    }
  },
}));

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Login -> issue token
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    return res.json({ token: newToken() });
  }
  res.status(401).json({ error: 'Username atau password salah' });
});

// Logout
app.post('/api/logout', requireAuth, (req, res) => {
  const token = req.headers.authorization.slice(7);
  tokens.delete(token);
  res.json({ ok: true });
});

// Validate token (used by frontend on load)
app.get('/api/me', requireAuth, (_req, res) => res.json({ admin: true }));

// CRUD projects
app.get('/api/projects', async (_req, res) => {
  res.json(await readProjects());
});

app.post('/api/projects', requireAuth, async (req, res) => {
  const v = sanitizeProject(req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  const list = await readProjects();
  const item = { id: uid(), ...v.data };
  list.push(item);
  await writeProjects(list);
  res.status(201).json(item);
});

app.put('/api/projects/:id', requireAuth, async (req, res) => {
  const v = sanitizeProject(req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  const list = await readProjects();
  const idx = list.findIndex((p) => p.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Tidak ditemukan' });
  list[idx] = { id: list[idx].id, ...v.data };
  await writeProjects(list);
  res.json(list[idx]);
});

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  const list = await readProjects();
  const next = list.filter((p) => p.id !== req.params.id);
  if (next.length === list.length) return res.status(404).json({ error: 'Tidak ditemukan' });
  await writeProjects(next);
  res.json({ ok: true });
});

// SPA fallback
app.get('*', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// ---------- Start ----------
ensureDataFile().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Dashboard listening on http://localhost:${PORT}`);
    console.log(`📁 Data file: ${DATA_FILE}`);
  });
});
