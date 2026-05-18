# Notes

Design notes and roadmap for `pearschool-mini`.

## Pear School use case — does the current app match it?

**Use case.** The teacher launches the app first (becomes the host). The teacher distributes one invite string to the whole class. Every student launches with that invite and ends up able to chat in all three predefined rooms (Welcome Lobby, Community Chat, Personal Notes).

**Status: yes, this works today.** The flow is:

1. Teacher launches first with no `--invite`. `ChatAccount` bootstraps the three rooms on the teacher's account base. The teacher's terminal prints **one** account invite.
2. Teacher distributes that account invite to the whole class.
3. Each student launches with `--invite <teacher-account-invite>`. Their account pairs with the teacher's account base, the teacher's `rooms` collection replicates onto the student's machine, and the student's `ChatAccount.openRooms()` auto-pairs into all three room bases using the per-room invites embedded in the rooms collection.
4. Every student is a **writer** on the account base AND on all three room bases — they can read and send in all three rooms.

## Caveats with the current implementation

### 1. The account invite is reusable, not per-student

`getInvite()` in `worker/chat-account.js` returns the existing invite from the `invites` collection if one is already there, rather than rotating. So one invite string admits the entire class. That's convenient for the teacher, but it means anyone who sees the string can join — no per-student token, no use-count, no expiry check. Leaking the invite to a public Slack channel = anyone joining the class.

### 2. Pairing needs *some* live writer per new joiner — not necessarily the teacher

Every paired peer (teacher and every student) runs `pairing.addMember(...)` for both the account base and each room base. So once one or two students have joined, **any** online paired peer can confirm the next student's pairing handshake. The teacher only has to be online for the very first student.

The blind peer mirrors encrypted blocks but **cannot** complete a pairing handshake. If the teacher and every student are offline at the same time, the next joiner stalls until someone with writer status comes back online.

### 3. "Personal Notes" is class-wide, despite its name

The current model has no per-room ACLs. Pairing into the account auto-pairs the new peer into **every** room as a writer (because each room's invite is embedded in the rooms collection that just replicated). So Personal Notes is shared with the whole class, not personal to any single student.

To make a room actually private (or actually a teacher↔student DM), the schema and the bootstrap need to change — see the roadmap below.

## Roadmap

The plan is to layer features on top of the current multi-room baseline in this order:

### Phase 1 — multi-room *(done)*

What's in this commit. Three predefined rooms (Welcome Lobby, Community Chat, Personal Notes) with distinct background colours, account-invite-based onboarding, account-level drives in the Files tab, blind-peering wired for the account base + every room base.

### Phase 2 — identity *(next)*

Wire in the `keet-identity-key` library (the `/identity` skill in this repo's skill family). Each peer carries a long-lived identity keypair separate from their per-room writer keys. Every message gains a `proof` field signed by the sender's identity key, and `ChatRoom._setupRouter`'s `add-message` handler verifies the proof before accepting the block.

Why this comes before personal rooms:

- A "personal" room is meaningless without a stable notion of *who* a peer is across rooms — writer keys are per-room and rotate when you reset, so they cannot be used as a long-term identifier.
- Once identity is in place, an ACL can be expressed as "the sender's identity key matches one of these allow-listed keys" — which is the foundation the personal/DM room model needs.
- Identity also lets the UI render "messages from teacher" vs "messages from student X" reliably, instead of trusting an unsigned `info.name` field that any peer could spoof.

### Phase 3 — personal / DM rooms *(after identity)*

With identity in place, change the room model from "everyone in the account is admitted to every room" to "the room records its allowed identity keys and the dispatch router rejects messages from anyone else."

Concrete sketch (subject to revision once identity lands):

- **Schema** — add an `allowedIdentities: array of buffer` field to the `room` record, plus an optional `kind: 'shared' | 'personal' | 'dm'` discriminator for clarity.
- **Bootstrap** — Welcome Lobby and Community Chat stay `shared`. Personal Notes becomes `personal` and the bootstrap creates **one Personal Notes room per joining student**, each with `allowedIdentities = [teacher-identity-key, that-student-identity-key]`. The teacher creates the room when the student first joins (likely in a new account-level handler that fires on `add-writer`).
- **Dispatch** — `ChatRoom._setupRouter`'s `add-message` callback checks `proof` against `allowedIdentities` and throws if the sender isn't in the list. Hyperdb rejects the block; the message never lands in the view.
- **UI** — sidebar groups rooms by kind: a "Channels" section for shared rooms, a "DMs" section for one-on-one rooms with the other party's name from their identity profile.

Open question for Phase 3: whether to also restrict *replication* (so a student literally never receives the bytes of another student's Personal Notes) or only enforce at the dispatch layer (encrypted blocks reach everyone but only the addressee can decrypt + verify). Replication-level restriction is stronger but needs per-room encryption keys and a much heavier schema; dispatch-level is what the current architecture supports and is good enough for "honest peers" but not for "untrusted students."

## Out of scope (for now)

These are interesting but explicitly **not** on the near roadmap:

- **Invite rotation / one-time-use invites.** Would close the "shared invite leak" caveat. Needs a TTL field on the invite record + a router callback that deletes used invites + a UI for the teacher to mint a fresh one per student.
- **Removing students.** No `remove-writer` op exists yet. `Autobase.removeWriter` exists but partial revocation is hard — see the upstream `basic-chat-multi-rooms/notes.md` for the full rekey discussion.
- **Per-room file shares.** Drives are account-wide today (one drive per peer, visible across all rooms in the Files tab). Per-room drives would need the file-sharing layer rewired to live on each room base, which is a non-trivial restructure.
- **Presence (who's online in this room right now).** Not in the schema. Would need a swarm-event-driven side-channel rather than autobase.
- **Message edit / delete.** Autobase is append-only; "delete" would mean appending a tombstone op and filtering at read time.
