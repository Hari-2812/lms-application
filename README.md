# LMS MVP Demo — Private Google Drive Video Streaming

A client-demo MVP that proves one thing end to end:

> A **private** video in Google Drive is fetched by our Node.js backend through the
> Google Drive API and streamed into a React video player — **the student never sees
> a `drive.google.com` URL and is never redirected to Google.**

Around that core, there is a professional LMS UI (dashboard, courses, lessons,
player, progress) so the client can see what the finished product will feel like.

---

## 1. Folder structure

```text
lms-demo/
├── client/                       React + Vite + Tailwind
│   ├── index.html
│   ├── vite.config.js            /api proxy -> localhost:5000
│   ├── tailwind.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx               routes
│       ├── index.css
│       ├── api/client.js         axios wrapper (all calls are relative /api/...)
│       ├── context/AuthContext.jsx       session + sign in / sign up / sign out
│       ├── hooks/                useCourses  useLearningData  useWishlist  useMediaQuery
│       ├── content/resources.js  editorial copy for the landing page
│       ├── utils/                format.js  course.js
│       ├── components/
│       │   ├── common/           Button  Badge  Input  Modal  Tabs  Avatar
│       │   │                     ProgressBar  Rating  Skeleton  EmptyState  Reveal  Logo
│       │   ├── layout/           PublicLayout  PublicNavbar  PublicFooter
│       │   │                     DashboardLayout  Sidebar  DashboardHeader
│       │   │                     AuthLayout  LearnLayout  ProtectedRoute
│       │   ├── courses/          CourseCard  CourseGrid  CourseThumbnail
│       │   │                     Curriculum  CourseProgress
│       │   ├── dashboard/        StatsCard  ContinueLearning  RecentActivity
│       │   │                     RecommendedCourses  LearningGoals
│       │   ├── landing/          Hero  TrustBar  AboutSection  FeaturedCourses
│       │   │                     Categories  Features  Testimonials  Instructors
│       │   │                     BlogSection  FaqSection  CTASection
│       │   ├── VideoPlayer.jsx           ← reusable HTML5 player
│       │   ├── HowItWorks.jsx            ← architecture panel for the client
│       │   └── States.jsx
│       └── pages/
│           ├── Home.jsx          Courses.jsx       CourseDetails.jsx
│           ├── Login.jsx         Register.jsx      NotFound.jsx
│           ├── Dashboard.jsx     MyCourses.jsx     CourseLearning.jsx
│           ├── ProgressPage.jsx  Certificates.jsx  Achievements.jsx
│           └── Wishlist.jsx      Profile.jsx       SettingsPage.jsx  HowItWorksPage.jsx
│
└── server/                       Node.js + Express + MongoDB
    ├── .env.example
    ├── credentials/              service-account JSON key (gitignored)
    ├── demo-media/               offline fallback videos (gitignored)
    └── src/
        ├── index.js              app bootstrap
        ├── config/db.js
        ├── models/               Course.js  Lesson.js  Progress.js
        ├── routes/index.js
        ├── controllers/          course / lesson / video / progress
        ├── services/
        │   ├── googleDriveService.js   ← the ONLY file that talks to Drive
        │   └── videoService.js         ← lessonId -> fileId -> byte stream
        ├── middleware/           mockAuth.js  errorHandler.js
        ├── scripts/
        │   ├── driveCheck.js         npm run drive:check  (diagnose Drive setup)
        │   └── driveLink.js          npm run drive:link   (map Drive files -> lessons)
        └── seed/
            ├── seed.js               npm run seed      (destructive: resets everything)
            └── backfillMetadata.js   npm run backfill  (additive: course metadata only)
```

Layering is strict, as required:

```text
Controller → Video Service → Google Drive Service → Google Drive API
```

No Drive logic lives in a route or controller.

---

## 2. Setup commands

```bash
cd server
npm install
cp .env.example .env
npm run seed
npm run dev
```

```bash
cd client
npm install
npm run dev
```

Then open **http://localhost:5173**.

MongoDB must be running first. On Windows, from an **Administrator** terminal:

```bash
net start MongoDB
```

### Course catalogue metadata

Course cards and the details page show a category, rating, student count and
"What you'll learn" list. Those fields were added to the `Course` model after
the original seed, so databases seeded earlier will not have them — the UI
simply hides whatever is missing.

To populate them **without losing existing progress**:

```bash
cd server
npm run backfill
```

`npm run backfill` only fills fields that are still empty and never touches
lessons or progress. (`npm run seed`, by contrast, wipes courses, lessons *and*
progress before re-creating them.)

---

## 3. `.env.example`

```ini
PORT=5000

MONGODB_URI=mongodb://127.0.0.1:27017/lms_demo

# --- Google Drive (private video source) ----------------------------------
# Preferred: path to the service-account JSON downloaded from Google Cloud.
# Relative paths resolve against server/. The file is gitignored.
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=credentials/service-account.json

# The Drive folder holding the lesson videos, shared with the service
# account's client_email as Viewer (NOT "anyone with the link").
#   https://drive.google.com/drive/folders/<THIS_PART>
GOOGLE_DRIVE_FOLDER_ID=

# Alternative to the key file — only if you cannot store a file.
# GOOGLE_PRIVATE_KEY must be one line with literal \n escapes, in quotes.
# GOOGLE_PROJECT_ID=
# GOOGLE_CLIENT_EMAIL=
# GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

CLIENT_URL=http://localhost:5173
```

Nothing here is ever bundled into the React app — the client only ever calls
relative `/api/...` paths.

---

## 4. Google Drive setup instructions

### One-time Google Cloud setup

**Step 1** — Create a project at <https://console.cloud.google.com>.

**Step 2** — Enable the **Google Drive API**
(*APIs & Services → Library → Google Drive API → Enable*).

**Step 3** — Create a **Service Account**
(*APIs & Services → Credentials → Create Credentials → Service account*).
Note its address — it looks like
`something@your-project.iam.gserviceaccount.com`.

**Step 4** — Download a key
(*Service account → Keys → Add key → Create new key → JSON*).

### Wiring the key into the backend

**Step 5** — Save the downloaded JSON as
`server/credentials/service-account.json`, then point `server/.env` at it:

```ini
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=credentials/service-account.json
```

That whole folder is gitignored. There is no need to paste the private key
into `.env` — escaping a multi-line PEM into a single line is the most common
cause of `invalid_grant` errors.

> The discrete `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY` variables still
> work if you must supply credentials through the environment (e.g. on a PaaS
> that has no filesystem). The key file wins when both are present.

### Sharing the videos

**Step 6** — Create a Drive folder, e.g. `LMS Demo Videos`, and upload your
lesson MP4s. Leave sharing **private** — do *not* use "Anyone with the link".

Naming files with a leading number and the lesson title makes the linking step
automatic:

```text
LMS Demo Videos
├── 01 - Introduction to React.mp4
├── 02 - Project Setup.mp4
├── 03 - React Components.mp4
├── 04 - Props and State.mp4
└── 05 - React Hooks.mp4
```

**Step 7** — Right-click the folder → **Share** → paste the service account
address → **Viewer** → Send. This is what grants the backend access while the
folder stays private to the public.

**Step 8** — Copy the folder id from its URL into `server/.env`:

```text
https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrSt
                                       └────────┬──────────┘
                                          folder id
```

```ini
GOOGLE_DRIVE_FOLDER_ID=1AbCdEfGhIjKlMnOpQrSt
```

Paste the **id only**, not the whole share URL. (If you do paste a full URL the
scripts extract the id anyway and tell you to tidy the value, but the backend
reads it more predictably as a bare id.)

### Verify and link

**Step 9** — Check the connection:

```bash
cd server
npm run drive:check
```

It confirms the credentials load, the service account authenticates, the folder
is reachable, and lists the videos it found. Every failure mode (wrong folder
id, folder not shared, Drive API disabled, bad key) prints the specific fix
rather than a raw Google error.

If `GOOGLE_DRIVE_FOLDER_ID` is not set yet, it lists the folders that *have*
been shared with the service account, with their ids.

**Step 10** — Attach the Drive files to lessons:

```bash
npm run drive:link                # dry run - shows the proposed mapping
npm run drive:link -- --apply     # writes it
```

A file is matched to a lesson when either:

* its **leading number** matches the lesson order — `03 - Components.mp4` -> lesson 3, or
* its **name is near-identical** to the lesson title.

Anything else is reported as *no confident match* and left alone. That is
deliberate: a wrong auto-link is harder to notice than a missing one. If two
files score identically for the same lesson, the dry run flags the tie — rename
one in Drive so the intended file is unambiguous.

Useful flags:

| Flag | Effect |
| ---- | ------ |
| `--apply` | Write the mapping (default is a dry run) |
| `--course=react` | Only touch one course, by slug |
| `--positional` | Also match purely by order, when a course's unmatched lesson count equals the free file count. Off by default because it will happily pair unrelated files whose counts line up. |
| `--set "<title>=<fileId>"` | Link one lesson by hand — for ties, or anything the matcher skipped |

```bash
# resolve a tie or fill a gap without touching mongosh
npm run drive:link -- --set "React Hooks=1AbCdEfGhIjKlMnOp"
```

Only `videoFileId` and `duration` are written — courses, progress and all other
lesson fields are untouched, so it is safe to re-run. Real media durations
replace the seeded placeholders, so the curriculum shows accurate lesson times.

To set an id directly in the database instead:

```js
db.lessons.updateOne(
  { title: "React Components" },
  { $set: { videoFileId: "1ABCxyz123456" } }
)
```

**Step 11** — Restart the backend. It prints its video source on boot:

```text
Video source   private Google Drive (service account)
Service acct   lms-video-reader@your-project.iam.gserviceaccount.com
Drive folder   1AbCdEfGhIjKlMnOpQrSt
```

### Graceful degradation

Until a lesson has a real Drive file id, it streams from
`server/demo-media/sample.mp4` instead — so the UI demo keeps working through
setup. If a Drive request fails at runtime (folder unshared, file deleted), the
same fallback kicks in and the real cause is logged server-side rather than
shown to the student.

### If a key is ever exposed

Delete it immediately: *Google Cloud Console → IAM & Admin → Service Accounts →
your account → Keys → delete*. That revokes the key; the service account and
its folder sharing keep working. Create a new JSON key and overwrite
`server/credentials/service-account.json` — no other change is needed.

---

## 5. API list

| Method | Endpoint                            | Purpose                                   |
| ------ | ----------------------------------- | ----------------------------------------- |
| GET    | `/api/courses`                      | All courses + this student's progress %   |
| GET    | `/api/courses/:id`                  | One course                                |
| GET    | `/api/courses/:courseId/lessons`    | Lessons for a course + per-lesson progress |
| GET    | `/api/lessons/:id`                  | One lesson                                |
| GET    | `/api/videos/:lessonId/stream`      | **Video bytes (Range-aware)**             |
| POST   | `/api/progress`                     | Save `{ lessonId, position, duration }`   |
| GET    | `/api/progress/:lessonId`           | Read progress for a lesson                |
| GET    | `/api/me`                           | The mocked demo student                   |
| GET    | `/api/health`                       | Status + which video source is active     |

`/api/me` and `/api/health` exist only to drive the demo UI (the header avatar
and the "How It Works" status strip).

### Not implemented yet

The frontend already calls these and falls back cleanly when they 404, so the
day they exist no client change is needed:

| Method | Endpoint             | Used by                                    |
| ------ | -------------------- | ------------------------------------------ |
| POST   | `/api/auth/login`    | `context/AuthContext.jsx` — falls back to `/api/me` |
| POST   | `/api/auth/register` | same                                       |
| POST   | `/api/auth/logout`   | same (failure ignored)                     |

`client.js` also exports `setAuthToken()`, which attaches
`Authorization: Bearer …` to every request once a real token exists. The current
`mockAuth` middleware ignores it.

Wishlist, per-lesson notes and UI preferences are kept in `localStorage` for
now — each lives behind a single hook so it can move to an API without touching
any page.

---

## 5b. Routes

**Public**

| Route                | Page                                     |
| -------------------- | ---------------------------------------- |
| `/`                  | Landing page                             |
| `/courses`           | Catalogue with search + category filters |
| `/courses/:courseId` | Course details                           |
| `/login`             | Sign in                                  |
| `/register`          | Create account                           |

**Authenticated** (behind `ProtectedRoute`; signed-out visitors are sent to
`/login` and returned to where they were heading)

| Route                        | Page                              |
| ---------------------------- | --------------------------------- |
| `/dashboard`                 | Student dashboard                 |
| `/my-courses`                | Enrolled courses + status tabs    |
| `/my-courses/:courseId`      | Course details (in dashboard)     |
| `/learn/:courseId/:lessonId` | Video learning page               |
| `/progress`                  | Progress by course                |
| `/certificates`              | Completed-course certificates     |
| `/achievements`              | Milestone badges                  |
| `/wishlist`                  | Saved courses                     |
| `/profile` · `/settings`     | Account                           |
| `/how-it-works`              | Video-delivery architecture       |

The previous `/course/:courseId` and `/course/:courseId/lesson/:lessonId` URLs
still work — they redirect to their `/my-courses/…` and `/learn/…` equivalents.

---

## 6. How the video flows from Google Drive to React

```text
Student clicks a lesson in the React LMS
      │
      ▼
<video src="/api/videos/:lessonId/stream">
      │  GET with header:  Range: bytes=0-
      ▼
Express route  →  videoController.streamLessonVideo
      │
      ▼
videoService.getLessonVideoStream(lessonId, range)
      │  Lesson.findById(lessonId)  →  lesson.videoFileId
      ▼
googleDriveService.getVideoStream(fileId, range)
      │  drive.files.get(
      │    { fileId, alt: 'media' },
      │    { responseType: 'stream', headers: { Range: 'bytes=0-' } }
      │  )
      ▼
Google Drive API  →  private MP4 byte stream (206 Partial Content)
      │
      ▼
Express copies Content-Type / Content-Length / Content-Range / Accept-Ranges
and pipes the stream straight to the response — nothing is buffered in Node
      │
      ▼
React <video> element renders the bytes
```

What the browser sees, and what it never sees:

| Browser requests   | `http://localhost:5173/api/videos/<lessonId>/stream` |
| ------------------ | ---------------------------------------------------- |
| Browser never sees | `drive.google.com/file/...`, `webViewLink`, `webContentLink`, the file id, the service-account key |

Three layers enforce this:

1. `Lesson.toJSON()` deletes `videoFileId` from every API response.
2. `googleDriveService` only ever requests the fields `id, name, mimeType, size`
   — `webViewLink` / `webContentLink` are never fetched.
3. The stream endpoint returns **bytes**, never a redirect. There is no `302` to
   Google anywhere in the codebase.

### Range requests

`req.headers.range` is forwarded untouched to the Drive API, so Google itself
serves the partial content and Node stays a thin pipe.

* Range present → **206 Partial Content** + `Content-Range` + `Content-Length`
* No range → **200 OK** + `Content-Length`
* Always → `Accept-Ranges: bytes`

This is what makes seeking, scrubbing and resume work in the HTML5 player.

---

## 7. How to test the video streaming

**A. Full request returns 200**

```bash
curl -s -o NUL -D - http://localhost:5000/api/videos/<lessonId>/stream
```

Expect `HTTP/1.1 200 OK`, `Accept-Ranges: bytes`, a `Content-Length`.

**B. Range request returns 206**

```bash
curl -s -o NUL -D - -H "Range: bytes=0-1023" http://localhost:5000/api/videos/<lessonId>/stream
```

Expect `HTTP/1.1 206 Partial Content` and `Content-Range: bytes 0-1023/<total>`.

**C. Prove no Drive URL reaches the client**

```bash
curl -s http://localhost:5000/api/courses/<courseId>/lessons | findstr /i "drive.google videoFileId webViewLink"
```

Expect **no output**.

**D. The live demo check (do this in front of the client)**

1. Open a lesson page, press ⌘/Ctrl-Shift-I → **Network**, filter *Media*.
2. Play, then drag the seek bar.
3. Every media request is to `localhost:5173/api/videos/.../stream`, each
   returning `206`. There is not a single request to `drive.google.com` or
   `googleapis.com`.
4. Right-click the video — the native menu (with "Save video as…") is disabled.

**Verified on this machine:** 200/206 responses correct for `bytes=0-1023`,
`bytes=1048576-` and suffix range `bytes=-500`; video plays and seeks in the
React player; leak check on the lessons API returns nothing.

---

## 8. Demo flow to walk the client through

```text
Landing page → Explore Courses → Course details → Register / Login
   → Dashboard → Continue Learning → player opens
   → video streams from private Drive via our API
   → progress saves → next lesson → course complete → certificate
```

The **How It Works** page (sidebar) contains the architecture diagram, the
request trace and the security summary — built for exactly this conversation.

---

## 9. Demo data

`npm run seed` creates:

* **React.js Masterclass** — 5 lessons (Introduction to React, Project Setup,
  React Components, Props and State, React Hooks) — the Drive-backed course
* **Node.js & Express API** — 2 lessons
* **MongoDB Essentials** — 1 lesson

Every lesson stores only `videoFileId`; no Drive URL is stored anywhere.

The seed prints each lesson's `_id` so you can map file ids quickly.

---

## 10. Offline fallback (`server/demo-media/`)

If `GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY` are **not** set, the streaming
endpoint serves `demo-media/<videoFileId>.mp4`, or `demo-media/sample.mp4`, from
disk instead. Range handling, status codes and headers are identical — only the
byte source changes. This exists so the UI is demonstrable without credentials.

**The moment Drive credentials are present in `.env`, this folder is ignored**
and every lesson streams from Google Drive.

---

## 11. Limitations of this demo

* **Authentication is mocked.** Every request is treated as the demo student
  (`server/src/middleware/mockAuth.js`). There is no login, no session, no
  enrolment check. This is the first thing to build for real.
* **The stream endpoint is unauthenticated.** Anyone who knows a lesson id can
  fetch its bytes from the API. Production needs a JWT check plus short-lived
  signed URLs bound to the session.
* **Screen recording is not prevented.** No web player can stop OS screen
  capture or a phone camera. What this design *does* stop: link sharing, direct
  downloads, and any student access to Drive. Real anti-piracy needs DRM
  (Widevine / FairPlay) with HLS or DASH — deliberately out of scope here.
* **No transcoding or adaptive bitrate.** One MP4 is served at its original
  resolution. Large files on slow connections will buffer; HLS with multiple
  renditions is the production answer.
* **Drive API quotas apply.** Every play consumes Drive read quota and all
  traffic flows through the Node process, so this does not scale to many
  concurrent students. Production would put a CDN or object storage (S3 +
  CloudFront signed URLs) in front, using Drive only as the source of truth.
* **No caching.** Each range request hits the Drive API. A production build
  would cache hot byte ranges or mirror files to storage closer to the CDN.
* **Progress is coarse.** Position is saved every ~8 seconds and a lesson is
  marked complete at 90% watched.
* Not built, by design: payments, subscriptions, certificates, quizzes,
  analytics, notifications, chat, live classes, admin panel.
