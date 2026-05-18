# Sales funnel

How a stranger on the internet becomes a paying student of the school — and what we need to build, stage by stage, to make that journey work end-to-end inside Pearschool.

The funnel has four stages. A visitor moves from one stage to the next only when they take a small, voluntary step that signals more interest than the step before. Each stage costs the visitor a little more attention; each stage gives us a little more permission to talk to them.

```
Stage 1 — Free content      → anyone can see it, no sign-up needed
Stage 2 — Hand raise        → a like, a follow, a "save for later"
Stage 3 — Webinar / room    → join with an identity, sit through a session
Stage 4 — Paid course       → Lightning payment unlocks the course
```

The Courses tab we already built is **Stage 4** — the destination. Everything above it still needs to be created.

---

## Stage 1 — Free content (top of funnel)

**Goal**: get a stranger to spend two minutes with us. Nothing more. No account, no email, no commitment. They just see a piece of content and form a first impression.

**What the visitor sees**: a video. Either a short pre-recorded clip (a photo or video shared from the teacher's drive) or a live camera stream (the teacher is broadcasting right now). The visitor stumbled across it because someone shared a link, posted a clip on social media, or because they were already inside another peer's app.

**Why this stage matters**: it's the only moment where a complete outsider gets to judge whether our content is worth their time. If they bounce here, the rest of the funnel is irrelevant.

**Features we still need**:

- **Basic photo/video backup tab** — a place where a teacher can drop a short video file (a trailer, a lesson preview, a free clip) and it becomes visible to anyone who has the link. Think of it as the teacher's public showcase shelf.
- **Basic live cam tab** — a place where the teacher can flip a switch and start broadcasting from their webcam. Anyone with the link sees the live stream while it's running; when the teacher stops, the stream goes dark. Optionally the stream gets saved to the backup shelf.
- **A way to share the content outwards** — a copyable link or a small embed snippet the teacher can paste on Twitter, in a blog, in an email. Without this, the content has no entry point.

---

## Stage 2 — Hand raise (the visitor signals interest)

**Goal**: turn an anonymous viewer into a recognisable visitor. They've seen the free content; if it resonated, they should be able to do something small to say "I want more of this." That small action is what lets us follow up.

**What the visitor does**: clicks a heart icon, follows the teacher, or saves the clip to a personal list. None of these require payment. All of them require the visitor to **own an identity** of some sort — even a lightweight, anonymous one — so we can remember that they liked something.

**Why this stage matters**: this is where the funnel turns from one-way (we broadcast) into two-way (we know who's watching). Without a hand-raise step, every stranger is the same stranger forever, and we can never invite them to the next stage.

**Features we still need**:

- **Basic identity** — a way for a visitor to create a personal handle inside the app. Just a display name and an avatar to start with; the underlying account is generated for them. They don't fill in an email. They don't pick a password. They just appear.
- **Like / follow on free content** — a heart button on every free video and live stream, and a follow button on the teacher's profile. The numbers ("23 people liked this", "184 followers") are visible so social proof builds itself.
- **A "your saved videos" list** — the visitor's own private shelf of clips they hearted. Gives them a reason to come back even when they're not invited.
- **Notification when the teacher posts new free content** — so a follower who liked one video gets pinged when the teacher uploads another. This is what keeps the relationship warm between Stage 2 and Stage 3.

---

## Stage 3 — Webinar (the tasting)

**Goal**: get the warm visitor into a room where they spend 30–60 minutes with the teacher in something that feels like a live class. This is the moment the visitor stops being a passive viewer and starts behaving like a student.

**What the visitor does**: sees that the teacher is hosting a webinar on a specific date (e.g. "Intro to Drone Photography — Saturday 8pm"). They click **Subscribe**. On the day, they get a reminder, click into the webinar room, and watch a longer video or a live talk together with everyone else who subscribed. They can ask questions, type in chat, see who else is there.

**Why this stage matters**: a webinar is the highest-value free thing we offer. It's where the visitor moves from "I like this teacher" to "I want to learn from this teacher specifically." It's also where we get to make the offer for the paid course — at the end of the webinar, while the room is still warm.

**Features we still need**:

- **Webinar rooms** — a special kind of room (different from the existing chat rooms) that has a scheduled start time, a single host (the teacher), a video at the centre, and an audience that can chat but can't talk over the host. Think "auditorium" rather than "group chat".
- **Subscribe-to-webinar / waitlist** — anyone with a basic identity can hit Subscribe on an upcoming webinar. They join a waitlist that the teacher can see. On the day, only people on the waitlist receive the join link.
- **Reminders before the start time** — a notification 24h before, 1h before, and "we're live now." Without these, half the waitlist will simply forget.
- **A pitch slot at the end of the webinar** — the last 5 minutes of the room layout should highlight a call-to-action: "Buy the full course." The button is right there. The visitor doesn't have to hunt for it.
- **Replay** — if someone subscribed but missed the live session, they should be able to watch the recording afterward. The replay is what keeps the funnel from leaking when life gets in the way.

---

## Stage 4 — Sales page, order page, payment (becoming a paying student)

**Goal**: turn an attendee into a customer. They've watched the free content, they've followed the teacher, they've sat through the webinar, and now they're ready to buy. Don't make them think — make it three clicks.

**What the visitor does**: clicks the "Buy the course" button at the end of the webinar (or anywhere else we surface it). Lands on a **sales page** that explains exactly what they get: number of lessons, what they'll learn, testimonials, price, FAQ. They scroll to the bottom and click **Order**. The **order page** shows the course, the total, and a Lightning payment widget. They scan a QR code with their wallet, pay, and the course unlocks instantly.

**Why this stage matters**: this is the only stage that produces revenue. Every other stage exists to feed this one. If the sales page is confusing or the payment flow has friction, the entire upstream funnel was wasted effort.

**Features we still need**:

- **A sales page per course** — a long-form page bolted onto each course in the Courses tab. The teacher fills in the headline, the bullet points, the testimonials, the FAQ. The page is publicly visible; anyone with the link can read it without having to log in.
- **An order page** — the short page that comes between "I want to buy" and "I paid." Shows the course, the price, the buyer's identity, and the Lightning invoice. Nothing else — no upsells, no distractions.
- **Lightning payment** — a payment widget that generates a Lightning invoice for the course price. The visitor scans the QR code (or pastes the invoice into their wallet), the payment confirms in seconds, and the course unlocks on their identity automatically.
- **Course unlocking tied to identity** — once payment lands, the buyer's identity gets permanent access to the course content. They can close the app, come back tomorrow, log in with the same identity, and the course is still theirs.
- **Receipts** — a simple confirmation page after payment, plus a permanent record on the buyer's identity. No tax invoices yet; this is just "you paid, here's proof."

---

## Summary — features still to build, in funnel order

| Stage | Feature | Why we need it |
|-------|---------|---------------|
| 1 | Basic photo/video backup tab | Somewhere to host free clips |
| 1 | Basic live cam tab | Somewhere to broadcast live |
| 1 | Shareable link / embed | The funnel needs an entry point |
| 2 | Basic identity | We can't remember anonymous strangers |
| 2 | Like / follow buttons | The hand-raise gesture itself |
| 2 | "Saved" / "following" lists | Reason to come back |
| 2 | Notifications on new free content | Keeps the relationship warm |
| 3 | Webinar rooms | Auditorium-style session, not chat |
| 3 | Subscribe / waitlist | Permission to invite |
| 3 | Reminders | Otherwise the waitlist forgets |
| 3 | End-of-webinar pitch slot | The hand-off into Stage 4 |
| 3 | Replay | Catches the leak from missed sessions |
| 4 | Sales page per course | Tells the buyer what they're buying |
| 4 | Order page | The friction-free checkout step |
| 4 | Lightning payment | Actually collects the money |
| 4 | Course unlocking on payment | Delivers what was paid for |
| 4 | Receipts | Trust signal after the sale |

---

## What we already have

- **Courses tab** — title, instructor, room, start date, description, status (draft / open / closed), and a per-course delete. This is the Stage-4 destination. A paying student lands here.
- **Chat rooms** — useful for community discussion between students after they've bought a course, and possibly the chat-during-webinar component in Stage 3.
- **Files / drives** — the foundation we'll build the Stage-1 photo/video backup on top of.
- **Tasks** — useful for student homework once they're inside a paid course.

The school already has the **inside of the building**. The funnel doc above is about building the **path from the street to the front door**, and the **cash register by the door**.
