# TrustID Realtime Web + Android

TrustID is now included in this project as a hosted web/PWA app plus a Capacitor Android wrapper.

## Local Web

```bash
npm install
npm start
```

Open:

```text
http://localhost:5000/trustid/
```

Useful preview links:

```text
http://localhost:5000/trustid/?demo=true
http://localhost:5000/trustid/?demo=true&screen=expenses
http://localhost:5000/trustid/?demo=true&screen=admin-dashboard
```

## Live API

The TrustID frontend uses this API base by default:

```text
/api/trustid
```

That means the same Render service hosts both the web app and backend API.

Important endpoints:

```text
GET  /api/trustid/health
POST /api/trustid/auth/register
POST /api/trustid/auth/login
PUT  /api/trustid/auth/change-password
GET  /api/trustid/documents
POST /api/trustid/documents
GET  /api/trustid/documents/all
PUT  /api/trustid/documents/:id/verify
PUT  /api/trustid/documents/:id/reject
GET  /api/trustid/expenses
POST /api/trustid/expenses
GET  /api/trustid/reminders
POST /api/trustid/reminders
GET  /api/trustid/todos
POST /api/trustid/todos
GET  /api/trustid/admin/users
GET  /api/trustid/admin/stats
```

Seed the first admin after deploying:

```text
POST /api/trustid/auth/seed-admin
```

Default admin:

```text
admin@trustid.com / admin123
```

Change the admin password immediately after first login.

## Render Hosting

`render.yaml` is already suitable for the combined API and frontend service.

Set these Render environment variables:

```text
NODE_ENV=production
FRONTEND_URL=*
JWT_EXPIRES_IN=7d
MONGODB_URI=<your MongoDB Atlas connection string>
JWT_SECRET=<strong generated secret>
```

Render commands:

```text
Build Command: npm install
Start Command: npm start
Health Check Path: /health
```

After deployment, your TrustID app will be available at:

```text
https://YOUR-RENDER-SERVICE.onrender.com/trustid/
```

## Android APK

The Android wrapper is generated in `android/` with Capacitor.

Install required local tools:

1. JDK 17 or newer
2. Android Studio
3. Android SDK Platform and Build Tools
4. Set `JAVA_HOME` to the JDK path
5. Add Android SDK tools to PATH if building outside Android Studio

Then run:

```bash
npm install
npm run android:sync
npm run android:apk
```

Expected debug APK output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

To open and build in Android Studio:

```bash
npm run android:open
```

## Notes

- `?demo=true` keeps the app usable without the backend during demos.
- Live mode is the default and uses MongoDB through `/api/trustid`.
- The frontend has fallback charts so Expenses and Admin Overview do not blank if CDN chart scripts fail.
