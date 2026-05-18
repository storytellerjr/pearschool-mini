# Pearschool Mini — Technical Background

Deep-dive companion to [`README.md`](README.md). Covers how the project was built in layers, the app's internal architecture, the blind-peering layer in detail, schema-migration traps, a worked example of extending the app with a new collection (the Tasks tab), how to build a distributable Pear app, and the full troubleshoot list.

## How this was built (layers)

- **Study.** First, the pearopen libraries (hypercore, hyperdb, autobase, hyperswarm, hyperdrive, blind-pairing, blind-peering, hrpc) were studied to understand how a fully peer-to-peer app is composed. Source of inspiration: [pearopen/examples-p2p-desktop](https://github.com/pearopen/examples-p2p-desktop).
- **Skills.** What was learned was packaged as a set of reusable Claude Code skills (`/chat`, `/multi-rooms`, `/file-sharing`, `/basic-entity`, `/blind-peering`, `/photo-backup`, `/live-cam`, `/identity` — see `../examples-p2p-desktop/examples-skills/`).
- **Baseline app.** Those skills were composed in order to produce the current baseline: account base + per-room bases, Chat / Files / Tasks / Courses / Free clips tabs, blind-peering wired into every base on launch.
- **Sales funnel plan.** With a working app in hand, a four-stage sales funnel (free content → identity & hand-raise → webinar → Lightning-paid course) was designed on top — see `sales-funnel.md`.
- **Plan for execution.** That funnel was turned into a step-by-step plan an AI agent can execute — see `plan-for-execution.md`.

## What it is, technically

P2P **multi-room** chat + file-sharing on the Pear / Holepunch stack, with **blind-peering** for offline-tolerant replication.

Stack: holepunch, bare, pear, corestore, hyperswarm, blind-pairing, blind-peering, hyperdb, hrpc, autobase, hyperdrive, localdrive.

## App shape

- **Account base + N room bases.** Each peer has one *account* autobase (holds invites, the `rooms` list, and account-level drives) and one autobase per room (holds that room's messages).
- **Three predefined rooms** are auto-created on the first launch of a fresh account: **Welcome Lobby**, **Community Chat**, **Personal Notes**. Each has a distinct background colour in the UI.
- **Two tabs in the renderer.** Chat tab — room sidebar plus the selected room's messages (background coloured per room). Files tab — drag-and-drop drive shared across the whole account (not per-room).
- **Account invite** (the `--invite` CLI flag) admits another peer as a writer on the *account base* — conceptually "another device of yours". That peer's account inherits your rooms list, and each room's invite is embedded in the rooms collection so the new peer auto-pairs into every room.

## Blind peering

Blind peering is how this app survives writers going offline. A **blind peer** is an always-on mirror process — it doesn't author messages, it just replicates the encrypted hypercore blocks of every autobase it's asked to mirror. When a peer writes while the other is offline, the blind peer holds the new blocks and serves them when the offline peer comes back.

### What the app mirrors

On each launch, `WorkerTask` (`worker/worker-task.js:27`) constructs a `BlindPeering` client and adds every base the worker opens:

- `addAutobase(account.base)` — the account autobase (invites, rooms list, drives, tasks)
- `addAutobase(room.base)` — once per opened room, so each room's messages base is mirrored

For a paired alice + bob with three rooms, one blind peer ends up mirroring four bases per peer. Under the hood it connects to the mirror over hyperswarm, pushes new blocks as the local user appends, and pulls blocks from the mirror when remote writers are offline.

### Run a blind peer

Use the published `blind-peer` CLI — nothing app-specific. Leave one running for the whole session:

```shell
npx --yes blind-peer -s /tmp/pearschool-mini-blind1
```

Copy the `Listening at <listening-key>` line from its log. The listening key is deterministic for the `-s` path: restart with the same path, get the same key back; wipe the directory, get a new key.

### Wire a Pear client to the blind peer

Pass the listening key to each Pear client via `--blind-peer-key|-b`:

```shell
pear run --store /tmp/pearschool-mini-user1 . --name alice --blind-peer-key <listening-key>
```

The flag is **repeatable** — pass it more than once to mirror to several blind peers (`-b <keyA> -b <keyB>`). Omit it entirely and `BlindPeering` is built with `mirrors: []`: direct P2P only, no offline tolerance.

### What blind peering does and doesn't give you

What you get:

- **Offline writes.** A peer can write and quit. Another peer launching later picks up the new blocks via the blind peer, even if the writer never comes back online that session. See `## Test the offline-delivery feature` below.
- **Redundancy.** Multiple `--blind-peer-key` flags give you several independent mirrors.

What you don't get:

- **Pairing without a live writer.** `blind-pairing` is an interactive handshake — the mirror replicates encrypted blocks but cannot complete it. The first time a new peer joins the account, the host must be online; same for the per-room pairing handshakes during `openRooms()` on the new peer's first launch.

### Production note

The `npx blind-peer` flow above is a dev convenience — that CLI mirrors any base whose key is presented to it. For anything beyond local testing, run your own blind peer with quotas and authentication, and treat its listening key like a credential — don't publish it.

## The three predefined rooms

Defined in `worker/chat-account.js` at the top of the file:

| Room name        | Background colour (Tailwind) |
|------------------|------------------------------|
| Welcome Lobby    | `bg-emerald-500` (green)     |
| Community Chat   | `bg-purple-500` (purple)     |
| Personal Notes   | `bg-amber-500` (amber)       |

Edit `PREDEFINED_ROOMS` in `worker/chat-account.js` to add/rename/recolour rooms. **Be aware**: the bootstrap only runs once per account base (when the rooms collection is empty), so changing the array after the rooms exist on disk has no effect — wipe the store with `--reset` to re-bootstrap, or extend the bootstrap to upsert by name.

### Caveat — these are "shared rooms" only via the account invite

The three rooms only land in the **same** underlying autobases for two peers when the second peer joins via the **account** invite (the one printed on alice's stdout). A peer that boots with no `--invite` (or with `--reset` and no invite) gets their own isolated account and runs its own bootstrap — so they'll see the same room *names* and *colours* (because both copies of the code use the same `PREDEFINED_ROOMS` table), but the room IDs, invite strings, and message histories are different. From alice's point of view, bob's "Welcome Lobby" is a separate room she has no writer key for.

This is a consequence of the multi-room architecture: rooms are owned by the account base that created them, and a fresh account base has no way to know about another peer's rooms. If you want a truly global namespace where *every* peer who launches the app lands in the *same* Welcome Lobby without any pairing handshake, that needs a different model — typically deterministic room keys derived from a shared seed baked into the app, sidestepping the per-account invite flow. Not implemented here.

### Caveat — schema migrations need a coordinated `--reset`

`hyperdb` writes its collection IDs and dispatch offsets into every block of the autobase log. If you change `schema.js` (rename a namespace, add/remove a collection, reorder dispatch ops) the on-disk blocks from the old schema become unreadable to the new code — the worker will crash with `Unknown collection type: N` the next time it opens the store. The fix is `--reset` on every peer's store, which means every peer rejoins as a fresh writer and needs a new account invite from whoever is still paired. There is no migration path in-band; for a real app you would either freeze the schema or bake a version-aware migration step into the worker. The schema has already changed once in this project (single-room → multi-room) and the same trap applies for any future change.

## Test the offline-delivery feature

With all three processes running and chatting in one of the rooms:

1. Quit bob.
2. Send a message from alice in any room.
3. Quit alice.
4. Restart bob with the **same** command from the README's step 3 (same `--store`, same `--blind-peer-key`, same `--invite`, **no `--reset`**).

Bob should see alice's last message in the same room within a few seconds, even though alice is offline.

The same works for files in the Files tab.

## Walkthrough — adding the Tasks tab

The Tasks tab is a worked example of extending this app with a new collection. Use it as a recipe for any "list of records you can read, append, and mutate" feature.

### The original ask

> If I want to create a To-Do list. It is just like a basic chat but instead of the "chat" every user can add a task. A task has a name, a short description, a due date and a status (open or closed). This task is on a next tab. How can we create this?

### Decision — account-scoped, not room-scoped

Tasks live on the **account autobase**, alongside the `drives` collection. That makes them shared across all of one peer's devices (anyone who paired with the **account** invite) but **not** shared with peers who only share a **room** with you. If you want per-room shared tasks instead, register the same collection on the **room** base (`worker/chat-room.js`) and key the HRPC stream by `roomId` the way `messages` already is.

The decision tracks the existing app's split: chat messages are room-scoped (per `ChatRoom.base`), the Files drive is account-scoped (per `ChatAccount.base`). Tasks behave like Files.

### The change set

Six files, no new dependencies. Mirrors the shape of the existing `drives` collection end-to-end.

- **`schema.js`** — added the `task` schema (`id, name, description, dueDate, status, info`), the `tasks` array alias, the `tasks` collection keyed by `id`, the `add-task` dispatch op, and two HRPC routes: `tasks` (server-pushed list) + `add-task` (renderer to worker, payload is the task).
- **`worker/chat-account.js`** — registered `add-task` on the account router (insert into the `tasks` collection — HyperDB upserts on the primary key, so the same op handles both create and status updates). Added `addTask(task)` (generates an id if the renderer omits one) and `getTasks()` mirroring `addDrive` / `getDrives`.
- **`worker/chat-room.js`** — registered `add-task` on the room router as a `throw`. Mirrors how `add-drive` is rejected at the room base: an explicit error if a task op were ever misrouted onto a room base, instead of silent corruption.
- **`worker/worker-task.js`** — added `_tasks()` (queries `account.getTasks()` and pushes via `rpc.tasks(...)`), wired it to `account.on('update')` next to the existing `debounceRooms`, and added an `onAddTask` HRPC handler that delegates to `account.addTask`.
- **`lib/use-worker.js`** — added `tasks` state, subscribed to `rpc.onTasks`, and exposed `addTask(task)` plus a `setTaskStatus(task, status)` convenience that re-sends the task with the new status (HyperDB upsert).
- **`ui/root.jsx`** — added a `<TasksPanel>` component (name + description + date inputs + Add button, then Open/Closed sections with a checkbox to toggle status) and a third tab next to Chat and Files.

### Regenerate spec + rebuild UI

The schema changes need codegen, and the JSX needs an SWC pass:

```shell
npm run build:db   # regenerates ./spec/{schema,db,dispatch,hrpc} from schema.js
npm run build      # tailwind + swc bundle for the renderer
```

### Hard requirement — `--reset` after this change

Adding the `tasks` collection and the `add-task` dispatch op shifts the on-disk collection IDs and dispatch offsets that HyperDB writes into every block of the autobase log. Old stores from before this change will crash the worker on open with `Out of bounds` (decode failure) or `Unknown collection type: N` — the same trap covered in the schema-migration caveat above.

Wipe every peer's store and the blind peer's store, then re-pair from scratch:

```shell
rm -rf /tmp/pearschool-mini-blind1
npx --yes blind-peer -s /tmp/pearschool-mini-blind1
pear run --store /tmp/pearschool-mini-user1 . --name alice --blind-peer-key <new-listening-key> --reset
# copy alice's new account invite, then
pear run --store /tmp/pearschool-mini-user2 . --name bob --invite <new-alice-invite> --blind-peer-key <new-listening-key> --reset
```

Drop the `--reset` flag on subsequent launches.

### Verify

1. Open the Tasks tab on alice. Add a task ("Write release notes", short description, a date a few days out). It appears under **Open** with the date rendered.
2. Tick the checkbox. The task moves to **Closed** with the name struck through.
3. With bob running and paired into alice's account (same account invite), add a task on alice. Bob's Tasks tab updates within a second. Toggle status from either side and watch it reflect on the other.

### Caveats

- **Tasks sync per account, not per room.** Bob (a peer paired into alice's *rooms* only — not her *account*) does not see alice's tasks. The current README flow uses the account invite for bob, so this is fine for the default setup; it only matters if you later add a room-only invite path.
- **Status updates re-write the full task block.** Since HyperDB upserts on the `id`, toggling status appends a new block carrying the entire task payload — fine at this scale, but if tasks grow large or churn fast, consider a separate `update-task-status` op with a smaller payload.
- **Validation lives in the schema, not the worker.** A peer with a modified client could append an `add-task` with `status: 'banana'` and every other peer would accept it. The renderer only sends `'open'` or `'closed'`, but you'd want stricter validation in the router handler if untrusted writers can join.

### Follow-up — instant UI updates and a delete button

Two small follow-on changes built on top of the original Tasks tab:

#### Optimistic UI updates

The worker re-pushes the full tasks list every 1 second (`worker/worker-task.js:90`), so without intervention there's a 0–1 second lag between clicking **Add task** and seeing it appear in the **Open** group (same for ticking a checkbox moving a task to **Closed**). To make adds, status flips, and deletes feel instant, the renderer now mutates local `tasks` state *before* firing the RPC; the worker's next polling cycle then reconciles with autobase truth.

- **`lib/use-worker.js`** — added an `upsertTask(list, task)` helper (replaces by `id` or appends). `addTask` and `setTaskStatus` call `setTasks(prev => upsertTask(prev, payload))` synchronously before `rpc.addTask(payload)`. `deleteTask` does the same with a `filter`. No worker changes needed — the autobase write is still authoritative; the optimistic update just paints the result earlier.

#### Delete task

A `delete-task` dispatch op flows end-to-end the same shape as `add-task`, with a red **Delete** button on every task row in both Open and Closed groups.

- **`schema.js`** — added a `delete-task` message (just `id`), dispatch op, and HRPC route. All three appended at the **end** of their lists.
- **`worker/chat-account.js`** — registered `delete-task` on the account router (calls `view.delete('@pearschool-mini/tasks', { id: data.id })`). Added `deleteTask(id)` mirroring the shape of `addTask`.
- **`worker/chat-room.js`** — registered `delete-task` on the room router as a `throw`, matching how `add-task` is rejected.
- **`worker/worker-task.js`** — `rpc.onDeleteTask` delegates to `account.deleteTask`.
- **`lib/use-worker.js`** — `deleteTask(id)` covered above.
- **`ui/root.jsx`** — added the **Delete** button inside `renderTask`, wired to `deleteTask(t.id)`.

#### Why this change did NOT require `--reset`

HyperDB writes op IDs and collection IDs into every autobase block. The original Tasks walkthrough added a new *collection* (`tasks`), which shifted collection IDs and forced `--reset` on every peer. Adding `delete-task` afterwards is different: it only adds a new dispatch op, and that op was **appended at the end** of the dispatch registration in `schema.js`. The existing op IDs (`add-writer`, `add-invite`, `add-room`, `add-message`, `add-drive`, `add-task`) keep their slots, so old autobase blocks still decode against the new spec.

**Rule of thumb for future ops**: appending a new dispatch op (and its message schema) at the end of the registration lists is safe — no `--reset` needed. Reordering, inserting in the middle, or adding a new *collection* is not.

#### Regenerate spec + rebuild UI

```shell
npm run build:db   # picks up the new delete-task op + message
npm run build      # rebuilds the renderer bundle with the Delete button + optimistic state
```

Then restart `pear run` for alice and bob (no `--reset`).

## Schema changed since the single-room version

If you have a store from an earlier (single-room) build of this project, the autobase blocks in it will fail to load against the new schema. Wipe and start fresh on each peer:

```shell
pear run --store /tmp/pearschool-mini-user1 . --name alice --blind-peer-key <listening-key> --reset
pear run --store /tmp/pearschool-mini-user2 . --name bob --invite <alice-account-invite> --blind-peer-key <listening-key> --reset
```

Drop the `--reset` flag on subsequent launches.

## Build a distributable Pear app

```shell
npm i
npm run build

pear stage <channel>
pear seed <channel>

pear run --store /tmp/pearschool-mini-user1 <pear-link> --name alice --blind-peer-key <listening-key>
pear run --store /tmp/pearschool-mini-user2 <pear-link> --name bob --invite <invite> --blind-peer-key <listening-key>
```

## Troubleshoot

- **`--reset` wipes the local writer core**, including the user's seat in alice's rooms — after a reset, that peer needs a fresh account invite from a still-paired writer. Don't reset between offline-delivery tests.
- **Sidebar shows fewer than three rooms on alice's first launch** — the bootstrap is sequential; each room creates its own autobase. Wait 5–10 seconds. If still missing, check the terminal for errors and confirm `spec/` was regenerated against the current `schema.js`.
- **Bob's sidebar is empty even though pairing succeeded** — `openRooms()` requires alice to be online so bob's per-room pairing handshakes can complete. Bring alice back, restart bob (no `--reset`), wait a few seconds.
- **Chat or Free clips silently stop syncing** — first, try the recovery recipe in `plan-for-execution.md` (restart the blind peer with a fresh key, re-pair alice + bob with the new key and a new account invite, no `--reset` needed). Resolved Issues #7 / #8 / #9 in this project without any code change.
- **Worker stdout invisible in the terminal** — known: `pear run` doesn't forward worker logs. As a workaround, `worker/worker-task.js _open()` mirrors `console.log` / `console.error` into `<storage>/../worker.log` (e.g. `/tmp/pearschool-mini-user1/worker.log`). Tail with `tail -f /tmp/pearschool-mini-user1/worker.log` in a second terminal.
