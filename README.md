# Idoma Lifeline

Idoma Lifeline is an emergency resource mapping application designed to provide crucial information during crises. It allows users to view safe routes, report resources, and access critical data even when offline.

## Features
- **Public Map:** View civil infrastructure and emergency resources.
- **Offline Support:** Reload the saved app, read saved resources and previously viewed map tiles, and queue reports for automatic retry.
- **Report Resources:** Allows users to report new emergency resources.
- **Admin Dashboard:** Manage and verify reported resources.
- **Suggested Routes:** Check online driving routes against loaded verified hazards, with explicit warnings when hazards remain. New routes require internet.

## Tech Stack
- **Frontend:** React, Vite, Tailwind CSS
- **Backend:** Node.js, Express, SQLite locally or PostgreSQL/PostGIS
- **Deployment:** Docker support available (`docker-compose.yml`)

## Getting Started

### Prerequisites
- Node.js
- No database server needed for the local SQLite demo

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Abzmoni/idoma-lifeline.git
   ```

2. Install dependencies for the backend:
   ```bash
   cd backend
   npm install
   ```

3. Install dependencies for the frontend:
   ```bash
   cd ../frontend
   npm install
   ```

### Running the App Locally

1. Start the backend server:
   ```bash
   cd backend
   node server.js
   ```

2. Start the frontend development server:
   ```bash
   cd frontend
   npm run dev
   ```

## License
MIT

## Hackathon demo

Run `node tools/build-demo.cjs` to build against the local, same-origin API, then `npm run backend`. Open http://localhost:3000. See [DEMO.md](DEMO.md) for the three-minute script, location accuracy guidance and offline rehearsal checks.

Regression checks: `npm install --prefix tools`, then `node tools/build-demo.cjs` and `node tools/test-demo.cjs`. The checks create isolated SQLite test databases and browser screenshots in ignored `tools/artifacts/`; they do not reset existing application data. The browser check uses locally installed Chrome on Windows.
