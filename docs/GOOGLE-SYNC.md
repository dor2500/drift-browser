# Drift Cloud Sync with Firebase Authentication & Cloud Firestore

Drift synchronizes your **Bookmarks, Pinned Tabs, Essentials, Spaces, Open Tabs, Browsing History, Browser Settings, Cross-Device Tab Handoff, and Universal Cloud Clipboard** in real time using **Firebase Authentication (Google Sign-In provider)** and **Cloud Firestore** — with zero custom backend servers required.

---

## 1. Create a Firebase Project

1. Open the [Firebase Console](https://console.firebase.google.com/) and click **Add project**.
2. Name it `drift-browser-sync` (or any name you prefer) and create the project.
3. In the project overview, click **Add app → Web (`</>`)**, register `Drift Browser`, and copy the `firebaseConfig` object (`apiKey`, `authDomain`, `projectId`, `appId`).

## 2. Enable Google Sign-In in Firebase Authentication

1. In the Firebase Console sidebar, go to **Build → Authentication → Get started**.
2. Under the **Sign-in method** tab, select **Google**, toggle **Enable**, pick your support email, and click **Save**.
3. Under **Authentication → Settings → Authorized domains**, ensure `localhost` and `127.0.0.1` are listed (enabled by default).

## 3. Create Cloud Firestore & Apply Security Rules

1. Go to **Build → Firestore Database → Create database**.
2. Start in **Production mode** and choose a location close to you.
3. Open the **Rules** tab and paste the rules from [`firestore.rules`](../firestore.rules):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /sync/{docId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

## 4. Firestore Document Structure

Every signed-in user's synced state is isolated under `users/{uid}/sync/`:

- `users/{uid}/sync/bookmarks` — Spaces, Pinned Tabs, and Essentials.
- `users/{uid}/sync/history` — Browsing history entries (`url`, `title`, `visits`, `lastVisit`).
- `users/{uid}/sync/settings` — Browser appearance, privacy, dark mode, and preferences.
- `users/{uid}/sync/tabs` — Real-time map of open tabs per active device (`devices.{deviceId}`).
- `users/{uid}/sync/handoff` — Cross-device tab handoff queue (`items` sent between devices).
- `users/{uid}/sync/clipboard` — Universal Cloud Clipboard snippets synced across devices.

## 5. Configure Drift Browser

### Option A: In the App UI (Settings → Sync and Google)
1. Open Drift Settings (`Ctrl+,`) → **Sync and Google**.
2. Expand **Firebase Authentication & Cloud Firestore Configuration**.
3. Paste your `firebaseConfig` snippet (or fill in `apiKey` and `projectId`) and click **Save Firebase Config**.
4. Click **Sign in with Google**.

### Option B: Pre-bundle in GitHub Releases (GitHub Actions Secrets)
In your GitHub repository (`Settings → Secrets and variables → Actions`), add:
- `DRIFT_FIREBASE_CONFIG` (full JSON string of your `firebaseConfig`), **or**
- `DRIFT_FIREBASE_API_KEY` and `DRIFT_FIREBASE_PROJECT_ID` (plus optional `DRIFT_FIREBASE_AUTH_DOMAIN` and `DRIFT_FIREBASE_APP_ID`).
- Optional Desktop OAuth PKCE client: `DRIFT_GOOGLE_CLIENT_ID` and `DRIFT_GOOGLE_CLIENT_SECRET`.
