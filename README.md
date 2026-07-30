# Idoma Lifeline

Idoma Lifeline is an emergency resource mapping application designed to provide crucial information during crises. It allows users to view safe routes, report resources, and access critical data even when offline.

## Features
- **Public Map:** View civil infrastructure and emergency resources.
- **Offline Support:** Access maps and resources even without an internet connection using Service Workers.
- **Report Resources:** Allows users to report new emergency resources.
- **Admin Dashboard:** Manage and verify reported resources.
- **Safe Routes:** View safe paths during emergencies.

## Tech Stack
- **Frontend:** React, Vite, Tailwind CSS
- **Backend:** Node.js, Express, MongoDB
- **Deployment:** Docker support available (`docker-compose.yml`)

## Getting Started

### Prerequisites
- Node.js
- MongoDB

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
