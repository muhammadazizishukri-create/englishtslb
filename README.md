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
