# 🎓 Pearschool Mini

> **Yo Pear Babies, Storyteller in that house.** 🐻

## 🧒 What is this?

**Pearschool Mini** is a project by **Storyteller** for the **Pear Baby Room** and the **Pear School Room**  — an initiative to build a **peer-to-peer school** ✨ where instructors, trainers, and coaches can teach any topic directly to learners, **without a central server**.

We built it after studying [**Pearopen — examples-p2p-desktop**](https://github.com/pearopen/examples-p2p-desktop). All credit for the building blocks goes to them. 🙏 We took their examples, learned how a fully P2P app is composed, and assembled this app on top.

The name says it: **"mini"** 🤏 means we're first experimenting with Pear School at a small scale — testing the shape, the funnel, the feel — before going bigger.

The whole project is developed pair-style with **Claude AI inside the Void Editor**. 🤖

> 📚 Want the deep stack stuff (app architecture, blind-peering internals, schema migrations, the Tasks-tab walkthrough, building a distributable Pear app, full troubleshoot)? See [`README-technical-background.md`](README-technical-background.md).

## ⚙️ Install (once)

```shell
npm i
npm run build:db   # generates ./spec/{schema,db,dispatch,hrpc}
npm run build      # tailwind + swc bundle for the renderer
```

## 🚀 Run the three processes (three terminals)

### 1️⃣ Start the blind peer

In **terminal 1**, leave running for the whole session:

```shell
npx --yes blind-peer -s /tmp/pearschool-mini-blind1
```

Copy the `Listening at <listening-key>` line from its log. 🔑

### 2️⃣ Start alice (creates the account + 3 rooms)

In **terminal 2**:

```shell
pear run --store /tmp/pearschool-mini-user1 . --name alice --blind-peer-key <listening-key-from-step-1>
```

Alice's terminal prints an `Invite: <z32-string>` line — **that's the account invite**. Copy it for bob. 📨

### 3️⃣ Start bob (joins alice's account)

In **terminal 3**:

```shell
pear run --store /tmp/pearschool-mini-user2 . --name bob --invite <alice-account-invite> --blind-peer-key <listening-key-from-step-1> --reset
```

> ⚠️ Use `--reset` only on bob's **first** launch (or after a schema change). Drop it on subsequent launches so the store persists between sessions.

Both windows should now show the same three rooms (**Welcome Lobby**, **Community Chat**, **Personal Notes**). Chat, drop files, add tasks — everything round-trips between alice and bob. 🎉

## 🔗 Share a clip

Every clip in the **Free clips** tab has a small **🔗** button (and a big **🔗 Share clip** button in the player view). Click it to copy a `pear://` deep-link to that clip — anyone who launches the link with `pear run` lands directly on the playback view for that clip.

The link format is:

```
pear://run/<your-pear-link>?invite=<z32-account-invite>#clip=<clip-id>
```

- `?invite=` auto-pairs the recipient into your account (so they inherit your rooms + see your clips).
- `#clip=` makes the app jump straight to the clip's playback view on first paint.

> ⚠️ **Dev mode caveat**: while you're running `pear run .` (no staging yet), the link contains `<your-pear-link>` as a placeholder — Pear runtime doesn't have a real applink in dev. The app shows a small amber banner under the Free clips heading reminding you of this. To get a **real, shareable** link, **stage and seed** the app first (see below).

## 🚢 Stage and seed a link

Once you stage the app, the Share button auto-fills a real `pear://<key>` applink — no more dev-mode placeholder. Three one-time commands, then a short loop for every code change.

### One-time setup

**1️⃣ Touch** — generate a fresh pear-link for this project (run **once**):

```shell
pear touch
```

It prints `pear://<key>`. **Save it somewhere** — it's the canonical applink for this app, and every future `stage`, `seed`, and `run` uses it. 🔑

**2️⃣ Stage** — publish your local code to that link:

```shell
pear stage <pear-link-from-touch>
```

**3️⃣ Seed** — announce the staged hypercore on the swarm (leave this running in its own terminal, same posture as the blind peer):

```shell
pear seed <pear-link-from-touch>
```

### Launch from the staged link

```shell
pear run --store /tmp/pearschool-mini-user1 <pear-link> --name alice --blind-peer-key <listening-key>
pear run --store /tmp/pearschool-mini-user2 <pear-link> --name bob --invite <alice-account-invite> --blind-peer-key <listening-key>
```

Share clip now produces real, portable links. Anyone with Pear runtime installed can `pear run "<link>"` and land directly on your clip. 🎬

### Iteration loop after a code change

```shell
npm run build:db   # only if you edited schema.js
npm run build      # if you edited UI / input.css
pear stage <pear-link>   # republishes; running peers + seeders pick it up
```

You do **not** re-run `pear touch` (the link is permanent) or restart `pear seed` (it tracks the link, not a snapshot).

> 📚 More on what touch / stage / seed do under the hood is in [`README-technical-background.md`](README-technical-background.md).

## 👋 Invite a new visitor (e.g. clara)

Once the app is staged (above) and you've clicked the **🔗 Share clip** button on any clip, you have a link like:

```
pear://<key>?invite=<z32>#clip=<id>
```

A brand-new visitor (let's call her **clara**) can join in **one command** — no need to extract the invite by hand:

```shell
pear run --store /tmp/pearschool-mini-clara "<the-share-link>" --name clara
```

The worker reads the `?invite=` from the URL automatically, pairs clara into alice's account, and the `#clip=` fragment opens the player on first paint.

A few gotchas worth knowing:

- ⚠️ **Flag order**: `--store` must come **before** the link (it's a `pear run` flag, not a worker flag). Same shape as alice's command, just with a link in place of `.`. If you put `--store` after the link, you'll get `UNKNOWN_FLAG: store`.
- 👀 **Alice must be online** during clara's first launch — pairing is a live handshake; the blind peer can't complete it for her. Subsequent launches with the same `--store` reuse the persisted store and work fine when alice is offline.
- ⏳ **Sync takes a moment** — after pairing, alice's rooms list, tasks, courses, and free clips replicate into clara over a few seconds. The **clip's binary** (the actual video file) is downloaded separately via Hyperblobs and can take longer (10–60s depending on file size + network). The player view shows "Loading clip… (id: …)" until it arrives.
- 🌐 **No blind-peer-key by design**: the share link doesn't embed the blind-peer-key — it's teacher-side infrastructure and shouldn't travel in every link. Clara gets direct-P2P sync only. If you want to give a visitor persistent offline tolerance, share the blind-peer-key separately and have them add `--blind-peer-key <key>` to the launch command.
- 🔁 **After you change code**, re-run `pear stage <pear-link>` before clara launches — Pear runtime downloads the **staged** version of the worker / renderer, not your local files.

## 🆘 Something not working?

Quick checks:

- Did you copy the **current** blind-peer-key into alice's and bob's commands?
- Did you copy alice's **current** `Invite:` line into bob's command?
- Tried restarting the blind peer, then re-pairing alice + bob with the new key? (No `--reset` needed.)

If you're still stuck, the full troubleshoot list and recovery recipe live in [`README-technical-background.md`](README-technical-background.md). 📚
