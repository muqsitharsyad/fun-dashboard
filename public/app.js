// ============================================================
// Project Dashboard - Frontend (uses backend API)
// ============================================================

const AUTH_KEY = 'fpd.token.v1';
const THEME_KEY = 'fpd.theme.v1';
const API = '/api';

// ---------- State ----------
let projects = [];
let token = sessionStorage.getItem(AUTH_KEY) || null;
let isAdmin = false;
let pendingDeleteId = null;
let searchTerm = '';

// ---------- DOM ----------
const $ = (sel) => document.querySelector(sel);
const grid = $('#projectGrid');
const emptyState = $('#emptyState');
const adminBtn = $('#adminBtn');
const loginModal = $('#loginModal');
const projectModal = $('#projectModal');
const confirmModal = $('#confirmModal');
const loginForm = $('#loginForm');
const projectForm = $('#projectForm');
const loginError = $('#loginError');
const searchInput = $('#searchInput');
const themeToggle = $('#themeToggle');

// ---------- API helper ----------
async function api(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    token = null;
    isAdmin = false;
    sessionStorage.removeItem(AUTH_KEY);
  }
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ---------- Utilities ----------
function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function isSafeUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function showToast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.add('hidden'), 2200);
}

function openModal(modal) {
  modal.classList.remove('hidden');
  const focusable = modal.querySelector('input, button:not([data-close])');
  if (focusable) setTimeout(() => focusable.focus(), 50);
}
function closeModal(modal) {
  modal.classList.add('hidden');
}

// ---------- Render ----------
function render() {
  const term = searchTerm.trim().toLowerCase();
  const list = term
    ? projects.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          (p.desc || '').toLowerCase().includes(term)
      )
    : projects;

  grid.innerHTML = '';
  if (list.length === 0) {
    emptyState.textContent = projects.length === 0
      ? 'Belum ada project. Login sebagai admin untuk menambahkan.'
      : 'Tidak ada project yang cocok dengan pencarian.';
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
  }

  for (const p of list) {
    const card = document.createElement('article');
    card.className = 'card';
    const safeUrl = isSafeUrl(p.url) ? p.url : '#';
    card.innerHTML = `
      <div class="card-icon">${escapeHtml(p.icon || '🚀')}</div>
      <h3 class="card-title">${escapeHtml(p.name)}</h3>
      <p class="card-desc">${escapeHtml(p.desc || '')}</p>
      <a class="card-link" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">Buka ↗</a>
      ${isAdmin ? `
        <div class="card-actions">
          <button class="btn btn-ghost" data-edit="${p.id}">✏️ Edit</button>
          <button class="btn btn-danger" data-delete="${p.id}">🗑️ Hapus</button>
        </div>` : ''}
    `;
    grid.appendChild(card);
  }

  // Admin FAB
  let fab = $('#addFab');
  if (isAdmin) {
    if (!fab) {
      fab = document.createElement('button');
      fab.id = 'addFab';
      fab.className = 'fab';
      fab.title = 'Tambah project';
      fab.setAttribute('aria-label', 'Tambah project');
      fab.textContent = '+';
      fab.addEventListener('click', () => openProjectForm());
      document.body.appendChild(fab);
    }
  } else if (fab) {
    fab.remove();
  }

  adminBtn.textContent = isAdmin ? 'Logout' : 'Admin';
}

// ---------- Data load ----------
async function loadProjects() {
  try {
    projects = await api('/projects');
    render();
  } catch (err) {
    showToast('Gagal memuat data: ' + err.message);
  }
}

async function checkAuth() {
  if (!token) { isAdmin = false; return; }
  try {
    await api('/me', { auth: true });
    isAdmin = true;
  } catch {
    isAdmin = false;
  }
}

// ---------- Project form ----------
function openProjectForm(project = null) {
  $('#projectTitle').textContent = project ? 'Edit Project' : 'Tambah Project';
  $('#projectId').value = project?.id || '';
  $('#projectName').value = project?.name || '';
  $('#projectUrl').value = project?.url || '';
  $('#projectDesc').value = project?.desc || '';
  $('#projectIcon').value = project?.icon || '';
  openModal(projectModal);
}

async function saveProjectFromForm(e) {
  e.preventDefault();
  if (!isAdmin) return;
  const id = $('#projectId').value;
  const payload = {
    name: $('#projectName').value.trim(),
    url: $('#projectUrl').value.trim(),
    desc: $('#projectDesc').value.trim(),
    icon: $('#projectIcon').value.trim() || '🚀',
  };
  if (!payload.name || !isSafeUrl(payload.url)) {
    showToast('URL harus valid (http/https).');
    return;
  }
  try {
    if (id) {
      const updated = await api(`/projects/${encodeURIComponent(id)}`, { method: 'PUT', body: payload, auth: true });
      const idx = projects.findIndex((p) => p.id === id);
      if (idx >= 0) projects[idx] = updated;
      showToast('Project diperbarui');
    } else {
      const created = await api('/projects', { method: 'POST', body: payload, auth: true });
      projects.push(created);
      showToast('Project ditambahkan');
    }
    closeModal(projectModal);
    render();
  } catch (err) {
    showToast('Gagal menyimpan: ' + err.message);
  }
}

function requestDelete(id) {
  pendingDeleteId = id;
  const p = projects.find((x) => x.id === id);
  $('#confirmText').textContent = `Hapus project "${p?.name || ''}"? Tindakan ini tidak bisa dibatalkan.`;
  openModal(confirmModal);
}
async function confirmDelete() {
  if (!isAdmin || !pendingDeleteId) return;
  const id = pendingDeleteId;
  pendingDeleteId = null;
  closeModal(confirmModal);
  try {
    await api(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
    projects = projects.filter((p) => p.id !== id);
    render();
    showToast('Project dihapus');
  } catch (err) {
    showToast('Gagal menghapus: ' + err.message);
  }
}

// ---------- Theme ----------
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem(THEME_KEY, theme);
}
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}

// ---------- Events ----------
adminBtn.addEventListener('click', async () => {
  if (isAdmin) {
    try { await api('/logout', { method: 'POST', auth: true }); } catch { /* ignore */ }
    token = null;
    isAdmin = false;
    sessionStorage.removeItem(AUTH_KEY);
    render();
    showToast('Logout berhasil');
  } else {
    loginError.classList.add('hidden');
    loginForm.reset();
    openModal(loginModal);
  }
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = $('#username').value.trim();
  const password = $('#password').value;
  try {
    const data = await api('/login', { method: 'POST', body: { username, password } });
    token = data.token;
    sessionStorage.setItem(AUTH_KEY, token);
    isAdmin = true;
    closeModal(loginModal);
    render();
    showToast('Selamat datang, admin!');
  } catch {
    loginError.classList.remove('hidden');
  }
});

projectForm.addEventListener('submit', saveProjectFromForm);

$('#confirmOk').addEventListener('click', confirmDelete);

grid.addEventListener('click', (e) => {
  const editId = e.target.closest('[data-edit]')?.dataset.edit;
  const delId = e.target.closest('[data-delete]')?.dataset.delete;
  if (editId) {
    const p = projects.find((x) => x.id === editId);
    if (p) openProjectForm(p);
  } else if (delId) {
    requestDelete(delId);
  }
});

document.addEventListener('click', (e) => {
  if (e.target.matches('[data-close]')) {
    e.target.closest('.modal')?.classList.add('hidden');
  }
});
document.querySelectorAll('.modal').forEach((m) => {
  m.addEventListener('click', (e) => {
    if (e.target === m) m.classList.add('hidden');
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal:not(.hidden)').forEach((m) => m.classList.add('hidden'));
  }
});

let searchTimer;
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  const v = e.target.value;
  searchTimer = setTimeout(() => {
    searchTerm = v;
    render();
  }, 120);
});

themeToggle.addEventListener('click', () => {
  const cur = document.documentElement.dataset.theme;
  applyTheme(cur === 'dark' ? 'light' : 'dark');
});

// ---------- Init ----------
$('#year').textContent = new Date().getFullYear();
initTheme();
(async () => {
  await checkAuth();
  await loadProjects();
})();
