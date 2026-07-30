

# Emergency Resource Mapping System — Technical Specification

**Purpose:** Idoma Centenary Plus hackathon entry
**Target platform:** Web app (installable PWA)
**Timebox:** 2 weeks, small team, strong engineering skill level

This document is a complete build spec, written so an engineering agent can implement the system from this file alone.

---

## 1. Problem statement

Communities in Idomaland are currently experiencing displacement due to insecurity (herder-related attacks and related violence in areas including Agatu and Apa). Displaced people and the coordinators helping them need a fast way to find and share the location of shelters, water points, medical stations, and food distribution — and to know which routes and areas are currently unsafe. Connectivity in these areas is unreliable, and many affected people do not have smartphones or data.

This system must work for:
- Someone with a smartphone and patchy data, looking for the nearest safe shelter
- Someone with only a basic feature phone and SMS
- A local coordinator or NGO volunteer verifying and managing reported information

## 2. Goals and non-goals

### Goals (in priority order)
1. A public map of verified emergency resources, usable offline after first load
2. Community + coordinator-submitted reports, with a lightweight verification step
3. An SMS-based fallback so feature-phone users can query and report without a smartphone
4. A simple admin view for coordinators to verify reports and manage the map

### Explicit non-goals (do not build these — they will consume time without adding to the demo)
- No user accounts or login for the public (reporting and viewing require no signup)
- No native mobile app — PWA only
- No real-time chat/messaging between users
- No payments or donation handling
- No traffic-aware or ML-based routing — a graph-based route that simply avoids flagged hazard zones is sufficient
- No full multi-language translation — build the i18n *structure* (externalized strings) but only fully populate English for the demo

## 3. User roles

| Role | Access | Primary need |
|---|---|---|
| Public user (smartphone) | No login | Find nearest resource, report a new one |
| Public user (feature phone) | Phone number only | Same, via SMS/USSD |
| Coordinator/Admin | Login required | Verify/reject reports, manage resources, view stats |

## 4. Functional requirements

### 4.1 Interactive resource map (MVP — must work flawlessly)
- Map view centered on the affected region by default, using OpenStreetMap tiles via Leaflet
- Resource types, each with a distinct marker color/icon: `shelter`, `water`, `medical`, `food`, `safe_zone`, `hazard`
- Layer toggle to show/hide each type
- Clicking a marker shows: name, type, short description, and (if present) capacity/contact info
- Only `verified` resources are shown to the public by default

### 4.2 Reporting flow (MVP)
- A simple form: type, name/description, location (pick on map or use device geolocation), optional contact phone
- On submit, creates a `report` with status `pending` — never appears on the public map until approved
- No login required to submit

### 4.3 Verification (MVP)
- Coordinators review pending reports in the admin dashboard and approve or reject
- Approving a report creates or updates a `resource` with status `verified`
- Rejected reports are kept (status `rejected`) for audit, not shown anywhere public

### 4.4 Offline-first behavior (MVP — this is the key differentiator, do not cut)
- The app is an installable PWA (manifest + service worker)
- Map tiles for the last-viewed region are cached locally
- The last successfully synced set of verified resources is cached in IndexedDB and rendered when the network is unavailable
- Reports submitted while offline are queued locally and sent automatically once connectivity returns
- A visible (but unobtrusive) banner indicates "offline — showing last synced data" when applicable

### 4.5 Safe-route guidance (MVP, simple version)
- Given a start and destination, return a route that avoids any area flagged `hazard`
- Implementation may be a straightforward graph/grid-based path avoidance — this does not need to be sophisticated, it needs to visibly demonstrate hazard-avoidance in the demo

### 4.6 SMS/USSD gateway (stretch — build this first if you only have time for one stretch feature)
See Section 11 for full command spec. Core idea: a feature-phone user can text a keyword and get back the nearest resource of that type, or submit a report by text.

### 4.7 Admin/coordinator dashboard (stretch, second priority)
See Section 12.

### 4.8 Multi-language string structure (stretch, third priority, low effort)
- All UI copy pulled from a single `strings.json` (or per-locale files) rather than hardcoded in components, so a second language can be dropped in later without refactoring

## 5. Non-functional requirements

- **Low-bandwidth performance:** default to a moderate zoom level, lazy-load markers only within the current viewport, keep initial bundle small (code-split the admin dashboard away from the public app)
- **Offline resilience:** the public map must remain usable with zero network connectivity after first load (see 4.4)
- **Security/privacy:** reporter contact info is visible only to admins, never rendered on the public map; rate-limit report submission per IP/phone number to deter spam; sanitize all free-text input server-side
- **Accessibility:** semantic HTML, alt text on icons, keyboard-navigable admin dashboard, sufficient color contrast on markers
- **Auth:** JWT-based session for admin/coordinator accounts only; all public GET endpoints are unauthenticated

## 6. System architecture

```
 Smartphone user                         Admin / coordinator
       |                                          |
       v                                          v
 +-----------------------------------------------------+
 |                    Core platform                    |
 |  +-----------+     +-------------+    +-----------+ |
 |  |  PWA app  | --> | API server  |--> | PostGIS DB| |
 |  | (map,     |     | (Node/      |    | (geo data)| |
 |  |  cache)   |     |  Express)   |    |           | |
 |  +-----------+     +-------------+    +-----------+ |
 +-----------------------------|------------------------+
                                |
                                v
                        +----------------+
                        |  SMS gateway   |
                        | (Africa's      |
                        |  Talking)      |
                        +----------------+
                                ^
                                |
                        Feature phone user
```

## 7. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React (Vite) + Leaflet + Tailwind | PWA via `vite-plugin-pwa` or hand-rolled service worker |
| Offline storage | IndexedDB via Dexie.js | Caches resources + queues pending offline reports |
| Backend | Node.js + Express | Or Supabase if the team wants auth/DB/realtime out of the box — either is acceptable |
| Database | PostgreSQL + PostGIS extension | Required for geospatial (`ST_DWithin`, nearest-neighbor) queries |
| SMS/USSD | Africa's Talking API | Sandbox account is free and sufficient for a demo |
| Auth | JWT (jsonwebtoken) + bcrypt for password hashing | Admin/coordinator accounts only |
| Hosting | Any PaaS reachable publicly (Render, Railway, Fly.io, etc.) | Must be a public URL for judges to try live |

## 8. Data model

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE resource_type AS ENUM ('shelter', 'water', 'medical', 'food', 'safe_zone', 'hazard');
CREATE TYPE resource_status AS ENUM ('verified', 'pending', 'flagged', 'archived');
CREATE TYPE report_source AS ENUM ('app', 'sms', 'admin');
CREATE TYPE report_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE user_role AS ENUM ('admin', 'moderator');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'moderator',
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type resource_type NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  location GEOGRAPHY(Point, 4326) NOT NULL,
  status resource_status NOT NULL DEFAULT 'pending',
  capacity INTEGER,
  contact_phone TEXT,
  source report_source NOT NULL DEFAULT 'app',
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX resources_location_idx ON resources USING GIST (location);

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES resources(id),
  type resource_type NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  location GEOGRAPHY(Point, 4326) NOT NULL,
  reporter_contact TEXT,
  source report_source NOT NULL DEFAULT 'app',
  status report_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  phone TEXT NOT NULL,
  message_body TEXT NOT NULL,
  parsed_command TEXT,
  related_report_id UUID REFERENCES reports(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 9. API specification

All responses are JSON. Public endpoints require no auth. Admin endpoints require `Authorization: Bearer <jwt>`.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/resources` | none | List resources. Query params: `type`, `bbox` (minLng,minLat,maxLng,maxLat), `status` (defaults to `verified` for public callers) |
| GET | `/api/resources/:id` | none | Single resource detail |
| POST | `/api/reports` | none | Submit a new report (rate-limited per IP) |
| GET | `/api/reports?status=pending` | admin | List reports for review |
| POST | `/api/reports/:id/approve` | admin | Approves report, creates/updates the linked resource as `verified` |
| POST | `/api/reports/:id/reject` | admin | Marks report `rejected` |
| POST | `/api/route` | none | Body: `{ start: {lat,lng}, end: {lat,lng} }`. Returns a path avoiding `hazard`-flagged resources |
| POST | `/api/sms/inbound` | webhook secret | Africa's Talking inbound SMS webhook |
| POST | `/api/sms/ussd` | webhook secret | Africa's Talking USSD session webhook |
| POST | `/api/auth/login` | none | `{ phone, password }` → returns JWT |
| GET | `/api/admin/stats` | admin | Counts: verified resources by type, pending reports, reports in last 24h |

Example — `POST /api/reports` request body:
```json
{
  "type": "water",
  "name": "Borehole near St. Mary's",
  "description": "Working as of this morning, queue forms early",
  "location": { "lat": 7.34, "lng": 8.13 },
  "reporter_contact": "+2348012345678",
  "source": "app"
}
```

## 10. Frontend specification

### Routes
- `/` — public map (default landing page)
- `/report` — new report form
- `/admin/login` — coordinator login
- `/admin` — dashboard: pending reports queue, full map (all statuses), stats
- `/admin/resources/:id` — edit/verify a single resource

### PWA / offline behavior
- `manifest.json` with app name, icons, `display: standalone`
- Service worker caching strategy:
  - App shell (JS/CSS/HTML): cache-first
  - Map tiles: cache-first with a size/age limit
  - `GET /api/resources`: network-first, falling back to the last cached IndexedDB snapshot on failure
  - Offline report submissions: written to an IndexedDB queue, retried automatically on reconnect (`online` event listener or Background Sync API)
- A small persistent indicator shows "Live" vs. "Offline — showing last synced data"

## 11. SMS/USSD specification

### SMS commands (inbound, case-insensitive)
| Command | Example | Behavior |
|---|---|---|
| `NEAR <place>` | `NEAR Otukpo market` | Reply with nearest 3 verified resources of any type |
| `WATER <place>` / `SHELTER <place>` / `MEDICAL <place>` / `FOOD <place>` | `WATER Otukpo market` | Reply with nearest resource of that type |
| `REPORT <type> <description>, <place>` | `REPORT shelter, church hall open, near Otukpo market` | Creates a `pending` report with `source = sms`, surfaced with priority in the admin queue |

Replies must stay within a single SMS segment where possible (~160 chars). Example reply:
```
1. Shelter - St. Mary's Church (2.1km)
2. Water - Borehole Rd 3 (2.8km)
3. Medical - Health post (3.4km)
```

### USSD flow (menu-driven, Africa's Talking session callback)
```
Welcome to [App name]
1. Find nearest resource
2. Report a resource or hazard
```
- Option 1 → sub-menu for type → prompt for nearest landmark as free text → return nearest match
- Option 2 → prompt for type → description → nearest landmark → creates `pending` report, `source = sms`

## 12. Admin dashboard specification

- Login screen (phone + password)
- Pending reports list, each showing: type, description, submitted location (shown on a small map), source (app/SMS), submitted time, and Approve/Reject buttons
- Full map view showing all statuses (verified, pending, flagged), color-coded
- Stats panel: total verified resources by type, pending count, reports in last 24 hours
- Approve action must be a single click with no extra confirmation step — coordinators may be reviewing many reports quickly during an active crisis

## 13. Seed / demo data requirements

For the pitch to land, sample data must use real, plausible local place names and realistic resource descriptions — not "Resource 1," "Resource 2." Seed at minimum:
- 8–12 verified resources spread across all types
- 3–4 pending reports (to demonstrate the verification flow live)
- 1–2 flagged hazard zones positioned so the safe-route demo visibly detours around them

## 14. Environment variables

```
DATABASE_URL=postgres://user:pass@host:5432/dbname
JWT_SECRET=
AFRICAS_TALKING_API_KEY=
AFRICAS_TALKING_USERNAME=
AFRICAS_TALKING_SHORTCODE=
SMS_WEBHOOK_SECRET=
PORT=3000
MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

## 15. Build order (mapped to a 2-week timeline)

1. **Days 1–3:** Repo scaffold, Docker Compose for Postgres+PostGIS, Express API skeleton, Vite/React frontend skeleton, Leaflet map rendering hardcoded points
2. **Days 4–7:** Real data model wired end to end (report → pending → admin approve → appears on map), offline caching (service worker + IndexedDB), basic auth for admin
3. **Days 8–11:** SMS/USSD integration against Africa's Talking sandbox, tested with real messages
4. **Days 12–13:** Seed realistic demo data, safe-route avoidance demo, UI polish, accessibility pass
5. **Day 14:** Full dry-run demo, timed, with a fallback plan if live network/SMS fails during judging (e.g., a recorded backup clip of the SMS flow)

## 16. Acceptance criteria (definition of done)

- [ ] Map loads and displays all 6 resource types with distinct markers
- [ ] A report can be submitted from the public form and appears in the admin queue within seconds
- [ ] Approving a report makes it visible on the public map immediately
- [ ] With network disabled (airplane mode), the map still shows the last-synced verified resources
- [ ] A report submitted while offline is queued and successfully sent once connectivity returns
- [ ] At least one full SMS round-trip works against the real Africa's Talking sandbox
- [ ] Safe-route request visibly avoids a flagged hazard zone
- [ ] Deployed to a public URL, functional on a mobile browser
- [ ] Full demo rehearsed and fits within the pitch time limit

## 17. Demo script (reference only, not for the agent to build)

1. Open with the real context: current displacement and insecurity in Idomaland
2. Show the live public map, filter by resource type
3. Submit a report live, switch to admin view, approve it, show it appear on the map
4. Toggle airplane mode, show the map still works
5. Send a live SMS command, show the reply arrive
6. Close by naming who would use this day one: community coordinators, NGOs, local leaders

---
