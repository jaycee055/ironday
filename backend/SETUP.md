# IRONDAY accounts server (optional, free)

Accounts let users back up their data and sign in on other devices. Everything runs on Google Apps Script in the owner's Google account. There is nothing to pay for.

## What it creates in your Google account
- A Google Sheet **IRONDAY Accounts** with `Users` (email, name, salted password hash) and `Sessions`
- A Drive folder **IRONDAY Data** with one small JSON file per user

## Set up
1. Open https://script.google.com/create and paste in `Code.gs`. Save and name the project **IRONDAY Accounts**.
2. Choose `setup` in the function menu and click **Run**. Approve the permission prompt (Advanced → Go to IRONDAY Accounts → Allow).
3. **Deploy → New deployment →** gear icon **→ Web app**. Set Execute as: **Me**, Who has access: **Anyone**, then **Deploy**.
4. Copy the Web app URL (ending in `/exec`) into `index.html`: `const API_URL='https://script.google.com/macros/s/.../exec';`
5. Push. The Sign in and Create account buttons appear automatically.

## Updating the server code
Paste the new code → Save → **Deploy → Manage deployments →** pencil **→ Version: New version → Deploy**. The URL stays the same.

## Safety
- Passwords are salted and hashed 800 times with SHA-256, never stored in plain text.
- After 6 wrong passwords an email is locked for 15 minutes. New sign-ups are capped at 100 per day.
- Saving stops when your Drive is 85% full, so the app can't fill up your Gmail storage.
- Users can delete their own account, which moves their data file to the trash.
- You are holding other people's personal data (names, emails, fitness data). Keep 2-Step Verification on for this Google account, and follow local privacy law (e.g. the Philippine Data Privacy Act).
