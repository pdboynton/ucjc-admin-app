# UCJC Admin — Back Office

A single-file, installable PWA that serves as the administrative back office for
the UCJC Holy Convocation App. It shares the **same Firebase project** as the
member-facing app — there is no separate backend or database. It reads and
writes the exact same Firestore collections the member app already uses, plus
one new collection (`appConfig`) for a couple of admin-only settings.

## What's inside

- `index.html` — the entire app (HTML + CSS + JS in one file)
- `manifest.json` — PWA manifest (installable, dark themed to match the member app)
- `sw.js` — minimal service worker (caches only the static shell; all data is always fetched live)
- `vercel.json` — deploy config if you host this on Vercel like the member app

## 1. Deploy it

Any static host works (Vercel, Firebase Hosting, Netlify, GitHub Pages). If you're
already deploying the member app on Vercel, the included `vercel.json` mirrors
that setup — just push this folder as its own project (a separate URL/subdomain
from the member app, e.g. `admin.yourdomain.org`, is strongly recommended so members
never stumble onto the back office).

## 2. Bootstrap the first administrator

"Admin" in this console is defined **identically** to how the member app already
defines it: membership in a `chatGroups` document flagged `isAdminGroup: true`.
There's no separate roles system or custom claims to keep in sync — one source
of truth, shared by both apps.

The very first admin has to be added by hand, once, in the Firebase console
(Firestore → Data):

1. Create a document in `chatGroups` with the **document ID `admin-group`**
   (this console always uses that fixed ID going forward — see below) with fields:
   ```
   name: "Admin Team"
   isAdminGroup: true
   isPrayerGroup: false
   isDepartmentGroup: false
   active: true
   ```
2. Under that document, create a subcollection `members`, and add one document
   whose **ID is your Firebase Auth UID** (find it in Authentication → Users),
   with fields:
   ```
   uid: "<your uid>"
   displayName: "Your Name"
   email: "you@example.com"
   ```
3. Sign in to the admin console with that account. From then on, you can add or
   remove other admins directly from the **Users** or **Groups** screen — no more
   console work needed.

## 3. Update Firestore security rules

The **Settings** screen inside the app has an up-to-date, copyable rules
snippet — that's the source of truth, not this document. In short, admins need
read access to the full `users` directory, all `chatGroups` (including other
members' `messages` subcollections), the `feedback` responses, and a
`collectionGroup` read on `bookmarks` (used for session-interest counts on the
Overview and Events screens). Merge the snippet with whatever rules the member
app already requires — don't replace them wholesale.

## 4. Why singleton groups use fixed IDs

When you create an Admin, Prayer Requests, or Department group from this
console, it's saved under a fixed Firestore document ID (`admin-group`,
`prayer-group`, `dept-men`, `dept-women`, `dept-youth`, `dept-youngadult`)
instead of an auto-generated one. Two reasons:

- It naturally prevents accidentally creating two "Prayer Requests" groups.
- It lets Firestore security rules reference the admin group directly
  (`exists(/chatGroups/admin-group/members/$(uid))`) instead of needing a
  Firestore query inside a rule, which isn't possible.

The member app is unaffected either way — it discovers these groups by their
`isAdminGroup` / `isPrayerGroup` / `isDepartmentGroup` + `departmentKey` flags,
never by document ID. Regular/custom groups you create still get normal
auto-generated IDs.

## What this console can do

- **Overview dashboard** — events, prayer requests (12-month trend + a
  configurable "current event" window), messages by department, messages to
  admins, total app users, average session ratings, and RSVP/bookmark
  ("interest") counts.
- **Inbox** — a unified, filterable feed of every Contact Admin message, Prayer
  Request, and Department submission, with inline reply and a "mark handled"
  toggle so nothing falls through the cracks.
- **Chat Groups** — create standard/department/prayer/admin groups, add or
  remove members (with search), read and reply to any group's thread, edit or
  deactivate a group, or permanently delete one (with its full message history).
- **Users** — searchable directory, per-user group membership (add/remove
  directly from a user's profile — this is also how you promote/demote other
  admins), CSV export.
- **Events & Ratings** — pulls sessions from the same public Google Calendar the
  member app uses; shows average rating, individual feedback comments, and
  bookmark ("interest") counts per session.
- **RSVPs** — attendee list, guest counts, attending/not-attending breakdown,
  CSV export, for the app's featured RSVP event.
- **Settings** — the "current event" date range used by dashboard stats, admin
  group management shortcut, the Firestore rules snippet, and data exports.

## Known limitations / good next steps

- **Deleting a user's Firebase Auth account** (not just their Firestore profile)
  requires the Firebase Admin SDK, which can't run in a browser. If you want a
  "delete user" button here, it needs a small Cloud Function (similar to the
  existing `functions/index.js` used for push reminders) that this console
  calls via `httpsCallable`.
- **Push/broadcast announcements** aren't wired up yet — the member app doesn't
  currently have a collection it reads for admin broadcasts. Adding one is
  straightforward (a Cloud Function using the same OneSignal REST setup already
  used for bookmarked-event reminders) but needs a small change on the member
  app side too, so it was left out rather than half-built.
- **Very large groups/collections**: a few screens (Groups list, Overview)
  read full subcollections to compute counts. Firestore's `count()` aggregation
  is used where practical to keep reads cheap; if message volume gets very
  large, consider maintaining denormalized counters via a Cloud Function
  trigger instead.
