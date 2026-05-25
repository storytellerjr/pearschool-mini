# 🎓 Pearschool Mini

> **Yo Pear Babies, Storyteller in that house.** 🐻

## 🧒 What is this?

**Pearschool Mini** is a project by **Storyteller** for the **Pear Baby Room** and the **Pear School Room**  — an initiative to build a **peer-to-peer school** ✨ where instructors, trainers, and coaches can teach any topic directly to learners, **without a central server**.

We built it after studying [**Pearopen — examples-p2p-desktop**](https://github.com/pearopen/examples-p2p-desktop). All credit for the building blocks goes to them. 🙏 We took their examples, learned how a fully P2P app is composed, and assembled this app on top.

The name says it: **"mini"** 🤏 means we're first experimenting with Pear School at a small scale — testing the shape, the funnel, the feel — before going bigger.

The whole project is developed pair-style with **Claude AI inside the Void Editor**. 🤖

> 📚 Want the deep stack stuff (app architecture, blind-peering internals, schema migrations, the Tasks-tab walkthrough, building a distributable Pear app, full troubleshoot)? See [`README-technical-background.md`](README-technical-background.md).

---

## 🍐 Install on Mac (for recipients)

If someone sent you the app as a `.zip` file, follow these steps:

1. Unzip the file — you'll see **Pearschool Mini.app**.
2. Drag **Pearschool Mini.app** into your **Applications** folder.
3. Open **Terminal** (search for it in Spotlight) and run:
   ```sh
   xattr -dr com.apple.quarantine "/Applications/Pearschool Mini.app"
   ```
4. Double-click **Pearschool Mini** in Applications. It opens normally from now on.

> ⚠️ **Why step 3?** macOS blocks apps that aren't code-signed by an Apple Developer account ($99/yr). The app is fine — Apple just doesn't know us yet. The `xattr` command tells macOS to trust it. You only need to do this once.

> 💡 **Alternative (no Terminal):** Right-click the app in Finder → **Open** → click **Open** in the warning dialog. macOS remembers your choice after the first time.

---

## 🚀 How to use

### 1️⃣ Start the blind peer

The blind peer is a relay that helps users find each other. One person needs to run it in a terminal and share the key with all participants.

```shell
npx --yes blind-peer -s /tmp/pearschool-mini-blind1
```

Copy the `Listening at <listening-key>` line. 🔑

### 2️⃣ Launch the app

Open **Pearschool Mini**. You'll see the **Keys** tab with a setup form.

**User 1 (creates the account):**
- Enter your **name** (e.g. `alice`)
- Paste the **blind peer listening key** from step 1
- Leave **Account invite** empty
- Click **Connect**
- Your **account invite** appears — copy it and share it with the next user 📨

**User 2 (joins the account):**
- Enter your **name** (e.g. `bob`)
- Paste the same **blind peer listening key**
- Paste **User 1's account invite**
- Click **Connect**

Both users now share the same rooms (**Welcome Lobby**, **Community Chat**, **Personal Notes**). Chat, drop files, add tasks — everything syncs between users. 🎉

> 👀 **User 1 must be online** when User 2 connects for the first time — pairing is a live handshake. After the first pairing, both users can connect independently.

---

## ⚙️ For developers

### Install and build

```shell
npm i
npm run build:db   # generates ./spec/{schema,db,dispatch,hrpc}
npm run build      # tailwind + esbuild bundle for the renderer
```

### Run in dev mode

```shell
# Terminal 1: blind peer
npx --yes blind-peer -s /tmp/pearschool-mini-blind1

# Terminal 2: launch the app
npm start
```

### Test with two users on one machine

Use `--profile` to give each instance its own data directory:

```shell
# Terminal 2: alice
npm start -- -- --profile=alice

# Terminal 3: bob
npm start -- -- --profile=bob
```

### Build a distributable .app

```shell
npm run make
```

The `.app` bundle is at `out/Pearschool Mini-darwin-arm64/Pearschool Mini.app`.

To create a zip for sharing:

```shell
ditto -c -k --keepParent "out/Pearschool Mini-darwin-arm64/Pearschool Mini.app" "Pearschool Mini v0.0.5-app.zip"
```

> ⚠️ Use `-app.zip` (with a hyphen), not `.app.zip` (with a dot) — the dot causes errors.

---

## 🔗 Share a clip

Every clip in the **Free clips** tab has a **🔗** button. Click it to copy a `pear://` deep-link — anyone who opens the link lands directly on that clip.

> ⚠️ **Dev mode caveat**: while running via `npm start`, the link contains a placeholder. Run `pear stage` to get a real `pear://` applink (see below).

---

## 🚢 Stage and seed (for OTA updates)

Once staged, the app auto-updates over P2P — no reinstall needed.

### One-time setup

```shell
pear touch                    # generates a pear:// link (run once)
pear stage <pear-link>        # publishes your build to that link
pear seed <pear-link>         # announces on the swarm (leave running)
```

### After a code change

```shell
npm run build:db   # only if you edited schema.js
npm run build      # if you edited UI / input.css
pear stage <pear-link>   # republishes; running peers pick it up
```

You do **not** re-run `pear touch` (the link is permanent) or restart `pear seed` (it tracks the link, not a snapshot).

> 📚 More on what touch / stage / seed do under the hood is in [`README-technical-background.md`](README-technical-background.md).

---

## 🆘 Something not working?

Quick checks:

- Did you paste the **current** blind peer key? It changes each time you restart the relay.
- Did you paste User 1's **account invite** into User 2's setup form?
- Is User 1 online when User 2 connects for the first time?

If you're still stuck, the full troubleshoot list lives in [`README-technical-background.md`](README-technical-background.md). 📚
