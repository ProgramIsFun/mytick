# Render Backend Deployment - Environment Variables

## Required Variables (6)

### 1. **MONGODB_URI** ✅ REQUIRED
```
mongodb+srv://username:password@cluster.mongodb.net/database
```
- **Purpose**: Database connection string
- **Where to get**: MongoDB Atlas → Database → Connect → Connection String
- **Example**: `mongodb+srv://user:pass@cluster.g9ry4na.mongodb.net/mytick`

### 2. **JWT_SECRET** ✅ REQUIRED
```
Random secure string (min 32 characters)
```
- **Purpose**: Sign JWT tokens for user authentication
- **Generate**: `openssl rand -base64 32` or use password generator
- **Example**: `Kx7j9m2P5qR8sW0zT3vY6bN4cF1hL0aD`

### 3. **ADMIN_API_KEY** ✅ REQUIRED
```
Random secure string
```
- **Purpose**: Admin-level API access (used by CLI, scripts)
- **Generate**: `openssl rand -hex 32`
- **Example**: `mytick-admin-key-f8e9d7c6b5a4`

### 4. **FIREBASE_SERVICE_ACCOUNT** ✅ REQUIRED (for push notifications)
```json
{"type":"service_account","project_id":"mytick-abc123","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-...@mytick-abc123.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}
```
- **Purpose**: Firebase Cloud Messaging (push notifications)
- **Where to get**: Firebase Console → Project Settings → Service Accounts → Generate New Private Key
- **Note**: Single-line JSON string (remove all newlines except in private_key)

### 5. **PORT** ⚠️ AUTO-SET BY RENDER
```
Auto-assigned by Render (usually 10000)
```
- **Purpose**: HTTP server port
- **Default**: 4000 (development)
- **Render**: Sets this automatically, no need to configure

### 6. **NODE_ENV** ⚠️ AUTO-SET BY RENDER
```
production
```
- **Purpose**: Enable production optimizations
- **Render**: Sets to `production` automatically

---

## Optional Variables (3)

### 7. **REDIS_URL** 🔵 OPTIONAL
```
redis://red-xxxxx:6379
```
- **Purpose**: Queue for scheduled notifications (BullMQ)
- **When needed**: If using scheduled task notifications
- **Render**: Add Redis instance, Render provides URL automatically
- **Default behavior**: Works without Redis (notifications sent immediately)

### 8. **LOG_LEVEL** 🔵 OPTIONAL
```
info | debug | warn | error
```
- **Purpose**: Control logging verbosity
- **Default**: `info`
- **Recommendation**: Use `info` for production, `debug` for troubleshooting

### 9. **API_URL** 🔵 OPTIONAL
```
https://api.mytick.app
```
- **Purpose**: Used by notification worker to call API
- **Default**: `http://localhost:4000/api`
- **Set to**: Your Render backend URL (e.g., `https://mytick-api.onrender.com/api`)

---

## Quick Setup Checklist

### Minimum Required (4 variables to set manually):
- [ ] `MONGODB_URI` - From MongoDB Atlas
- [ ] `JWT_SECRET` - Generate random string
- [ ] `ADMIN_API_KEY` - Generate random string  
- [ ] `FIREBASE_SERVICE_ACCOUNT` - From Firebase Console

### Auto-configured by Render (2 variables):
- [x] `PORT` - Render sets automatically
- [x] `NODE_ENV` - Render sets to `production`

### Optional (set if needed):
- [ ] `REDIS_URL` - Only if using scheduled notifications
- [ ] `LOG_LEVEL` - Only if need custom logging
- [ ] `API_URL` - Set to your Render backend URL

---

## Generate Secrets Commands

```bash
# JWT_SECRET (32+ characters)
openssl rand -base64 32

# ADMIN_API_KEY (64 hex characters)
openssl rand -hex 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Example .env (Development)

```bash
# Required
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/mytick
JWT_SECRET=Kx7j9m2P5qR8sW0zT3vY6bN4cF1hL0aD
ADMIN_API_KEY=mytick-admin-key-f8e9d7c6b5a4
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}

# Auto-set in production
PORT=4000
NODE_ENV=development

# Optional
REDIS_URL=redis://localhost:6379
LOG_LEVEL=debug
API_URL=http://localhost:4000/api
```

---

## Render Setup Steps

1. **Create Web Service** on Render
2. **Connect GitHub repo**: `ProgramIsFun/mytick`
3. **Root Directory**: `backend`
4. **Build Command**: `npm install && npm run build`
5. **Start Command**: `npm start`
6. **Add Environment Variables**:
   - Click "Environment" tab
   - Add the 4 required variables above
   - Render auto-sets PORT and NODE_ENV

7. **Optional: Add Redis** (for scheduled notifications)
   - Create Redis instance on Render
   - Redis URL automatically added to environment

---

## Summary

**Minimum to deploy**: 4 environment variables (MongoDB, JWT, Admin Key, Firebase)

**Total possible**: 9 variables (6 required + 3 optional)

**Render auto-configures**: 2 variables (PORT, NODE_ENV)

**You need to set**: 4-7 variables depending on features needed
