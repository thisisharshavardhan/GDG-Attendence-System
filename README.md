<div align="center">

# GDG QR-Based Attendance Portal

A **secure, real-time QR attendance management system** built for Google Developer Groups.  
Auto-refreshing QR codes, geofencing, role-based access, online meeting support & more.

[![Live Demo](https://img.shields.io/badge/Live_Demo-GitHub_Pages-blue?style=for-the-badge)](https://thisisharshavardhan.github.io/GDG-Attendence-System/)
[![React](https://img.shields.io/badge/React-19.2.0-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Express](https://img.shields.io/badge/Express-5.2.1-000000?style=flat-square&logo=express)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose_9-47A248?style=flat-square&logo=mongodb)](https://mongoosejs.com)
[![Firebase](https://img.shields.io/badge/Firebase_Auth-12.9.0-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com)
[![Vite](https://img.shields.io/badge/Vite-7.3.1-646CFF?style=flat-square&logo=vite)](https://vite.dev)

</div>

---

## Screenshots

### Login Page
> Google-themed login with GSAP floating-dot animations, Google Sign-In & email/password authentication.

![Login Page](public/screenshot-login.png)

### Dashboard
> Role-based dashboard with quick-action cards tailored for Admin, PR Team, and Members.

![Dashboard](public/screenshot-dashboard.png)

### Manage Members
> Full member management — search, filter by role, inline role editing, delete, and pagination.

![Manage Members](public/screenshot-members.png)

### Manage Meetings
> Create and manage offline/online meetings with geofencing maps, participation restrictions, and QR code management.

![Manage Meetings](public/screenshot-meetings.png)

### Reports & Analytics
> Attendance overview with summary statistics, per-meeting breakdowns, per-member summaries, and CSV export.

![Reports](public/screenshot-reports.png)

### QR Code Display (PR View)
> Fullscreen auto-refreshing QR code with SVG countdown ring — displayed on a projector during events.

![QR Display](public/screenshot-qr-display.png)

---

## Features

### Core
- **Firebase Authentication** — Google Sign-In + Email/Password
- **Role-Based Access Control** — Admin · PR Team · Member
- **Member Management** — CRUD with search, filter, pagination, sort
- **Meeting Management** — Offline & online meetings with full CRUD
- **QR Code Generation** — Unique QR per meeting
- **QR Auto-Refresh (20s)** — Prevents screenshot sharing; server-side token regeneration
- **Camera QR Scanning** — Members scan via device camera (html5-qrcode)
- **Automatic Geolocation Capture** — Timestamp + location recorded on attendance
- **Duplicate Prevention** — Unique compound index `(meeting, user)` at database level
- **Attendance Reports** — Per-meeting and per-member views with CSV export
- **Online Meeting Attendance** — Shareable attendance links with Google Meet redirect
- **Protected Routes** — Frontend route guards by role

### Bonus / Creative
- **Geofencing** — Admin sets location + radius on an interactive MapLibre GL map; server validates distance via Haversine formula
- **QR Pause/Resume** — Pause auto-refresh without deactivating the meeting
- **Auto-Activation Service** — Meetings activate/deactivate automatically based on scheduled time
- **Participation Restrictions** — "Anyone" or "Selected Members" with a searchable picker
- **Google Workspace UI** — Styled to match Google Admin Console (Google Sans, Material Symbols, Google-colored accents)
- **GSAP Animated Login** — Floating dots, wave paths, pulsing GDG logo
- **CI/CD with GitHub Actions** — Auto-build and deploy to GitHub Pages on push
- **Token Auto-Retry** — API client auto-refreshes Firebase token on 401

---

## Architecture

```
┌─────────────────────────────────────┐
│      GitHub Pages (HTTPS)            │
│   React 19 SPA  ·  Vite 7           │
│   Firebase Auth (Google OAuth)       │
└──────────────┬──────────────────────┘
               │  REST API (Bearer Token)
               ▼
┌─────────────────────────────────────┐
│      Express 5 API Server            │
│   Firebase Admin SDK (Token          │
│   Verification + Revocation Check)   │
│   Role-Based Authorization           │
│   ┌─────────────────────────────┐    │
│   │  Background Services         │   │
│   │  • QR Auto-Refresh  (20s)    │   │
│   │  • Auto-Activation  (30s)    │   │
│   └─────────────────────────────┘    │
└──────────────┬──────────────────────┘
               │  Mongoose ODM
               ▼
┌─────────────────────────────────────┐
│           MongoDB                    │
│   users · meetings · attendances     │
└─────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React.js (Vite) | React 19.2.0 · Vite 7.3.1 |
| Backend | Node.js + Express | Express 5.2.1 |
| Database | MongoDB (Mongoose) | Mongoose 9.2.1 |
| Auth | Firebase Auth (Client + Admin SDK) | 12.9.0 · 13.6.1 |
| QR Generation | qrcode | 1.5.4 |
| QR Scanning | html5-qrcode | 2.3.8 |
| Maps | MapLibre GL JS | 5.18.0 |
| Animations | GSAP | 3.14.2 |
| Routing | React Router DOM | 7.13.0 |
| CI/CD | GitHub Actions → GitHub Pages | — |

---

## Project Structure

```
GDG-Attendence-System/
├── .github/workflows/deploy.yml    # CI/CD pipeline
├── GDG-ATTENDENCE-PORTAL/          # React frontend
│   ├── src/
│   │   ├── components/             # AppLayout, ProtectedRoute, RoleBasedRoute, ...
│   │   ├── config/                 # firebase.js, api.js (fetch wrapper)
│   │   ├── pages/
│   │   │   ├── admin/              # ManageMembers, ManageMeetings, Reports
│   │   │   ├── pr/                 # SelectMeeting, DisplayQR, DisplayLink
│   │   │   └── member/             # ScanQR, AttendanceSuccess, AttendOnline
│   │   ├── App.jsx                 # Route definitions
│   │   └── main.jsx                # Entry point (BrowserRouter)
│   ├── public/                     # Static assets, 404 SPA redirect
│   └── vite.config.js
├── GDG-ATTENDENCE-PORTAL-BACKEND/  # Express backend
│   ├── config/                     # Firebase Admin init, serviceAccountKey
│   ├── controllers/                # auth, users, meetings, attendance, reports
│   ├── middleware/                  # Firebase token verification
│   ├── models/                     # User, Meeting, Attendance (Mongoose)
│   ├── routes/                     # REST API route handlers
│   ├── services/                   # qrRefreshService, autoActivationService
│   └── server.js                   # Express app entry point
├── PROJECT-DOCS/                   # Submission & documentation
│   └── SUBMISSION.md
└── README.md
```

---

## User Roles

| Role | Capabilities |
|------|-------------|
| **Admin** | Full control — manage members, meetings, geofencing, participation rules, QR codes, reports, CSV export |
| **PR Team** | Display auto-refreshing QR codes at events, share online attendance links |
| **Member** | Scan QR to mark attendance, join online meetings via attendance links |

---

## API Endpoints

<details>
<summary><strong>Authentication</strong> — <code>/api/auth</code></summary>

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | ✅ | Sync Firebase user to MongoDB |
| GET | `/me` | ✅ | Get current user profile |
| PATCH | `/role` | ✅ Admin | Update a user's role |

</details>

<details>
<summary><strong>Users</strong> — <code>/api/users</code></summary>

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | ✅ Admin | List users (search, filter, paginate, sort) |
| GET | `/:id` | ✅ Admin | Get user by ID |
| DELETE | `/:id` | ✅ Admin | Delete user |

</details>

<details>
<summary><strong>Meetings</strong> — <code>/api/meetings</code></summary>

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/` | ✅ Admin | Create meeting |
| GET | `/` | ✅ | List meetings (search, filter, paginate, sort) |
| GET | `/active` | ✅ Admin/PR | Get active meetings |
| GET | `/:id` | ✅ | Get meeting by ID |
| GET | `/:id/qr-status` | ✅ Admin/PR | QR code + countdown |
| PATCH | `/:id` | ✅ Admin | Update meeting |
| DELETE | `/:id` | ✅ Admin | Delete meeting |
| POST | `/:id/generate-qr` | ✅ Admin | Generate QR code |
| POST | `/:id/generate-link` | ✅ Admin | Generate attendance token |
| PATCH | `/:id/toggle-active` | ✅ Admin | Toggle active status |
| PATCH | `/:id/qr-pause` | ✅ Admin | Toggle QR pause |

</details>

<details>
<summary><strong>Attendance</strong> — <code>/api/attendance</code></summary>

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/scan-qr` | ✅ | Submit QR-scanned attendance |
| GET | `/meeting/:meetingId` | ✅ Admin | Attendance records for a meeting |
| GET | `/:token/info` | ✅ | Meeting info for online link |
| POST | `/:token/mark` | ✅ | Mark attendance via link |

</details>

<details>
<summary><strong>Reports</strong> — <code>/api/reports</code></summary>

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/overview` | ✅ Admin | Overall statistics |
| GET | `/meetings` | ✅ Admin | Per-meeting attendance |
| GET | `/meetings/:meetingId` | ✅ Admin | Detailed attendance |
| GET | `/meetings/:meetingId/export` | ✅ Admin | CSV export (meeting) |
| GET | `/members` | ✅ Admin | Per-member summary |
| GET | `/export` | ✅ Admin | Full CSV export |

</details>

---

## Security

| Feature | How |
|---------|-----|
| **Authentication** | Firebase Auth (Google OAuth + Email/Password); backend verifies every request with Admin SDK + revocation check |
| **Authorization** | Server-side role check on every request (never trusts client tokens for role) |
| **Duplicate Prevention** | Unique compound index `(meeting, user)` — database-level guarantee |
| **Anti-Proxy Attendance** | QR refreshes every 20s (screenshot = invalid) + geofencing + time-window checks |
| **CORS** | Configurable allowed origins (no wildcard with credentials) |
| **Secrets** | All sensitive data in env vars; Firebase service keys gitignored; GitHub Actions secrets for CI/CD |
| **Token Refresh** | Frontend auto-retries on 401 `TokenExpired` with a fresh Firebase token |

---

## Getting Started

### Prerequisites

- **Node.js** 20+
- **MongoDB** instance (local, Docker/Podman, or Atlas)
- **Firebase** project with Authentication enabled (Google provider)
- Firebase Admin SDK service account key

### 1. Clone the Repository

```bash
git clone https://github.com/thisisharshavardhan/GDG-Attendence-System.git
cd GDG-Attendence-System
```

### 2. Backend Setup

```bash
cd GDG-ATTENDENCE-PORTAL-BACKEND
npm install
```

Create a `.env` file:

```env
MONGODB_URI=mongodb://user:pass@localhost:27017/gdg-attendance?authSource=admin
PORT=5000
CORS_ORIGIN=http://localhost:5173
SUPER_USER_EMAIL=your-admin@gmail.com
```

Place your Firebase service account key at `config/serviceAccountKey.json`, then:

```bash
npm run dev    # development (nodemon)
npm start      # production
```

### 3. Frontend Setup

```bash
cd GDG-ATTENDENCE-PORTAL
npm install
```

Create a `.env` file:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_API_URL=http://localhost:5000/api
```

```bash
npm run dev    # starts on http://localhost:5173
```

---

## Deployment

| Component | Platform |
|-----------|----------|
| Frontend | **GitHub Pages** via GitHub Actions CI/CD (auto-deploy on push to `main`) |
| Backend | VM with **Cloudflare Tunnel** for HTTPS |
| Database | MongoDB in container (Podman/Docker) |

---

## License

This project was built as part of a **GDG VITB Task** assignment.

---

<div align="center">

**Built by [Harsha Vardhan](https://github.com/thisisharshavardhan)**

</div>