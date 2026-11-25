# Idoma Lifeline: hackathon readiness review

Prepared 25 November 2026 for the Idoma Centenary Hackathon. Project map built with graphify (`graphify-out/GRAPH_REPORT.md`, `graphify-out/graph.html`).

## 1. What graphify shows

Code-only graph (tree-sitter, no LLM): **35 files, 320 nodes, 446 edges, 19 communities, no import cycles.** Third-party folders (`tmp/`, `output/`, `node_modules/`) are excluded via `.graphifyignore`.

| Subsystem (community) | Core nodes | What it does |
|---|---|---|
| Public map | `MapPage()`, `api.js` (`getDataStatus`, `syncOfflineReports`, `isOnline`), `MapIcon` | Leaflet map, six category filters, list view, freshness, online/offline status |
| Reporting & offline | `ReportPage`, `db.js` (Dexie/IndexedDB), `sw.js` | Report form, pin confirmation, on-device queue, retry with `client_request_id` deduplication |
| Routing | `routing.js` → OSRM | Road route plus a check against verified hazards, with a warning when a hazard remains on the route |
| Coordinator | `AdminDashboardPage`, `ResourceEditPage`, `/api/reports/:id/approve` | Review queue, approve/reject, edit, stats, SMS logs, demo reset |
| API | `server.js` (16 routes), `query()` is the main hub (16 edges) | REST API, JWT auth, SMS (`NEAR`, `WATER <place>`, `REPORT …`), USSD menu tree |
| Data | `backend/db.js` | SQLite by default, PostgreSQL/PostGIS when `DATABASE_URL` is set, Haversine distance |
| Quality | `tools/test-demo.cjs` (Playwright) | End-to-end checks with isolated test databases and screenshots |

The most-connected node is the technical spec (`build.md`, 18 edges), followed by the shared `query()` data layer and `MapPage()`. The architecture is shallow and easy to follow, which makes it easy to explain on stage.

## 2. Scorecard against the judging criteria

Scores are my estimate of how the current build and pitch would land with judges, before and after the recommended changes.

| Criterion | Weight | Now | With fixes | Evidence / gap |
|---|---|---|---|---|
| Innovation & creativity | 20 | 14 | 18 | One verified directory reaches people through three channels (online, offline cache, USSD). **Gap:** English only. An Idoma-language toggle and USSD menu fit the centenary theme. |
| Technical execution | 20 | 16 | 18 | Working PWA with offline queue, deduplication, PostGIS option and end-to-end tests. **Gaps:** USSD is simulated; routing depends on the public OSRM server; the JWT secret falls back to a hard-coded default; the USSD gazetteer covers only three landmarks. |
| Problem relevance | 15 | 14 | 15 | Displacement in Benue is real and current (about 464k displaced, per IOM). |
| Social / economic impact | 15 | 10 | 13 | There is no measured impact yet. Fix: state targets as KPIs (time-to-help, report review time, basic-phone reach) and tie them to SDGs. |
| Practicality & feasibility | 10 | 8 | 9 | Already built and deployable (Render, Docker). The pilot is costed. |
| Scalability | 10 | 6 | 8 | Each deployment is single-tenant. Fix: present a multi-tenant "workspace per state/LGA" roadmap and the state-agnostic data model. |
| Presentation | 5 | 4 | 5 | The demo script is strong and honest. The deck needs a sharper investor story (see below). |
| Sustainability | 5 | 2 | 5 | The earlier proposal named revenue streams but gave no pricing, unit economics or path to break-even. That is fixed in the new deck. |
| **Total** | **100** | **74** | **91** | |

## 3. Highest-leverage fixes before demo day (ranked)

**Status (25 Nov 2026):** fixes 1–5 are implemented and covered by `tools/test-demo.cjs`. The language switch ships English and Pidgin; the Idoma option appears automatically once native speakers fill the `IDU` table in `frontend/src/i18n.js` (and an `idu` entry in `USSD_TEXT` in `backend/server.js`). The gazetteer already had 19 Otukpo-area landmarks; the error message only named three. It now also covers every Idoma LGA headquarters (approximate town centres, to confirm locally). Fix 6 (backup video) is still to do.

1. **Idoma language toggle (English / Idoma / Pidgin)** on the map UI and USSD menu. This speaks directly to the "Culture, language and heritage" area and the centenary judges. The spec already externalises strings, so the change is small. Get the translations checked by a native speaker.
2. **Set `JWT_SECRET` in `render.yaml`** (`generateValue: true`) and remove the hard-coded fallback in production. Judges who read code notice this kind of thing.
3. **Expand the USSD/SMS gazetteer** from 3 landmarks to the main towns of Agatu, Apa, Ogbadibo, Otukpo and Okpokwu. Right now a judge who types any other place gets "Landmark not recognised".
4. **Freshness badges:** mark records not re-verified within 72 hours as "may be outdated". The `verified_at` field already exists, so this is cheap and makes the trust story visible.
5. **Impact panel on the coordinator dashboard:** median report-to-approval time, reports by channel, basic-phone share. This turns impact from a claim into a number you can show live.
6. **Record a 90-second backup video** of the demo (DEMO.md already recommends this).

## 4. Business model (investor version)

**Principle: always free for citizens; institutions pay.** This is a B2G and B2NGO model with government and NGOs as payers, the same shape as other public-safety platforms.

| Stream | Payer | Price (proposed) | Notes |
|---|---|---|---|
| State Command licence | State Emergency Management Agencies (SEMA) | ₦12M / state / year | All LGAs in the state, coordinator seats, analytics, SLA |
| LGA licence | LGA councils (where no state deal exists) | ₦1.5M / LGA / year | Entry product and land-and-expand path into the state licence |
| Humanitarian deployment | NGOs and UN agencies (camp management, WASH, health) | ₦5M / programme / year | White-label workspace, their own resource layers |
| Setup, training & verification network | All customers | ₦1–3M one-off | Onboarding, coordinator training, gazetteer build |
| Sponsored USSD access | Telcos / Universal Service Provision Fund / CSR | Session cost + margin | Keeps the shortcode free for residents |
| Needs-insight reports | Planners and donors | ₦2M / year add-on | Aggregated and anonymised demand heatmaps, no personal data |

**Unit economics (assumption):** serving one LGA costs about ₦0.6M a year (hosting share, USSD/SMS sessions, support), so an LGA licence earns about 60% gross margin. A state licence earns more, because hosting is shared.

**Illustrative revenue path (targets, not traction):**

| Year | Customers | Revenue |
|---|---|---|
| Y1 (2027) | Pilot plus 1 NGO deployment | ₦6M, plus the ₦8M pilot grant |
| Y2 (2028) | Benue SEMA, 2 NGOs, setup, analytics | ₦28M |
| Y3 (2029) | 3 states, 5 NGOs, USSD sponsorship | ₦80M (break-even) |

**Market sizing:** TAM is about ₦1.6B a year from government alone (37 SEMAs at ₦12M plus 774 LGAs at ₦1.5M), before NGOs and ECOWAS expansion. SAM is about ₦0.6B in the conflict-affected north-central, north-west and north-east states. The Year 3 target captures about 13% of SAM.

**Moat:** a verified local coordinator network and a curated gazetteer (hard to copy), an offline and USSD stack built for 2G conditions, local-language access, and institutional switching costs once a state runs its response on the platform.

## 5. Claims to keep precise on stage

- USSD and SMS run in a simulator, and a live shortcode is part of the pilot. Say so.
- All map data is sample data, and no partners are signed. Say "proposed partners" (SEMA Benue, IOM, NRC, Red Cross).
- Revenue figures are pricing-based targets, not sales.

## Sources

- Benue: about 464,000 people displaced (IOM Chief of Mission, via the [Federal Ministry of Information](https://fmino.gov.ng/hyacinth-iormem-alia-launches-2026-2028-contingency-plan-as-eu-fg-iom-deepen-support-for-idps-in-gwer-west/))
- Nigeria: about 3.7M IDPs in early 2026 (secondary reporting, e.g. [Vanguard](https://www.vanguardngr.com/?p=2842303)). DTM North-Central/North-West Round 18: [ReliefWeb](https://reliefweb.int/report/nigeria/nigeria-north-central-and-north-west-round-18-idp-and-returnee-atlas-october-2025)
- 2G holds about 36% of mobile market share (NCC data via [ThisDay, Oct 2026](https://www.thisdaylive.com/2026/10/29/5g-penetration-drags-as-4g-2g-lead-in-market-share-across-networks/)). Mobile subscriptions are about 200M ([Innovation Village](https://innovation-village.com/nigerias-mobile-subscriptions-rebound-to-200-million-as-mtn-and-airtel-tighten-market-dominance/))
