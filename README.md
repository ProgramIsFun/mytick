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
cp .env.example .env   # edit with your values
npm install
```

#### Development (Expo Go)

```bash
npx expo start         # scan QR code with Expo Go app
```

Set your Mac's IP in `.env` so the phone can reach the backend:
```
EXPO_PUBLIC_API_URL=http://192.168.x.x:4000/api
```

#### Build APK locally

Prerequisites: Java 17, Android SDK
```bash
export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
./scripts/build-local.sh
```

The APK will be output in the `mobile/` directory.

#### Build APK via EAS (cloud)

```bash
eas build --platform android --profile preview
```

EAS environment variables (set via `eas env:update`):
- `EXPO_PUBLIC_API_URL` — backend API URL
- `GOOGLE_SERVICES_JSON` — Firebase config (file type)

#### Install APK on device

```bash
adb install build-*.apk
```

#### Debug screen

Tap the "MyTick" title on the login screen 7 times to open the debug screen. From there you can view and change the API URL at runtime without rebuilding.

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
