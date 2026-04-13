# MyTick

Full-stack task management app with web, mobile, and API.

## Structure

```
backend/    Express + MongoDB API
frontend/   React + Vite web app
mobile/     Expo React Native app
```

## Setup

### Prerequisites
- Node.js 20+
- MongoDB (local or Atlas)

### Backend

```bash
cd backend
cp .env.example .env   # edit with your values
npm install
npm run migrate        # run database migrations
npm run dev            # start API server (port 4000)
npm run mcp:dev        # start MCP server (port 3100)
npm run notify:dev     # start notification worker
npm test               # run tests
```

Required env vars in `backend/.env`:
```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret
ADMIN_API_KEY=your-admin-key
```

### Frontend

```bash
cd frontend
npm install
npm run dev            # start dev server (port 5173)
```

Optional env var:
```
VITE_API_URL=http://localhost:4000/api   # defaults to this
```

### Mobile

```bash
cd mobile
npm install
EXPO_PUBLIC_API_URL=http://<your-local-ip>:4000/api npx expo start
```

For EAS builds, set the secret:
```bash
eas secret:create --name EXPO_PUBLIC_API_URL --value "https://your-backend.com/api" --type string --scope project
```

Build commands:
```bash
eas build --platform android --profile preview   # test APK
eas build --platform android --profile production # production
eas build --platform ios --profile production     # iOS
```

## Deployment

### Backend (Render)
- Build: `npm install && npm run build`
- Start: `npm start`
- Set env vars: `MONGODB_URI`, `JWT_SECRET`, `ADMIN_API_KEY`
- Health check: `/api/health`

### Frontend (Firebase Hosting)
- Auto-deploys via GitHub Actions on push to `main`
- Set `VITE_API_URL` as GitHub Actions secret

### Database Migrations
Run after deploying schema changes:
```bash
npm run migrate
```
Migrations track execution in `_migrations` collection — safe to run multiple times.

## API Docs
Available in dev at `http://localhost:4000/api/docs` (Swagger UI).
Disabled in production.
