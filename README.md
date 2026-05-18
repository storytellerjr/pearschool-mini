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

## 🆘 Something not working?

Quick checks:

- Did you copy the **current** blind-peer-key into alice's and bob's commands?
- Did you copy alice's **current** `Invite:` line into bob's command?
- Tried restarting the blind peer, then re-pairing alice + bob with the new key? (No `--reset` needed.)

If you're still stuck, the full troubleshoot list and recovery recipe live in [`README-technical-background.md`](README-technical-background.md). 📚
