# Graph Report - emergency  (2026-11-25)

## Corpus Check
- 35 files · ~22,269 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 3, .css 3)

## Summary
- 320 nodes · 446 edges · 19 communities (16 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3396e708`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Emergency Resource Mapping System — Technical Specification
- MapPage.jsx
- frontend/package.json
- test-demo.cjs
- App.jsx
- backend/package.json
- server.js
- backend/db.js
- services
- Idoma Lifeline: hackathon rehearsal
- db
- scripts
- manifest.json
- .oxlintrc.json
- ShaderCanvas
- React + Vite
- sw.js

## God Nodes (most connected - your core abstractions)
1. `Emergency Resource Mapping System — Technical Specification` - 18 edges
2. `query()` - 16 edges
3. `MapPage()` - 12 edges
4. `react` - 11 edges
5. `react-router-dom` - 9 edges
6. `4. Functional requirements` - 9 edges
7. `App()` - 8 edges
8. `db` - 7 edges
9. `leaflet` - 7 edges
10. `services` - 7 edges

## Surprising Connections (you probably didn't know these)
- `start()` --calls--> `seedDatabase()`  [EXTRACTED]
  backend/server.js → backend/seed.js
- `App()` --calls--> `MapPage()`  [EXTRACTED]
  frontend/src/App.jsx → frontend/src/pages/MapPage.jsx
- `MapPage()` --calls--> `getDataStatus()`  [EXTRACTED]
  frontend/src/pages/MapPage.jsx → frontend/src/api.js
- `MapPage()` --calls--> `syncOfflineReports()`  [EXTRACTED]
  frontend/src/pages/MapPage.jsx → frontend/src/api.js
- `MapPage()` --calls--> `iconMarkup()`  [EXTRACTED]
  frontend/src/pages/MapPage.jsx → frontend/src/components/MapIcon.jsx

## Import Cycles
- None detected.

## Communities (19 total, 3 thin omitted)

### Community 0 - "Emergency Resource Mapping System — Technical Specification"
Cohesion: 0.06
Nodes (32): 10. Frontend specification, 11. SMS/USSD specification, 12. Admin dashboard specification, 13. Seed / demo data requirements, 14. Environment variables, 15. Build order (mapped to a 2-week timeline), 16. Acceptance criteria (definition of done), 17. Demo script (reference only, not for the agent to build) (+24 more)

### Community 1 - "MapPage.jsx"
Cohesion: 0.13
Nodes (23): dataStatus, getDataStatus(), isOnline(), request(), syncOfflineReports(), iconMarkup(), MapIcon(), paths (+15 more)

### Community 2 - "frontend/package.json"
Cohesion: 0.08
Nodes (30): dexie@^4.4.4, devDependencies, autoprefixer@^10.5.3, oxlint@^1.71.0, postcss@^8.5.19, tailwindcss@^4.3.2, @tailwindcss/postcss@^4.3.2, @types/react@^19.2.17 (+22 more)

### Community 3 - "test-demo.cjs"
Cohesion: 0.08
Nodes (16): playwright, { execFileSync }, path, devDependencies, playwright@1.64.1, name, private, scripts (+8 more)

### Community 4 - "App.jsx"
Cohesion: 0.14
Nodes (18): dependencies, leaflet@^1.9.4, react@^19.2.7, react-dom@^19.2.7, react-router-dom@^7.18.1, api, AdminDashboardPage, AdminLoginPage (+10 more)

### Community 5 - "backend/package.json"
Cohesion: 0.10
Nodes (25): dependencies, bcryptjs@^2.4.3, cors@^2.8.5, dotenv@^16.4.5, express@^4.19.2, jsonwebtoken@^9.0.2, pg@^8.11.5, sqlite3@^5.1.7 (+17 more)

### Community 6 - "server.js"
Cohesion: 0.09
Nodes (19): ADMIN, bcrypt, clearDemoData(), crypto, ensureAdmin(), insertResource(), REPORTS, RESOURCES (+11 more)

### Community 7 - "backend/db.js"
Cohesion: 0.15
Nodes (23): approveReport(), createReport(), createUser(), deg2rad(), fs, getAdminStats(), getDistance(), getReportById() (+15 more)

### Community 8 - "services"
Cohesion: 0.11
Nodes (18): databases, databaseName, name, plan, user, fromDatabase, generateValue, key (+10 more)

### Community 9 - "Idoma Lifeline: hackathon rehearsal"
Cohesion: 0.12
Nodes (15): Before going on stage, Claims to keep precise, Idoma Lifeline: hackathon rehearsal, Location on a laptop versus phone, Run the production app locally, Three-minute script, Features, Getting Started (+7 more)

### Community 10 - "db"
Cohesion: 0.13
Nodes (14): container_name, environment, image, ports, restart, volumes, POSTGRES_DB, POSTGRES_PASSWORD (+6 more)

### Community 11 - "scripts"
Cohesion: 0.20
Nodes (9): description, name, scripts, backend, build:frontend, frontend, install:all, start (+1 more)

### Community 12 - "manifest.json"
Cohesion: 0.22
Nodes (8): background_color, display, icons, name, orientation, short_name, start_url, theme_color

### Community 13 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 14 - "ShaderCanvas"
Cohesion: 0.50
Nodes (3): ShaderCanvas(), render(), syncSize()

### Community 15 - "React + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + Vite

## Knowledge Gaps
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `App.jsx` to `MapPage.jsx`, `frontend/package.json`, `ShaderCanvas`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Should `Emergency Resource Mapping System — Technical Specification` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._
- **Why does `@vitejs/plugin-react` connect `frontend/package.json` to `test-demo.cjs`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Should `MapPage.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13306451612903225 - nodes in this community are weakly interconnected._
- **Why does `vite` connect `frontend/package.json` to `test-demo.cjs`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Should `frontend/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08387096774193549 - nodes in this community are weakly interconnected._
- **Should `test-demo.cjs` be split into smaller, more focused modules?**
  _Cohesion score 0.07635467980295567 - nodes in this community are weakly interconnected._