# Issues

Open items left at the end of the Tasks-tab work session. Each entry has a one-line summary, the symptom, what we tried, and the obvious next step.

## 1. Tasks tab — added tasks do not appear in the UI

**Symptom.** In the Tasks tab, fill in a task name, choose status `Open`, click **Add task**. The form clears, but the task never appears under "Open (0)" or "Closed (0)". Both counters stay at 0. Same on toggle — clicking the checkbox on a row that exists in another peer's view doesn't reflect either.

**What we tried.**

- Generated the task `id` on the renderer (the HRPC route `add-task` uses `@pearschool-mini/task` as its request schema, which marks `id` as `required`; the original UI omitted `id` and the encoder silently failed). Fixed in `lib/use-worker.js`.
- Added a status dropdown (Open/Closed) to the Add form. Fixed in `ui/root.jsx`.
- Switched the worker's task fetching from event-driven (`account.on('update')` → `debounceTasks` → `_tasks`) to polled (1s `setInterval`), mirroring the proven Files/`drives` pattern. In `worker/worker-task.js`.
- Added explicit logging in both processes:
  - Worker: `[tasks] onAddTask received:`, `[tasks] account.addTask completed`, `[tasks] _tasks fetched N task(s):` plus error catches. In `worker/worker-task.js`.
  - Renderer: `[tasks renderer] addTask sending:`, `[tasks renderer] addTask returned:` plus error catches. In `lib/use-worker.js`.

**Where we got stuck.** Never collected the actual log output from a real run. Without that, we don't know which link in the chain breaks (HRPC encode on renderer, transport, `onAddTask` handler, autobase append, router insert, `getTasks` query, HRPC encode of array reply, or React state update).

**Obvious next step.**

1. Restart `pear run` for alice (no `--reset` needed — schema is unchanged).
2. Open Pear DevTools (`Cmd+Option+I` on Mac) and switch to the Console tab.
3. Click **Add task**.
4. Capture both:
   - **Terminal stdout/stderr** for any line starting with `[tasks]` or any `Uncaught` / stack trace.
   - **DevTools Console** for any line starting with `[tasks renderer]` or any error.
5. The first place a log is missing or an error appears pinpoints the broken link. See the diagnostic ladder in the bottom of [`worker/worker-task.js`](worker/worker-task.js) and [`lib/use-worker.js`](lib/use-worker.js).

## 2. Debug logging left in the worker and renderer

**Symptom.** Every launch prints `[tasks] _tasks fetched N task(s):` once per second once tasks exist, plus per-click renderer logs. Noisy.

**Where.** `worker/worker-task.js` — `onAddTask` handler and `_tasks()`. `lib/use-worker.js` — `addTask` and `setTaskStatus`.

**Obvious next step.** Once issue #1 is diagnosed and fixed, strip every `console.log('[tasks ...')` and `console.error('[tasks ...')` from both files and rebuild. Keep the `try/catch` only if there's a recurring error class worth surfacing to the user.

## 3. HRPC `add-task` request schema is the same as the on-disk row schema

**Symptom.** The HRPC route `add-task` uses `@pearschool-mini/task` as its payload — the same schema that defines a row in the on-disk `tasks` collection. That schema marks `id` as `required`, which forces the renderer to generate the id before sending. New tasks and status updates use the same path, which works but feels off (the `id` should be a worker concern for new tasks, not a renderer concern).

**Compare to messages.** `add-message` uses a dedicated `@pearschool-mini/add-message` schema (`{ text, roomId }`) — `id` and `info` are added by the worker. Cleaner separation between "what the user typed" and "what gets stored on disk."

**Obvious next step.** Add a dedicated `add-task` schema in `schema.js` modeled on `add-message`:

```js
schema.register({
  name: 'add-task',
  fields: [
    { name: 'id', type: 'string' },           // optional — present only on updates
    { name: 'name', type: 'string', required: true },
    { name: 'description', type: 'string' },
    { name: 'dueDate', type: 'int' },
    { name: 'status', type: 'string', required: true }
  ]
})
```

Then change the HRPC route `add-task` to use `'@pearschool-mini/add-task'` as its request type, and have the worker's `onAddTask` handler synthesize `id` (when missing) and `info` (with `at: Date.now()`) before calling `account.addTask`. The renderer drops the id-generation in `use-worker.js`. **This is a schema change** — needs codegen + `--reset` on every peer.

## 4. Per-room tasks (postponed)

**Symptom.** Tasks live on the **account autobase**, alongside `drives`. They sync across one peer's devices (anyone paired via the **account** invite) but not across peers who only share a **room**. The user's request "I want shared tasks around all rooms" was for per-room tasks where each room has its own list shared by everyone in that room — the same pattern messages already use.

**Where we got stuck.** Started the refactor — added `get-tasks` and `add-task` schema types to `schema.js`, then the user said `stop`. Reverted the schema.js edit. No other files were touched.

**Obvious next step.** A clean redo, mirroring how `messages` is wired:

- `schema.js` — add `get-tasks` (`{ tasks, roomId }`) and `add-task` (task fields + `roomId`) schema types; change the HRPC `tasks` and `add-task` routes to use them.
- `worker/chat-room.js` — register the `add-task` router handler (insert into the room's `tasks` collection), add `addTask(task, info)` and `getTasks()` methods.
- `worker/chat-account.js` — flip the `add-task` router handler from `insert` to `throw` (room-scoped, not account-scoped); proxy `addTask(roomId, task, info)` and `_tasks(roomId)` / `_watchTasks(roomId)` events to the per-room methods, mirroring how `addMessage` / `_messages` / `_watchMessages` already work.
- `worker/worker-task.js` — emit `tasks` per-room over HRPC as `{ tasks, roomId }`; remove the polled `intervalTasks`.
- `lib/use-worker.js` — change `tasks` state to `{ [roomId]: tasks[] }`, key API by roomId.
- `ui/root.jsx` — give `<TasksPanel>` a room sidebar like `<ChatPanel>`.

**This is a schema change** — codegen + `--reset` on every peer required.

## 5. `pear run` is deprecated

**Symptom.** Every launch starts with:

```
DEPRECATED: pear run is deprecated and will be removed
Use the pear-runtime module instead
```

**Where.** Every command in `README.md` uses `pear run`. The replacement is the `pear-runtime` module, but the migration path is not documented in this repo and was not researched in the session.

**Obvious next step.** Read the upstream `pear-runtime` docs, write a tiny launcher script (or update `package.json` `scripts.start`), and replace `pear run` invocations in `README.md`. Verify on at least one of the three processes (alice, bob, blind peer) before swapping the rest.

## 6. Schema migration trap (already in README, kept here as a reminder)

**Symptom.** Any change to `schema.js` that adds, removes, or reorders a collection or dispatch op shifts the on-disk IDs and offsets HyperDB writes into every autobase block. Old stores then crash the worker on open with `Out of bounds` (decode failure) or `Unknown collection type: N`.

**Where.** Documented in `README.md` ("Caveat — schema migrations need a coordinated `--reset`" and "Walkthrough — adding the Tasks tab"). Worth re-stating here because issues #3 and #4 both require schema changes and will trip this trap.

**Obvious next step.** Whenever you re-run `npm run build:db`, also wipe and re-pair: alice's store, bob's store, and the blind peer's store. Bob needs a fresh account invite from alice's first launch.

## 7. Worker stdout invisible in `pear run` terminal — RESOLVED 2026-05-18

**Symptom.** Running `pear run …` shows `✔ Pre-run [pear-electron/pre]: configure` and then nothing — no `Storage:`, no `Name:`, no `Invite:`, no `[tasks]` / `[chat]` / `[videos]` log lines. Yet the renderer is alive and RPCs round-trip (course adds work). The worker is running but its `console.log` calls aren't reaching the terminal.

**Resolution.** Closed alongside #8 and #9 — see the recovery recipe in `plan-for-execution.md`. The worker-log file workaround (`worker/worker-task.js` `_open()` mirrors `console.log` / `console.error` into `<storage>/../worker.log`) is **still in place** and remains useful for future debugging. Tail with `tail -f /tmp/pearschool-mini-user1/worker.log` in a second terminal.

**Underlying cause not investigated.** Worker stdout still doesn't reach the parent terminal — the log-file mirror just papers over that. Suspects: the `pear-electron` runtime in this version pipes worker output somewhere other than the parent terminal; or `pear run` (now deprecated, see Issue #5) lost forwarding when the deprecation landed. Migrating to `pear-runtime` (Issue #5) may fix it on its own.

## 8. Free clips — MP4 drop produces no visible result (Phase 1.1) — RESOLVED 2026-05-18

**Symptom.** Drop an MP4 (or any media file) anywhere on the **Free clips** tab. Nothing appears in the gallery. Other tabs (Chat, Files, Tasks, Courses) work normally.

**Resolution.** Cleared without any code change. The fix was on the network side: restart the blind-peer process to get a fresh blind-peer-key, restart Alice with the new key (no `--reset`), get a fresh account invite, restart Bob with that invite + the new blind-peer-key (no `--reset` on Bob either). After that, MP4 drops round-trip across peers. See the recovery recipe in `plan-for-execution.md` for the exact steps.

**Underlying cause not investigated.** A stale blind-peer-key (or a wedged blind-peer process holding an old session) appears to have silently blocked the blob-sync path used by `addVideo` while leaving cheaper round-trips like courses working. Worth a follow-up investigation if the same symptom recurs.

## 9. Chat tab — sent messages don't appear in the UI (regression introduced in Phase 1.1) — RESOLVED 2026-05-18

**Symptom.** Type a message in the Chat tab, hit Send. The input clears but nothing appears in the messages list.

**Resolution.** Same fix as #8 — restart blind-peer with fresh key, re-pair Alice + Bob with the new blind-peer-key and a fresh account invite, no `--reset` needed on either peer. Chat messages round-trip again after that. See the recovery recipe in `plan-for-execution.md`.

**Underlying cause not investigated.** Same suspect as #8 — a stale blind-peer-key blocking sync. The renderer chain (`[chat] onSend …` → `[chat] rpc.addMessage()`) was always firing correctly; the breakage was downstream of the worker, in the autobase replication layer that blind-peer fronts.

## 10. Phase 1.1 needs end-to-end verification — RESOLVED 2026-05-18

Phase 1.1 (Free clips, account-scoped) verified end-to-end on 2026-05-18: MP4 drop on Alice appears on Bob, chat round-trips, courses / tasks / files unchanged. Closed alongside #8 and #9.

## 11. Share-link recipient (clara) does not see alice's rooms / chats after auto-pair

**Status as of 2026-05-18.** Phase 1.3 Share-link feature is shipped and functional in two of its three claims:

- ✅ Share button produces a real, portable `pear://<key>?invite=<z32>#clip=<id>` link.
- ✅ Recipient launching with that link auto-pairs (worker reads `?invite=` from `Pear.config.applink`).
- ✅ `#clip=<id>` fragment auto-navigates to the Free clips tab and the player view.
- ❌ **Recipient does not see the host's rooms, messages, tasks, courses, or clip metadata after pairing.** Alice is online during clara's launch. Clara reports no rooms in her Chat tab sidebar.

**Suspected cause — race condition in `worker/chat-account.js::_open()`.** When clara joins via invite:

1. Account base pairs against alice's (alice must be online — confirmed).
2. Base becomes writable.
3. `view.core.download({ start: 0, end: -1 })` is called but **not awaited**.
4. `await this.openRooms()` runs immediately and queries the view — returns **empty** because alice's blocks haven't replicated yet.
5. The bootstrap condition `Object.keys(this.rooms).length === 0 && this.base.writable` evaluates **true** → clara writes her OWN three predefined rooms to a base she's now sharing with alice.
6. When alice's actual rooms finally sync in later, the base contains a mix of alice's three rooms + clara's three duplicates. Clara's renderer shows hers; she has no writer key for alice's per-room bases, so even when their room metadata syncs in, she can't open them as a writer.

**Why this didn't bite bob.** Bob has joined this way successfully in past sessions. Either the race is non-deterministic (sync was fast enough that step 4 saw alice's rooms before bootstrap), or there's something subtly different about clara's flow (e.g. a colder swarm, alice mid-restage, longer pairing latency).

**Diagnostic recipe.**

1. Restart alice (stay online, blind peer running).
2. `rm -rf /tmp/pearschool-mini-clara && pear run --store /tmp/pearschool-mini-clara "<share-link>" --name clara`
3. Wait 60s.
4. Tail clara's worker log: `tail -f /tmp/pearschool-mini-clara/worker.log` — note any errors during pairing or `openRooms()`.
5. In clara's Chat tab sidebar, count rooms:
   - **0 rooms** → account-base pairing didn't complete (alice may have been offline at the wrong moment).
   - **3 rooms with no messages** → her OWN bootstrapped rooms (race condition confirmed); per-room IDs won't match alice's.
   - **3 rooms with alice's messages** → race didn't fire this time; it's intermittent.
   - **6+ rooms** → both sets present; race confirmed.

**Proposed fix.** In `worker/chat-account.js::_open()`, after the base becomes writable and before `openRooms()`:

1. If we joined via invite (`isEmpty && this.invite` was true), explicitly await an initial sync — wait for the first `update` event that brings non-zero rooms, with a timeout fallback (e.g. 10s) so a genuinely-empty host doesn't hang the new peer forever.
2. Only run the predefined-rooms bootstrap when we both (a) have no remote rooms after the sync wait AND (b) did NOT join via invite (i.e. we're the host of a fresh account, not a joining peer).

Specifically, the bootstrap guard should become:

```js
const joinedViaInvite = isEmpty && this.invite
if (!joinedViaInvite && Object.keys(this.rooms).length === 0 && this.base.writable) {
  for (const def of PREDEFINED_ROOMS) await this.addRoom(def.name, def.info)
}
```

The `joinedViaInvite` test is the key — a peer joining someone else's account should **never** bootstrap predefined rooms, full stop. The current code conflates "no remote data yet" with "I'm a fresh host" and that's the bug.

**Workaround for now.** Recipients should:
- Wait 60+ seconds before clicking around (give sync a chance).
- If still empty, use the manual flow: alice prints her account invite once with `getInvite()`, sends it out-of-band, recipient launches with `--invite <z32>` separately (no URL).

**Blocks.** Phase 2 (identity + hand-raise) doesn't strictly need this fixed — the bug is in the auto-pair from URL flow specifically, not in the manual flow. But the funnel's Stage 1→2 step is "share a clip → visitor lands → visitor identifies themselves", so without #11 fixed the Share-link UX has a misleading first impression.
