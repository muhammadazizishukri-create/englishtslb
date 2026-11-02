# PAWS & POEMS 🐾 — The Animal Adventure (HTML only)

**Open [`index.html`](index.html) directly in Chrome, Edge, or Firefox.** This is the current standalone edition: one file contains all HTML, CSS, vanilla JavaScript, illustrations, and demonstration data initialization. No installation, server, npm, external images, APIs, or internet connection is required. The matching `docs/index.html` is the GitHub Pages copy.

## Demonstration accounts

| Role | ID | Password |
| --- | --- | --- |
| Student | STU001 | student123 |
| Student | STU002 | student123 |
| Teacher | TEACHER001 | teacher123 |

These are **fictional frontend demonstrations, not secure authentication**. Passwords and answers are inspectable browser data. Do not enter real children's personal information. `localStorage` holds demo accounts and work; `sessionStorage` remembers the active role in the current tab. Teacher and student views share work only on the same browser profile and the same file/website address. Moving the file, switching devices or using another browser does not transfer data. Some browser privacy modes block storage; the app then runs in memory and warns you to download work before leaving.

## Six-stage adventure

1. **Reading Corner:** Aisya's Little Cat, inline school/Aisya/cat illustration, vocabulary pop-ups, optional browser text-to-speech with line highlighting, and three questions with explanations and retry. Earn 3 paw points after finding all answers. First-try score is shown separately.
2. **Animal Selection:** illustrated dog, cat, bird, and fish cards. Pick a favourite and a different animal you would not choose. Earn 2 points.
3. **Think and Write:** four distinct positive reasons, two distinct negative reasons, sentence starters, and browser-saved drafts. Earn 4 points.
4. **Poetry Creation Studio:** original title, four or more lines, word bank, prompts, rhyming suggestions, preview, and saved drafts. Earn 5 points.
5. **Review and Submit:** review all work, edit, confirm the browser-only submission, lock edits, download text, or print/save PDF. Earn 3 points.
6. **My Achievements:** badges and a printable/downloadable Young Poet certificate. Total: 17 paw points, awarded once per stage; repeat visits do not farm points.

Students can revisit completed stages. Changing an animal requires completing the affected writing/poetry stages again. Already-earned points remain. Submitted work is read-only until the demo teacher reopens it.

The teacher dashboard creates and edits fictional accounts, changes demo passwords, searches and filters the roster, sorts submission dates, exports CSV, marks submitted work, provides feedback, and reopens submissions. The reasons/vocabulary/clarity rubric totals 10 marks, with 10 additional marks for creative poetry (20 total). Marks and feedback appear only in the relevant student's interface. Paw points and assessment marks are separate. All role restrictions are UI simulation and can be bypassed by inspecting the page or storage.

Text-to-speech depends on browser/device voice support; reading remains available without it. Every asset is inline. Downloading and printing work without a backend. Test scripts were not run for this update.

## Publish the HTML edition

In GitHub **Settings → Pages**, choose **Deploy from a branch → main → /docs → Save**. No paid Render service is required for this edition. The expected address after successful deployment is `https://muhammadazizishukri-create.github.io/englishtslb/`. Pushing HTML does not by itself enable GitHub Pages.

---

## Earlier backend edition (optional, separate from the HTML adventure)

The existing `server.js`, `public/`, and installation instructions below belong to the earlier Express/SQLite application. They are retained for reference and are **not required** to open or publish the standalone `index.html` adventure. `render.yaml` deploys that earlier backend edition, not the HTML-only game.

# Paws & Poems

A complete Year 5 Malaysian English classroom application for **Choose Your Favourite Animal**. Uses HTML, CSS, vanilla JavaScript, Express, bcrypt, and SQLite. Requires **Node.js 24 or newer** (uses the built-in `node:sqlite` module).

## Run locally

```sh
npm ci
cp .env.example .env
```

Edit `.env` before the first start:

- `TEACHER_LOGIN_ID`: initial teacher login ID.
- `TEACHER_PASSWORD`: unique password of at least 12 characters, maximum 72 UTF-8 bytes.
- `SESSION_SECRET`: a random secret, preferably at least 48 random bytes. Generate one with `node -p "require('crypto').randomBytes(48).toString('hex')"`.
- `DEMO_STUDENT_PASSWORD`: optional testing password of at least 8 characters and at most 72 UTF-8 bytes.

Do not overwrite an existing `.env`. An ignored `.env` with random credentials may already exist when using the prepared development workspace; read those locally and keep them private. No credentials are committed or hardcoded.

```sh
npm start
```

Open the app on port 3000 in your local browser. Select **Teacher**, then use the initial credentials. The teacher is created only when no teacher exists; changing these variables later does not reset its password. SQLite is created automatically at `data/app.sqlite`. `npm run dev` starts watch mode.

## Classroom workflow

1. Teacher logs in and creates a student with a unique ID, name, class, and password (minimum 8 characters).
2. Student logs in under the Student tab, selects Dog, Cat, Bird, or Fish, writes four different positive reasons and two negative reasons about a different animal.
3. **Save for later** stores a database draft. **Review my answers** saves progress and presents all answers. Final submission requires confirmation.
4. Teacher searches, filters, or sorts the roster, opens submitted answers, assigns criterion marks (4 + 2 + 2 + 2), and saves feedback.
5. Student sees their marks and feedback on their dashboard. Submitted work is locked. Teachers can reopen it for correction; reopening clears the assessment, and students can edit and resubmit.
6. Teachers can reset student passwords (invalidating their active sessions) or download all students and answers as CSV. Dates display in Malaysia time; database timestamps use UTC.

## Optional sample students

With `DEMO_STUDENT_PASSWORD` set in `.env`:

```sh
npm run seed:demo
```

Creates `student01` (Aina Farhana, 5 Cemerlang) and `student02` (Adam Hakimi, 5 Bestari) with that password. Existing accounts are preserved. Demo seeding refuses to run with `NODE_ENV=production`. Never use real pupil information for development.

## Validation

```sh
npm test
```

Integration tests run a temporary in-memory database and local HTTP server. They cover first-time teacher setup, teacher/student login, account creation, drafts, validation, final submission, locking, role restrictions, student isolation, assessment, feedback, reopening, password reset, and logout. No production data is used. The test process needs permission to bind a local socket.

## Publish on Render

[Deploy on Render](https://render.com/deploy?repo=https://github.com/muhammadazizishukri-create/englishtslb)

This repository includes a `render.yaml` Blueprint for one Node.js service with a persistent 1 GB SQLite disk. **The Starter service and persistent disk are paid resources.** Review Render’s current pricing before creating them.

1. Open the deployment link and sign in to Render. Grant access to this GitHub repository if prompted.
2. Set `TEACHER_LOGIN_ID` (letters, numbers, dot, underscore, or hyphen) and a unique `TEACHER_PASSWORD` (at least 12 characters, at most 72 UTF-8 bytes) in Render’s secure fields. Do not put passwords in GitHub or chat.
3. Review the service and disk costs, then deploy the Blueprint. It configures Node.js 24, HTTPS-compatible secure sessions, a generated session secret, and persistent storage at `/var/data/app.sqlite`.
4. When deployment reports **Live**, open the public HTTPS address shown by Render. Select Teacher, log in using the credentials you entered, and create student accounts.

The hosted database starts empty; local demo accounts and local data are not uploaded. Reuse the generated session secret across redeployments and keep the persistent disk attached. Teacher credentials initialize the first teacher only; editing those variables later does not reset an existing teacher password. This configuration is prepared for deployment; pushing it to GitHub alone does not publish the website.

## Deployment

Run one Node process with a persistent writable SQLite volume. Set `NODE_ENV=production`, a stable strong `SESSION_SECRET`, and initial teacher credentials through your host's secret settings. Terminate HTTPS at your trusted reverse proxy. Set `TRUST_PROXY=1` only when there is exactly one trusted proxy in front of the server; production cookies require HTTPS. Configure `DATABASE_PATH` for your persistent storage and `PORT` as needed. Restrict direct access to the backend when trusting forwarded headers.

Passwords use bcrypt with cost 12. Sessions are server-side and stored in SQLite, with HttpOnly/SameSite cookies, an eight-hour lifetime, and Secure cookies in production. Login rotates session IDs and is rate-limited; writes require a session-bound CSRF token. All authorization and answer/mark validation happen on the server. CSV cells are quoted and protected against formula injection. Student APIs derive ownership from the authenticated session; there is no client-supplied student ID for answers.

Back up the database with SQLite's online backup facilities or stop the server before copying the database and its WAL files. Keep `.env`, database files, and backups private. Before a public school deployment, arrange backups, HTTPS, account recovery, retention/consent policies, and operational monitoring. Multi-instance hosting needs a shared database/session solution. This project does not send mail or use external form services. Fonts are bundled locally with their licenses; illustrations are inline SVG. The UI needs no external asset services.

## Project layout

- `server.js`: database initialization, authentication, persistent sessions, role-based APIs, CSV export.
- `public/index.html`: login.
- `public/student-dashboard.html`: activity progress and personal feedback.
- `public/activity.html`: three-step activity with drafts and confirmation.
- `public/teacher-dashboard.html`: student management and submissions.
- `public/submission-review.html`: individual marking and reopening.
- `public/app.js`, `public/style.css`: interactive UI and responsive design.
- `seed-demo.js`: opt-in test accounts.
- `test/workflow.test.js`: integration coverage.

## HTML-only website

`docs/index.html` is a self-contained HTML activity with inline CSS, JavaScript, and animal illustrations. It works directly from a file or on GitHub Pages without Node.js. Students can choose animals, write reasons, review, print, and download their worksheet. It has no authentication, database, teacher marking, or online submissions; answers are kept only in page memory until it is closed or refreshed.

To publish this edition, use GitHub repository **Settings → Pages → Deploy from a branch → main → /docs → Save**. After GitHub finishes deployment, the expected site address is `https://muhammadazizishukri-create.github.io/englishtslb/`. This address is only live after Pages is enabled and deployment succeeds.
