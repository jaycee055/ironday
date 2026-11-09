# IRONDAY — Workout Planner

A personalized fitness app: build your own workout program or pick a ready-made plan, then follow daily tasks, phases and progress tracking.

**Open the app:** https://jaycee055.github.io/ironday/

**Android app:** [Download IRONDAY.apk](https://github.com/jaycee055/ironday/releases/latest/download/IRONDAY.apk) (always the newest version). Open it on your phone and allow installing from your browser if asked.

**iPhone:** open the website in Safari → Share → **Add to Home Screen**. It opens full-screen and works offline.

## Features
- **Start screen with two choices:** Create Your Own Workout, or Choose a Ready-Made Workout. The app remembers which one you picked last.
- **Custom program builder:** name, goal, level, start date, workout days, phases (each with its own length and difficulty), and daily exercises with sets and reps
- **Ready-made programs:** Beginner (4 wks), Muscle Building (8 wks), Fat Loss (6 wks), Flexibility (4 wks)
- **Daily dashboard:** today's tasks, phase, streak, % complete, and a "Complete Today's Workout" button
- **Schedule:** week strip and monthly calendar with rest, done, partial and missed days
- **Workouts:** one active program at a time; pause, edit, restart, switch, or save programs for later
- **Exercise library:** 60+ exercises by muscle group (chest, back, shoulders, biceps, triceps, abs, legs, glutes, calves, home cardio) plus mobility, with male and female pictures, with step-by-step instructions
- **Preferences:** Men / Women / Everyone, Gym / Home, and equipment. These drive recommendations, photos and home swaps.
- **Women's programs:** Glutes & Legs Sculpt, Toned Full Body, Women's Home Fat Burn, Core & Posture
- **Home programs:** No-Equipment Beginner, Home Dumbbell Builder, 20-Min HIIT, Home Abs
- **Swap for home version** on any gym exercise
- **Start Workout mode:** a guided player with set counter, auto rest, timed moves and weight logging
- **Quick workouts:** 10/20/30 min by body part, gym or home
- **Personal records**, **body measurements**, **badges**, and **library search**
- **Rest timer**, daily reminder banner, weight tracker, progress photos, workout history, and phase unlocking

## Files
| File | What it is |
|---|---|
| `index.html` | The whole app (HTML, CSS and JavaScript in one file) |
| `img/` | Model photos and exercise illustrations |
| `manifest.webmanifest`, `sw.js`, `icons/` | Installable app and offline support |
| `privacy.html` | Privacy policy |
| `backend/` | Optional accounts server (Google Apps Script) |
| `android-app/`, `.github/workflows/android.yml` | Android app wrapper and automatic APK build |

## Your data and optional accounts
Without an account, everything is saved on the device. Users can optionally create an account to back up and sync their data across devices. Accounts run free on Google Apps Script in the owner's Google account (see [backend/SETUP.md](backend/SETUP.md)). Progress photos never leave the device. See [privacy.html](privacy.html).

## Android build
`.github/workflows/android.yml` builds a signed APK on every push to `main` and publishes it under **Releases**. The signing key is `android-app/release.keystore`. Its password is in the workflow as a fallback; to keep it private, add a repository secret `ANDROID_KEYSTORE_PASSWORD` with the same value and remove the fallback. **Never lose the keystore:** without it, new versions can't install over old ones.
