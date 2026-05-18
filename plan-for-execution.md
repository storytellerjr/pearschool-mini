# Plan for execution

A step-by-step plan that turns the four-stage funnel in `sales-funnel.md` into a working Pearschool app. Written for a Claude Code agent to execute in a follow-up session.

---

## Current status (2026-05-18)

| Phase | Status | Notes |
|-------|--------|-------|
| Pre-flight | ✅ done | All eight skills symlinked under `~/.claude/skills/`. |
| Phase 0.1 — `/blind-peering` | ✅ done | Already applied before this session. Verified via `worker/worker-task.js:27-31`, README sections 14-60. |
| Phase 1.1 — `/photo-backup` adapted | ✅ done | Schema, worker, hook, UI all wired. End-to-end verified after restarting the blind peer with a fresh key and re-pairing Alice / Bob (no `--reset` needed). Issues #7 / #8 / #9 closed. |
| Phase 1.2 — `/live-cam` | 🚫 **deferred to Phase 3** | Single-broadcaster-per-room model fits the webinar use case, not an always-on free-content tab. |
| Phase 1.3 — shareable clip links | ⏳ pending | Unblocked — ready to start. |
| Phase 2 — identity + hand-raise | ⏳ pending | `/identity` + Like + Follow + saved-list view + notifications design note. |
| Phase 3 — webinar | ⏳ pending | Webinar entity + Subscription entity + manual webinar-room shell (multi-rooms + adapted /live-cam) + pitch slot + replay. |
| Phase 4 — sales | ⏳ pending | Course sales-page fields + sales/order/receipt pages + Lightning + Purchase entity + unlocking gate. |
| Phase 5 — end-to-end smoke test | ⏳ pending | Two-peer funnel walkthrough. |

### Recovery recipe (kept for future regressions)

The Issues #7 / #8 / #9 cluster resolved on 2026-05-18 without any code change. The recipe:

1. Stop the blind-peer process. Restart it: `npx --yes blind-peer -s /tmp/pearschool-mini-blind1` — capture the **new** blind-peer-key it prints.
2. Stop Alice. Restart with the **new** blind-peer-key: `pear run --store /tmp/pearschool-mini-user1 . --name alice --blind-peer-key <new-key>`. **No `--reset`** — existing data is preserved.
3. Copy the **new account invite** Alice prints on first paint.
4. Stop Bob. Restart Bob with the new invite + the same new blind-peer-key. **No `--reset`** on Bob either.
5. Send a chat message and drop an MP4 — both should round-trip.

If chat / free-clips silently stop syncing again, try this first before chasing a code regression.

---



Each phase finishes with a **Definition of Done** — the agent must verify those bullets before moving to the next phase. If a step requires manual judgement (UI copy, design choices), the agent asks before proceeding.

---

## Pre-flight

Before touching any code, the executing agent must do the following.

1. **Read these files**:
   - `./sales-funnel.md` — the funnel definition. Source of "why".
   - `./README.md` — current project capabilities and `--store` rules.
   - `../examples-p2p-desktop/examples-skills/README.md` — index of the eight skills.
2. **Confirm current state**. The project already has:
   - `/chat` baseline (autobase + hyperdb + hyperdispatch + hyperswarm).
   - `/multi-rooms` applied (account-level + per-room bases; `chat-account.js` is the account-scoped owner).
   - `/file-sharing` applied (Hyperdrive + LocalDrive, Files tab).
   - `/basic-entity` applied twice (Tasks tab, Courses tab — both account-scoped).
3. **Confirm skills are activated**. Each `/skill-name` below must be reachable from `~/.claude/skills/`. If not, the agent runs `bash ../examples-p2p-desktop/examples-skills/activate.sh` and reminds Storyteller to restart Claude Code once.
4. **Always use folder-scoped `--store` paths** when running peers. Pattern: `/tmp/pearschool-mini-user1`, `/tmp/pearschool-mini-user2`, `/tmp/pearschool-mini-blind1`. Never bare `/tmp/user1`.
5. **House rules**:
   - Storyteller is the only name allowed in committed files.
   - No Markdown tables in code-resident docs (viewer mangles them). Bulleted lists with bold keys.
   - No new dependencies unless a skill template demands them.

---

## Phase 0 — Reliability foundation

**Goal**: make sure content keeps being delivered even when the teacher's laptop is asleep. The funnel leaks badly if visitors hit a free clip and get a black screen because nobody's seeding it.

### Step 0.1 — Apply `/blind-peering`

- Invoke `/blind-peering` from inside `pearschool-mini/`.
- The skill is non-interactive; it patches `worker/worker-task.js` and `worker/index.js` to register the account base (and all room bases as they open) with a blind-peer relay. No schema changes.
- After the skill finishes, start a relay alongside the app: `npx --yes blind-peer -s /tmp/pearschool-mini-blind1` (the README already documents this).
- Confirm at startup the worker logs that it added each base to blind-peering.

**Definition of Done**:
- One peer can post a message, close the app, and a second peer joining later can still receive that message via the relay.
- No regression in the existing Chat / Files / Tasks / Courses tabs.

---

## Phase 1 — Free content (Stage 1 of the funnel)

**Goal**: give the teacher two ways to publish free content — a shelf of pre-recorded clips and a live broadcast — and a way to share both outwards.

### Step 1.1 — Apply `/photo-backup`

- Invoke `/photo-backup` from inside `pearschool-mini/`.
- The skill scaffolds a drag-drop photo/video ingest into Hyperblobs with thumbnails and per-item comments. Adds a new tab (likely **Gallery** or **Photos** — check the template's UI choice).
- **Adapt for free content**: the agent renames the tab and panel labels from "Gallery" → **"Free clips"** (or "Showcase") so the panel's purpose matches Stage 1.
- Each clip already gets a comment thread by default — leave that wired in, it becomes useful for hand-raise in Phase 2.

**Definition of Done**:
- Teacher peer can drag a short MP4 onto the Free clips tab, and within ~5 seconds it appears on every other peer (including a fresh joiner after the upload).
- Thumbnails render. Comments round-trip between peers.

### Step 1.2 — Apply `/live-cam` — **DEFERRED to Phase 3**

**Status**: deferred 2026-05-17 by Storyteller. The `/live-cam` skill's single-broadcaster-per-room model (broadcaster = the peer launched without `--invite`, fixed at app start) is a natural fit for the **webinar room** in Phase 3, not for an always-on free-content tab. It would also wholesale-replace `ChatRoom` with `LiveCamRoom`, breaking the multi-rooms architecture, and its `videos` collection collides with the one Phase 1.1 just added for Free clips.

The skill will be applied later, adapted into the webinar room shell (Phase 3.3), with the broadcaster constrained to the webinar's `hostId`. Stage 1 ships with Free clips only.

### Step 1.3 — Shareable links (manual UI work)

There is no dedicated skill for this. The agent builds it manually:

- On each free clip and on the live stream, add a **Share** button that copies a deep link to the system clipboard. The link format is the existing room invite (`pear://...?invite=<z32>`) plus a fragment naming the target clip or stream (e.g. `#clip=<id>` or `#live`).
- Update the renderer so that if the app is launched with such a fragment, it auto-navigates to that clip / stream on first paint.

**Definition of Done**:
- Storyteller can copy a link from peer A, open peer B, paste it as the `--invite` argument, and land directly on the clip's playback view.

**Phase 1 Definition of Done** (revised after 1.2 deferral):
- Free clips tab exists and round-trips across peers.
- A shareable link exists for at least one clip (Step 1.3).
- All previous tabs (Chat, Files, Tasks, Courses) still work.
- Live broadcast is deferred to Phase 3 (webinar room).

---

## Phase 2 — Identity & hand raise (Stage 2 of the funnel)

**Goal**: stop treating every visitor as an anonymous stranger. Give them a lightweight identity, then give them small one-click signals (like, follow) that let us remember which content resonated.

### Step 2.1 — Apply `/identity`

- Invoke `/identity` from inside `pearschool-mini/`.
- The skill adds a 24-word mnemonic identity + per-device keypair + signed messages. Importantly, it adds a `proof` field to outgoing messages.
- Because `/multi-rooms` is already applied, the agent must consult the SKILL.md "future combo" note (line referenced in `examples-skills/plan.md`: re-introduces `proof` field on add-message inside `ChatRoom` while keeping `ChatAccount` unchanged). Apply that variant — do not break the account base.
- Surface an **identity onboarding screen** the first time a user opens the app: show the 24-word mnemonic, force the user to confirm a few words, then unlock the rest of the UI. Adapt the templates' UX to fit Pearschool's slate-700 theme.

**Definition of Done**:
- Every message and comment carries a verifiable signature.
- A fresh peer is greeted by the mnemonic onboarding flow; subsequent launches skip it.

### Step 2.2 — Invoke `/basic-entity` to add **Like**

Storyteller answers the four interactive questions as follows:

- **Entity slug**: `like`
- **Display label**: `Like` / `Likes`
- **Attributes**:
  - `targetId` — string, required (id of the clip / live-session / comment being liked)
  - `targetType` — string, required (`clip` | `live` | `comment` | `course`)
  - `visitorId` — string, required (the liker's identity public key, in hex)
  - `note` — string, **display name** (used as the row's bold heading; defaults to "♥ <targetType>")
- **Statuses**: `active` / `removed`. First status `active` is default.

The Likes tab itself is not user-facing — it's the data store. Instead, the agent surfaces likes inline:

- Add a **heart button** on every clip card, every live-stream header, and every comment. Clicking adds (or removes) a `like` entity scoped to the current identity.
- Show a small count next to the heart on each item ("♥ 23"). Compute it from the likes list filtered by `targetId`.

**Definition of Done**:
- Clicking the heart on a clip on peer A increments the count on peer B within ~1 second.
- The count is consistent with the underlying entity list (which can be inspected from the Likes tab if Storyteller wants to keep it visible during debugging).

### Step 2.3 — Invoke `/basic-entity` to add **Follow**

Storyteller's answers:

- **Slug**: `follow`
- **Label**: `Follow` / `Follows`
- **Attributes**:
  - `teacherId` — string, required (followed identity public key)
  - `followerId` — string, required (follower identity public key)
  - `teacherName` — string, required, **display name**
- **Statuses**: `following` / `unfollowed`. First is default.

Surface on the teacher's profile area (and on every clip authored by the teacher): a **Follow** button that toggles between `following` and `unfollowed`. Show follower count derived from the follow entities filtered by `teacherId` and `status: 'following'`.

**Definition of Done**:
- Peer B clicks Follow on peer A's profile → peer A sees their follower count tick up.
- Reloading either peer preserves the follow state.

### Step 2.4 — Saved list (manual UI work)

- Add a **My saved** view that lists every clip the current identity has an `active` like for. Read from the likes entity filtered by `visitorId == self`.
- Surface it as a sub-section of the Free clips tab (a toggle: All / My saved).

**Definition of Done**:
- A clip the visitor hearted on peer A appears in My saved on peer B (same identity, different device) once the bases sync.

### Step 2.5 — Notifications on new free content (scope only — implementation deferred)

The agent writes a short **scoped design note** at `notes/notifications-design.md` rather than implementing this now. The note answers:

- What event triggers a notification? (new clip uploaded by a followed teacher; new live stream started.)
- Where is it displayed? (badge on the tab bar; small toast in the bottom-right.)
- Where is the read/unread state stored? (a new `notification` entity, scoped to the receiving identity.)
- What dependency would be needed for OS-level notifications? (Pear's `pear-electron` already has the hooks — record the API method to call.)

**Definition of Done**:
- `notes/notifications-design.md` exists with the four answers above. Implementation is a follow-up task.

**Phase 2 Definition of Done**:
- Onboarding mnemonic screen exists.
- Like and Follow buttons work and round-trip across peers.
- My saved view shows correct filtered list.
- Notifications design note checked in.

---

## Phase 3 — Webinar (Stage 3 of the funnel)

**Goal**: build the auditorium — a room type where the teacher hosts a scheduled session, the visitors who subscribed get reminded, and at the end of the session there's a button that takes them straight into the Stage 4 sales page.

### Step 3.1 — Invoke `/basic-entity` to add **Webinar**

Storyteller's answers:

- **Slug**: `webinar`
- **Label**: `Webinar` / `Webinars`
- **Attributes**:
  - `title` — string, required, **display name**
  - `description` — string (long-form, treat as textarea like Courses)
  - `hostId` — string, required (teacher's identity public key)
  - `scheduledAt` — int, date+time picker
  - `roomId` — string (the chat-room id where the live session is hosted, populated when the session goes live)
  - `replayUri` — string (URL or local pointer to recording once available)
  - `courseId` — string (the course to pitch at the end — links Stage 3 to Stage 4)
- **Statuses**: `scheduled` / `live` / `ended`. First is default.

Add a **Webinars tab** to the app showing all webinars grouped by status. Visitors can browse upcoming sessions and see past sessions with their replays.

**Definition of Done**:
- Teacher can create a webinar with all fields. It appears on both peers under Scheduled.
- Flipping status to `live` moves it to the Live section instantly (optimistic + autobase round-trip).

### Step 3.2 — Invoke `/basic-entity` to add **Subscription**

Storyteller's answers:

- **Slug**: `subscription`
- **Label**: `Subscription` / `Subscriptions`
- **Attributes**:
  - `webinarId` — string, required
  - `visitorId` — string, required (subscriber's identity public key)
  - `subscribedAt` — int, timestamp
  - `webinarTitle` — string, required, **display name** (denormalised so the row is readable)
- **Statuses**: `subscribed` / `attended` / `missed` / `cancelled`. First is default.

Surface on each webinar row in the Webinars tab: a **Subscribe** button. Show a subscriber count per webinar derived from subscriptions filtered by `webinarId`.

**Definition of Done**:
- Subscribing on peer A immediately shows the subscriber count rising on peer B.
- A subscriber can later cancel; the count drops.

### Step 3.3 — Build the webinar room shell (manual UI work)

A webinar room is a hybrid of `/multi-rooms` (chat) + `/live-cam` (broadcast). The agent builds it as a new room type rather than a new skill:

- When a teacher launches a webinar (flips its status to `live`), the worker creates a new chat room scoped to that webinar and writes the room id back to the entity's `roomId` field.
- The renderer detects this and offers a **Join live session** button on the row.
- Inside the room, the layout is: large video player on the left (the live broadcast from the teacher's webcam), chat thread on the right. The audience can post chat messages but cannot start their own broadcasts. The teacher's UI has the **Start broadcast** controls; everyone else's UI hides them.
- Hard-rule: only the host (matching `hostId`) can flip the webinar to `live` or `ended`.

**Definition of Done**:
- Teacher schedules a webinar, flips it to `live`, subscribers see the **Join live session** button, click it, and land in a room with the teacher's webcam and a chat sidebar.
- A non-host's UI does not show broadcast controls.

### Step 3.4 — Reminders (deferred — scope only)

Write `notes/reminders-design.md` covering:

- The cadence (24h, 1h, "we're live now").
- Which subsystem generates them (a small reactor in the worker that polls the webinar list against `Date.now()` and fires events).
- How they're displayed (reuse the notifications design from Step 2.5).
- Edge case: clock drift between peers — we trust the local clock for "now" but the `scheduledAt` is the host's clock, so the reminder windows might be off by a few seconds. Acceptable.

**Definition of Done**:
- `notes/reminders-design.md` exists.

### Step 3.5 — End-of-webinar pitch slot (manual UI work)

- The webinar room layout has a slot below the video. While the webinar is `live` and within the last 5 minutes (or whenever the host flips a "show pitch" toggle), the slot reveals a card with the linked course (`courseId` from the webinar entity), a one-line headline, and a **Buy this course** button.
- Clicking the button takes the visitor to the Stage 4 sales page for that course.

**Definition of Done**:
- Host can manually toggle the pitch card. On every viewer's screen it appears within ~1 second.
- The button navigates to the correct sales page.

### Step 3.6 — Replay

- When the webinar is flipped to `ended`, the live broadcast's recording is published as a free clip via the Free clips tab (reuse Phase 1 infrastructure).
- The webinar entity's `replayUri` is updated to point at that clip's id.
- The Webinars tab's Ended section shows a **Watch replay** button on each row that opens the clip.

**Definition of Done**:
- Ending a webinar produces a replay link that plays back the recording for any peer who missed the live session.

**Phase 3 Definition of Done**:
- Webinar and subscription entities work end-to-end.
- Webinar room shell hosts a live session with broadcast + chat.
- Pitch slot reveals correctly and links to the right course.
- Replay is accessible after the session ends.

---

## Phase 4 — Sales (Stage 4 of the funnel)

**Goal**: turn an attendee into a paying student. Sales page → order page → Lightning payment → course unlocked.

### Step 4.1 — Extend Courses with sales-page fields

The Courses entity already has `title`, `instructor`, `room`, `startDate`, `status`, `description`. We need more for the sales page. Rather than invoking `/basic-entity` again (which would create a new entity), the agent edits the existing `schema.js`, `worker/chat-account.js`, `lib/use-worker.js`, `ui/root.jsx` to add the following fields onto `course`:

- `headline` — string (one-line elevator pitch)
- `bullets` — string (long-form, newline-separated key takeaways)
- `testimonials` — string (long-form, freeform)
- `faq` — string (long-form, freeform)
- `priceSats` — int (Lightning price in satoshis)

Add fields at the **end** of the course schema (never in the middle — keep field IDs stable so old records still decode). Regenerate the spec (`npm run build:db && npm run build`) and verify the bundle still builds.

**Definition of Done**:
- Teacher can fill in the new fields when creating or editing a course.
- Old courses created before this change still load (`description` was already optional — these new fields are too).

### Step 4.2 — Sales page view (manual UI work)

- Add a per-course sales page route. When a visitor clicks a course title (or lands via a Share link with `#course=<id>`), they see a full-page layout with: hero (headline + price), the bulleted takeaways, the description, testimonials, FAQ, and a sticky **Buy this course** button.
- The sales page is read-only for everyone except the host.
- Layout uses the existing Tailwind theme. Mobile-friendly is a bonus, not a requirement.

**Definition of Done**:
- Visitor on peer B can land on a sales page for a course created on peer A and read all fields.
- Clicking **Buy this course** advances to the order page.

### Step 4.3 — Order page (manual UI work)

- A short page between sales and payment. Shows:
  - Course title + price.
  - Buyer's identity short hash (proof we know who is paying).
  - A **Generate invoice** button.
- After the invoice is generated (Step 4.4), this page shows the Lightning QR code, the bolt11 invoice string (copyable), and a live status indicator that polls payment state.

**Definition of Done**:
- Visitor lands here after Buy. Identity is shown. Generate Invoice button exists (no-op until 4.4).

### Step 4.4 — Lightning payment integration (new feature — no skill)

There is no skill for Lightning. The agent must scope this carefully:

- **Decision point**: which Lightning backend? Ask Storyteller. Choices:
  - LNbits (self-hosted, HTTP API, fastest to wire up).
  - Breez SDK (embedded node, more invasive).
  - Phoenix / Cashu / NWC (NWC = Nostr Wallet Connect, peer-friendly).
- After Storyteller picks a backend, the agent adds a new worker-side module (`worker/payments.js`) that:
  - Generates a bolt11 invoice for a given course price.
  - Polls the backend for payment confirmation.
  - Emits an event on payment confirmation that the renderer can subscribe to.
- The renderer's order page subscribes to that event. On confirmation, it advances to the receipt page (Step 4.6).

**Definition of Done**:
- Generating an invoice produces a real bolt11 string that a Lightning wallet on Storyteller's phone can scan and pay.
- Payment confirmation arrives at the renderer within ~5 seconds of the wallet showing "paid".

### Step 4.5 — Invoke `/basic-entity` to add **Purchase**

Storyteller's answers:

- **Slug**: `purchase`
- **Label**: `Purchase` / `Purchases`
- **Attributes**:
  - `courseId` — string, required
  - `buyerId` — string, required (identity public key)
  - `priceSats` — int, required
  - `bolt11` — string (the invoice string, for audit)
  - `paidAt` — int, timestamp of confirmation
  - `courseTitle` — string, required, **display name** (denormalised)
- **Statuses**: `pending` / `paid` / `refunded` / `expired`. First is default.

The payment module from Step 4.4 writes a `pending` purchase when the invoice is generated, flips it to `paid` when the backend confirms, and `expired` after the invoice TTL.

**Definition of Done**:
- A pending purchase entity appears the moment the invoice is generated.
- It flips to `paid` automatically after the wallet pays.

### Step 4.6 — Course unlocking & receipt

- **Unlocking gate**: the Courses tab shows the full content (description, lessons, materials) only if the current identity has a `paid` purchase for that course. Otherwise it shows the sales-page view.
- **Receipt page**: a simple post-payment screen with the course title, the satoshi amount, the date, the buyer's identity, and a permalink to the purchase entity. Linked from the buyer's profile area as **My purchases**.

**Definition of Done**:
- Before payment, peer B sees the sales page for a course. After paying, peer B sees the full course content.
- My purchases lists the new entry.

**Phase 4 Definition of Done**:
- Sales page → order page → invoice → wallet payment → course unlocked → receipt — all working on a real Lightning wallet, end-to-end.

---

## Phase 5 — End-to-end verification

**Goal**: prove the full funnel works in one sitting on two peers.

### Step 5.1 — Two-peer funnel smoke test

The agent runs through this script, verifying each transition out loud:

1. Peer A (`/tmp/pearschool-mini-user1`) — teacher.
2. Peer B (`/tmp/pearschool-mini-user2`) — visitor. Joins via account invite. Onboards with a new mnemonic.
3. Blind-peer relay running: `npx --yes blind-peer -s /tmp/pearschool-mini-blind1`.
4. **Stage 1**: peer A uploads a free clip. Peer B sees it on the Free clips tab.
5. **Stage 2**: peer B hearts the clip and follows peer A. Peer A's follower count and the clip's heart count rise.
6. **Stage 3**: peer A creates a webinar linked to a course, flips it to live, broadcasts via webcam. Peer B sees the **Join live session** button on a webinar they subscribed to. They join. They see the live feed and the chat. Peer A toggles the pitch slot. Peer B clicks **Buy this course**.
7. **Stage 4**: peer B lands on the sales page. Clicks Buy. Sees the order page with their identity. Generates an invoice. Pays from a real Lightning wallet. The page flips to the receipt. The Courses tab now shows the full course content.
8. **Phase 0**: peer A closes the app mid-test. Peer B can still load the clip from Stage 1 (blind-peer relay served it).

**Definition of Done**:
- All eight checkpoints above pass without manual intervention beyond clicks.
- No regressions in the Tasks tab.

---

## Skill invocation summary (for quick scanning)

In dependency order:

- `/blind-peering` — Phase 0.1
- `/photo-backup` — Phase 1.1
- `/live-cam` — Phase 1.2
- `/identity` — Phase 2.1 (with the multi-rooms combo variant)
- `/basic-entity` (slug `like`) — Phase 2.2
- `/basic-entity` (slug `follow`) — Phase 2.3
- `/basic-entity` (slug `webinar`) — Phase 3.1
- `/basic-entity` (slug `subscription`) — Phase 3.2
- `/basic-entity` (slug `purchase`) — Phase 4.5

Total: 9 skill invocations + manual UI work for shareable links, webinar room shell, pitch slot, sales page, order page, receipt page + a Lightning payment module + two design notes (notifications + reminders).

---

## Things the executing agent must ask Storyteller before starting each phase

- **Phase 1.2 — `/live-cam`**: is FFmpeg installed on this machine? What OS? (Affects platform args.)
- **Phase 2.1 — `/identity`**: should the onboarding screen force the user to write down the mnemonic, or just display it once and trust them? (Trade-off: friction vs. recovery.)
- **Phase 4.4 — Lightning backend**: LNbits / Breez / NWC / other? (Hard dependency on this choice.)
- **Phase 4.5 — Purchase entity**: should we also track refunds, or only forward-flow purchases for v1?
- **Phase 5 — Smoke test**: which Lightning wallet will be used? (Phoenix on iOS, Zeus on Android, Alby on desktop, etc.)

The agent must surface these questions before invoking the corresponding skill or writing code — answers can change the templates or modules required.

---

## Out of scope (for this plan)

- Email digest notifications.
- Mobile app builds.
- Tax / VAT invoicing.
- Multi-currency pricing (Lightning sats only for v1).
- Refund automation (manual via wallet for v1; the entity has a `refunded` status but no automation).
- Embed widget for external blogs.
- Search across content.
- Moderation / abuse reporting.

These are tracked here so the agent doesn't accidentally scope-creep into them.

---

## Files the agent will create or modify

- `schema.js` — new fields and new entities per Phases 1–4.
- `worker/chat-account.js` — new router handlers and CRUD methods per entity.
- `worker/chat-room.js` — reject handlers for account-scoped ops.
- `worker/worker-task.js` — HRPC handlers, push intervals.
- `worker/payments.js` — **new file**, Phase 4.4.
- `lib/use-worker.js` — new state slots and optimistic wrappers per entity.
- `ui/root.jsx` — new panels and tabs per phase.
- `ui/sales-page.jsx`, `ui/order-page.jsx`, `ui/receipt-page.jsx` — **new files**, Phase 4.
- `ui/webinar-room.jsx` — **new file**, Phase 3.3.
- `notes/notifications-design.md` — **new file**, Phase 2.5.
- `notes/reminders-design.md` — **new file**, Phase 3.4.
- `README.md` — update the "Walkthrough" section after each phase with the new feature.

After every phase the agent runs `npm run build:db && npm run build` and confirms no errors before moving on.
