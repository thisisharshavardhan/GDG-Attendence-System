# GDG QR-Based Attendance Portal — Submission Document

**Submitted by:** Harsha Vardhan  
**Date:** February 15, 2026  
**GitHub Repository:** [https://github.com/thisisharshavardhan/GDG-Attendence-System](https://github.com/thisisharshavardhan/GDG-Attendence-System)  
**Live Demo (Frontend):** [https://thisisharshavardhan.github.io/GDG-Attendence-System/](https://thisisharshavardhan.github.io/GDG-Attendence-System/)

---

## 1. Task Overview

A **secure and scalable attendance management portal** using QR codes to track attendance for both **offline and online meetings**. The system ensures accurate attendance logging with details such as time, member identity, and location, while maintaining proper authentication and structured data storage.

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React.js (Vite) | React 19.2.0, Vite 7.3.1 |
| **Backend** | Node.js + Express | Express 5.2.1 |
| **Database** | MongoDB (Mongoose ODM) | Mongoose 9.2.1 |
| **Authentication** | Firebase Auth (Client + Admin SDK) | firebase 12.9.0, firebase-admin 13.6.1 |
| **QR Generation** | qrcode (Node.js) | 1.5.4 |
| **QR Scanning** | html5-qrcode | 2.3.8 |
| **Maps** | MapLibre GL JS | 5.18.0 |
| **Animations** | GSAP | 3.14.2 |
| **Routing** | React Router DOM | 7.13.0 |
| **CI/CD** | GitHub Actions | GitHub Pages deployment |

---

## 3. System Architecture

```
┌─────────────────────────────────┐
│        GitHub Pages (HTTPS)      │
│    React 19 SPA + Vite 7         │
│   Firebase Auth (Google OAuth)   │
└────────────┬────────────────────┘
             │ REST API (Bearer Token)
             ▼
┌─────────────────────────────────┐
│     Express 5 API Server         │
│  Firebase Admin SDK (ID Token    │
│  Verification + Revocation Check)│
│  Role-Based Authorization        │
│  ┌───────────────────────────┐   │
│  │  Background Services      │   │
│  │  • QR Auto-Refresh (20s)  │   │
│  │  • Auto-Activation (30s)  │   │
│  └───────────────────────────┘   │
└────────────┬────────────────────┘
             │ Mongoose ODM
             ▼
┌─────────────────────────────────┐
│         MongoDB                  │
│  Collections:                    │
│  • users    (role, firebaseUid)  │
│  • meetings (QR, geofencing)     │
│  • attendances (unique compound) │
└─────────────────────────────────┘
```

---

## 4. User Roles & Permissions

### Admin
- Create, edit, and delete members
- Create, edit, and delete meetings (offline/online)
- Configure geofencing (map-based location + radius)
- Configure participation restrictions (anyone / selected members)
- Generate and manage QR codes with auto-refresh
- Generate attendance links for online meetings
- View reports, analytics, and export attendance data (CSV)

### PR Team
- Log into the portal
- Select an active meeting
- Display the auto-refreshing QR code during offline events (fullscreen with countdown timer)
- Display and share the attendance link for online events

### Member
- Scan the QR code using device camera to mark attendance
- Join online meetings via attendance link (auto-opens Google Meet)
- Automatic capture of timestamp and geolocation

---

## 5. Features Implemented

### ✅ Core Features

| # | Feature | Status |
|---|---------|--------|
| 1 | Firebase Authentication (Google Sign-In + Email/Password) | ✅ Completed |
| 2 | Role-Based Access Control (Admin / PR / Member) | ✅ Completed |
| 3 | Create and manage members (CRUD, search, filter, pagination, sort) | ✅ Completed |
| 4 | Create and manage meetings — offline and online (full CRUD) | ✅ Completed |
| 5 | Generate unique QR code per meeting | ✅ Completed |
| 6 | QR auto-refresh every 20 seconds (prevents screenshot sharing) | ✅ Completed |
| 7 | PR team display QR code page with real-time countdown timer | ✅ Completed |
| 8 | Member scans QR via device camera and marks attendance | ✅ Completed |
| 9 | Automatic timestamp and geolocation capture on attendance | ✅ Completed |
| 10 | Duplicate attendance prevention (unique compound index) | ✅ Completed |
| 11 | Attendance reports with per-meeting and per-member views | ✅ Completed |
| 12 | CSV export (per-meeting + full export) | ✅ Completed |
| 13 | Online meeting attendance via shareable link | ✅ Completed |
| 14 | Protected and role-based frontend routes | ✅ Completed |

### ✅ Bonus / Creative Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Geofencing** | Admin sets meeting location on an interactive MapLibre GL map with adjustable radius (10–5000m). Server validates attendee distance using the Haversine formula. |
| 2 | **QR Auto-Refresh (20s cycle)** | Background service regenerates QR tokens every 20 seconds server-side, preventing QR screenshot sharing. Frontend syncs via countdown. |
| 3 | **QR Pause/Resume** | Admin can pause QR auto-refresh for a meeting without deactivating it. |
| 4 | **Auto-Activation Service** | Background service automatically activates meetings when their scheduled time arrives and deactivates them when duration expires. Auto-generates QR/attendance tokens. |
| 5 | **Participation Restrictions** | Meetings can be set to "anyone" or "selected members" only, with a searchable member picker in the admin UI. |
| 6 | **Online Meeting Attendance** | Unique attendance token links (`/attend/:token`) that validate the user, mark attendance, and auto-open the Google Meet link. |
| 7 | **Google Workspace UI Design** | Entire portal styled to match Google Admin Console / Google Workspace aesthetic (Google Sans font, Material Symbols Outlined icons, Google-colored accents). |
| 8 | **GSAP Animated Login Page** | Login page with animated floating dots, wave paths, pulsing GDG logo, and smooth transitions. |
| 9 | **CI/CD with GitHub Actions** | Automated build and deployment to GitHub Pages on every push to main. Firebase secrets injected via GitHub repository secrets. |
| 10 | **Token Auto-Retry** | API client automatically retries requests with a fresh Firebase token on 401 TokenExpired errors. |

---

## 6. Data Models

### User
| Field | Type | Details |
|-------|------|---------|
| firebaseUid | String | Unique Firebase UID (indexed) |
| email | String | Unique, lowercase |
| name | String | Display name |
| photoURL | String | Profile picture |
| role | Enum | `admin`, `pr`, `member` (default: member) |
| timestamps | Auto | createdAt, updatedAt |

### Meeting
| Field | Type | Details |
|-------|------|---------|
| title | String | Required, max 200 chars |
| description | String | Optional, max 2000 chars |
| type | Enum | `offline`, `online` |
| dateTime | Date | Scheduled meeting time |
| duration | Number | Minutes (5–720, default 60) |
| location | String | Physical location (offline) |
| meetingLink | String | Google Meet / Zoom URL (online) |
| qrCode | String | Base64 QR image (auto-refreshed) |
| qrData | String | JSON payload in QR |
| attendanceToken | String | Unique token for online attendance links |
| createdBy | ObjectId → User | Meeting creator |
| isActive | Boolean | Currently accepting attendance |
| qrPaused | Boolean | QR auto-refresh paused |
| participation | Enum | `anyone`, `selected` |
| allowedParticipants | [ObjectId → User] | Selected participant list |
| geofencingEnabled | Boolean | Location validation enabled |
| geofencingLat / geofencingLng | Number | Center coordinates |
| geofencingRadius | Number | Radius in metres (10–5000) |

### Attendance
| Field | Type | Details |
|-------|------|---------|
| meeting | ObjectId → Meeting | Required |
| user | ObjectId → User | Required |
| method | Enum | `qr`, `link` |
| markedAt | Date | Attendance timestamp |
| latitude / longitude | Number | Geolocation coordinates |
| accuracy | Number | GPS accuracy in metres |
| *Unique index* | | `(meeting, user)` — prevents duplicate attendance |

---

## 7. API Endpoints

### Authentication (`/api/auth`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | ✅ | Sync Firebase user to MongoDB |
| GET | `/me` | ✅ | Get current user profile |
| PATCH | `/role` | ✅ Admin | Update a user's role |

### Users (`/api/users`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | ✅ Admin | List users (search, filter, paginate, sort) |
| GET | `/:id` | ✅ Admin | Get user by ID |
| DELETE | `/:id` | ✅ Admin | Delete user (with safeguards) |

### Meetings (`/api/meetings`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/` | ✅ Admin | Create meeting |
| GET | `/` | ✅ | List meetings (search, filter, paginate, sort) |
| GET | `/active` | ✅ Admin/PR | Get active meetings |
| GET | `/:id` | ✅ | Get meeting by ID |
| GET | `/:id/qr-status` | ✅ Admin/PR | Get current QR code + seconds until next refresh |
| PATCH | `/:id` | ✅ Admin | Update meeting |
| DELETE | `/:id` | ✅ Admin | Delete meeting |
| POST | `/:id/generate-qr` | ✅ Admin | Generate QR code |
| POST | `/:id/generate-link` | ✅ Admin | Generate online attendance token |
| PATCH | `/:id/toggle-active` | ✅ Admin | Toggle active status |
| PATCH | `/:id/qr-pause` | ✅ Admin | Toggle QR auto-refresh pause |

### Attendance (`/api/attendance`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/scan-qr` | ✅ | Submit QR-scanned attendance (with geofencing validation) |
| GET | `/meeting/:meetingId` | ✅ Admin | Get attendance records for a meeting |
| GET | `/:token/info` | ✅ | Get meeting info for online attendance link |
| POST | `/:token/mark` | ✅ | Mark attendance via online link |

### Reports (`/api/reports`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/overview` | ✅ Admin | Overall statistics (aggregation pipeline) |
| GET | `/meetings` | ✅ Admin | Per-meeting attendance counts |
| GET | `/meetings/:meetingId` | ✅ Admin | Detailed attendance for one meeting |
| GET | `/meetings/:meetingId/export` | ✅ Admin | CSV export for one meeting |
| GET | `/members` | ✅ Admin | Per-member attendance summary |
| GET | `/export` | ✅ Admin | Full attendance CSV export |

---

## 8. Security Implementation

| Feature | Implementation |
|---------|---------------|
| **Authentication** | Firebase Auth (Google OAuth + Email/Password). Backend verifies every request using Firebase Admin SDK with revocation check. |
| **Role-Based Authorization** | Backend middleware queries MongoDB for user role on every request (never trusts client-side tokens for role). Frontend has `ProtectedRoute`, `PublicRoute`, and `RoleBasedRoute` guard components. |
| **Duplicate Prevention** | Unique compound index `(meeting, user)` on Attendance collection — database-level guarantee. |
| **Proxy Attendance Prevention** | QR auto-refresh every 20 seconds (screenshot becomes invalid). Geofencing with Haversine distance validation. Time-window checks (meeting must be active). |
| **CORS** | Configurable allowed origins via environment variable (no wildcard with credentials). |
| **Secrets Management** | Environment variables for all sensitive data. Firebase service account keys gitignored. GitHub Actions secrets for CI/CD build. |
| **Token Auto-Refresh** | Frontend API client detects 401 TokenExpired and retries with force-refreshed Firebase token. |
| **COOP Header** | `Cross-Origin-Opener-Policy: same-origin-allow-popups` for Firebase popup OAuth compatibility. |

---

## 9. Background Services

### QR Auto-Refresh Service
- Runs every **20 seconds** on the server
- Finds all active meetings with QR codes that are not paused
- Generates a new `crypto.randomBytes(16)` token for each
- Recreates the QR code image (400px, error correction level H)
- Atomically updates the meeting document
- Exposed `getSecondsUntilNextRefresh()` for client sync

### Auto-Activation Service
- Runs every **30 seconds** on the server
- **Activates** meetings when current time enters the scheduled window (`dateTime` to `dateTime + duration`)
- **Deactivates** meetings when the window expires
- Auto-generates QR codes (offline) or attendance tokens (online) on activation
- Clears QR/token data on deactivation

---

## 10. Workflow

1. **Admin creates members** — Users sign in with Google, admin assigns roles (admin/PR/member)
2. **Admin creates meetings** — Specifies title, type (offline/online), date/time, duration, location/link, geofencing, participation restrictions
3. **Auto-activation** — Meeting automatically activates when its scheduled time arrives; QR code or attendance token is auto-generated
4. **PR displays QR** — PR team logs in, selects active meeting, displays auto-refreshing QR code with countdown timer on a projector/screen
5. **Members scan QR** — Members open their phone camera in the portal, scan the displayed QR code. The system validates the token, checks geofencing, checks time window, checks participation eligibility, prevents duplicates, and records attendance with timestamp + location
6. **Online attendance** — For online meetings, admin/PR shares the attendance link. Members click it, the system validates and marks attendance, then auto-opens the Google Meet link
7. **Reports & Export** — Admin views summary statistics, per-meeting attendance tables, per-member summaries, and exports data as CSV

---

## 11. Frontend Pages

| Page | Path | Role | Description |
|------|------|------|-------------|
| Login | `/login` | Public | Google-themed with GSAP animations, Google Sign-In + email/password |
| Dashboard | `/dashboard` | All | Role-based quick-action cards |
| Manage Members | `/admin/members` | Admin | Table with search, role filter, inline role edit, delete, pagination |
| Manage Meetings | `/admin/meetings` | Admin | Full CRUD, geofencing map, participation picker, QR management |
| Reports | `/admin/reports` | Admin | Summary cards, meetings tab, members tab, CSV export |
| Select Meeting | `/pr/select-meeting` | PR/Admin | Active meeting cards with status badges |
| Display QR | `/pr/display-qr/:meetingId` | PR/Admin | Fullscreen QR with SVG countdown, auto-refresh sync |
| Display Link | `/pr/display-link/:meetingId` | PR/Admin | Online attendance link display with copy button |
| Scan QR | `/member/scan-qr` | All | Camera viewfinder with html5-qrcode, auto-geolocation |
| Attendance Success | `/member/attendance-success` | All | Confirmation page with meeting details |
| Attend Online | `/attend/:token` | All | Online meeting attendance + Google Meet redirect |
| 404 | `*` | Any | Google-styled not found page |

---

## 12. Deployment

| Component | Platform | URL |
|-----------|----------|-----|
| **Frontend** | GitHub Pages (via GitHub Actions CI/CD) | `https://thisisharshavardhan.github.io/GDG-Attendence-System/` |
| **Backend** | VM with Cloudflare Tunnel (HTTPS) | Tunneled via `cloudflared` |
| **Database** | MongoDB (containerized) | Localhost on VM |

### CI/CD Pipeline
- **Trigger:** Push to `main` branch or manual dispatch
- **Build:** Node.js 20, `npm ci`, `npm run build` with Firebase secrets injected from GitHub repository secrets
- **Deploy:** `actions/deploy-pages@v4` to GitHub Pages

---

## 13. Setup Instructions

### Prerequisites
- Node.js 20+
- MongoDB instance
- Firebase project with Authentication enabled (Google provider)
- Firebase Admin SDK service account key

### Backend Setup
```bash
cd GDG-ATTENDENCE-PORTAL-BACKEND
npm install
# Create .env file with:
#   MONGODB_URI=mongodb://...
#   PORT=5000
#   CORS_ORIGIN=http://localhost:5173
#   SUPER_USER_EMAIL=your-admin@gmail.com
# Place Firebase service account key at config/serviceAccountKey.json
node server.js
```

### Frontend Setup
```bash
cd GDG-ATTENDENCE-PORTAL
npm install
# Create .env file with:
#   VITE_FIREBASE_API_KEY=...
#   VITE_FIREBASE_AUTH_DOMAIN=...
#   VITE_FIREBASE_PROJECT_ID=...
#   VITE_FIREBASE_STORAGE_BUCKET=...
#   VITE_FIREBASE_MESSAGING_SENDER_ID=...
#   VITE_FIREBASE_APP_ID=...
#   VITE_API_URL=http://localhost:5000/api
npm run dev
```

---

## 14. Submission Checklist

| Item | Description | Status |
|------|-------------|--------|
| **GitHub Repository** | Public repository with complete source code | ✅ [Link](https://github.com/thisisharshavardhan/GDG-Attendence-System) |
| **Deployed URL** | Live working demo | ✅ [Link](https://thisisharshavardhan.github.io/GDG-Attendence-System/) |
| **Technical Documentation** | Architecture, features, tech stack, setup | ✅ This document |
| **Features Implemented** | Core features + bonus features | ✅ Listed above (14 core + 10 bonus) |

---

## 15. Contact

For any questions regarding this submission:  
**Email:** thisisharshavardhan@gmail.com  
**GitHub:** [thisisharshavardhan](https://github.com/thisisharshavardhan)
