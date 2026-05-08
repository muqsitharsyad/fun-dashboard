# 🚀 Project Dashboard

Dashboard ringan untuk menampilkan kumpulan project, dengan fitur admin (CRUD) dan dukungan responsif (HP, tablet, desktop).

## Arsitektur
- **Backend:** Node.js 20 + Express (1 dependency).
- **Frontend:** HTML + CSS + Vanilla JavaScript (tanpa framework, tanpa build step).
- **Storage:** File JSON di disk (`data/projects.json`) — tidak butuh database.
- **Auth:** Token sederhana di memory, login statis via env var.

## Struktur File
```
fun-project-dashboard/
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── data/                # auto-created, persistent
│   └── projects.json
├── server.js
├── package.json
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
└── .gitignore
```

## Cara Jalankan

### A. Lokal (Node 20+)
```powershell
npm install
npm start
```
Buka `http://localhost:9000`.

### B. Docker
```powershell
docker compose up -d --build
```
Buka `http://localhost:8080`.

## Login Admin
Default: `admin` / `admin`. Ubah lewat env var `ADMIN_USER` / `ADMIN_PASS`.

## API
| Method | Path | Auth |
|--------|------|------|
| GET    | `/api/projects` | - |
| POST   | `/api/projects` | ✅ |
| PUT    | `/api/projects/:id` | ✅ |
| DELETE | `/api/projects/:id` | ✅ |
| POST   | `/api/login` | - |
| POST   | `/api/logout` | ✅ |
| GET    | `/api/me` | ✅ |
| GET    | `/api/health` | - |
