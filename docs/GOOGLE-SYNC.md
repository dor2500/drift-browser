# Drift Sync with Google: creating the connection key

Drift syncs and backs up your bookmarks, pinned tabs, spaces, open tabs, history and
settings through your Google account. Google lets only Google Chrome use Chrome Sync,
so Drift keeps its own copy in your Google Drive's **app data folder**: a private
space only Drift can read. It doesn't show up among your Drive files.

Google requires every app that signs in with Google to have its own key (an "OAuth
client"). It's free and takes about 5 minutes. You do it once.

## 1. Create the project

1. Open <https://console.cloud.google.com/> and sign in.
2. At the top, click the project picker → **New project**. Name it `Drift`, then **Create**.

## 2. Turn on Google Drive

1. Go to **APIs & Services → Library**.
2. Search for **Google Drive API**, open it and click **Enable**.

## 3. The sign-in screen (Google Auth Platform)

1. Go to **APIs & Services → OAuth consent screen** (also called **Google Auth Platform**) and click **Get started**.
2. App name: `Drift`. User support email: your address. Audience: **External**. Contact email: your address. Agree and **Create**.
3. Under **Data access**, click **Add or remove scopes** and add:
   - `.../auth/drive.appdata` (See, create and delete its own configuration data in your Google Drive)
   - `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`

   Save.
4. Under **Audience**, click **Publish app** and confirm.

   While an app is in "Testing", Google signs you out after 7 days. These scopes
   don't need Google's review, so publishing is immediate.

## 4. Create the key

1. Go to **Clients** (or **APIs & Services → Credentials**) → **Create client**.
2. Application type: **Desktop app**. Name: `Drift`. **Create**.
3. Copy the **Client ID** and the **Client secret**.

   A desktop app can't keep a secret, so Google treats this one as part of the app.
   Sign-in is protected by PKCE and Google's own sign-in page.

## 5. Put the key in Drift

**For yourself:** in Drift, open **Settings → Sync and Google → Google connection key**,
paste both values and click **Save key**. Then click **Sign in with Google**.

**For everyone who installs Drift (releases):** in the GitHub repository, open
**Settings → Secrets and variables → Actions** and add two secrets:

- `DRIFT_GOOGLE_CLIENT_ID`
- `DRIFT_GOOGLE_CLIENT_SECRET`

The release build writes them into the app. Users then just click **Sign in with Google**.

## What happens when you sign in

- Google's sign-in page opens in your default browser. Google doesn't allow sign-in
  inside embedded app windows.
- Drift asks only for your name, email address and its own app data folder. It can't
  see your other Drive files.
- Your sign-in is stored encrypted with your operating system's keychain.
- **Sign out** stops syncing on that device; what's already on the device stays.
  To delete the copy in your account: Google Drive → ⚙ Settings → **Manage apps**
  → Drift → **Delete hidden app data**.
