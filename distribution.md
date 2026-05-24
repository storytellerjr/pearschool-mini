# Distribution — Pearschool Mini

How to ship this app to other machines, and how OTA updates flow over Pear's P2P network. Distilled from [hello-pear-electron](https://github.com/holepunchto/hello-pear-electron) plus the scaffold gotchas we hit during the `pear-electron` → `pear-runtime` migration.

---

## Two layers, stacked

| Layer | What it does | When you use it |
|---|---|---|
| **1. OS installers** (Electron Forge `npm run make`) | Produces `.app` / `.msix` / `.deb` files | First install on every new machine |
| **2. Pear P2P + OTA** (`pear touch` → `pear stage` → `pear seed`) | After Layer 1 is installed, app pulls future builds over P2P automatically — no reinstall needed | Every update after the first install |

Layer 2 sits on top of Layer 1: you can't OTA-update an app that was never installed. But once Layer 1 is on a machine, Layer 2 takes over for all subsequent versions — as long as the `upgrade` field in `package.json` was set before that first build.

---

## What pearschool-mini already has vs needs

| | Status |
|---|---|
| `upgrade` field with real `pear://` link | ✅ `pear://j4eamjuw74fr4iqg16o65kb58m9ddafqjzszciiert5gmgz8n6ay` |
| `forge.config.cjs` + `make` script | ✅ |
| `productName: "Pearschool Mini"` | ✅ |
| `package.json` `description`, `author`, `license` | ❌ Forge needs these populated before `make` |
| `build/icon.icns` / `.ico` / `.png` | ❌ default icon currently |
| Multi-arch builds (Windows / Linux / Intel Mac) | ❌ each requires building on that OS |
| Always-on seed machine running `pear seed <link>` | ❌ (your Curaçao MacBook can do this) |
| Code signing | ❌ |

---

## Code-signing reality check

Without signing:
- **macOS** quarantines the app on first launch → recipients have to right-click → Open. Fine for you + a few testers; not acceptable for non-technical users.
- **Windows** SmartScreen warns "unknown publisher" → recipients have to click "More info → Run anyway".

For production:
- **macOS**: $99/yr Apple Developer account + env vars `MAC_CODESIGN_IDENTITY` / `APPLE_TEAM_ID` / `APPLE_ID` / `APPLE_PASSWORD` during `npm run make`.
- **Windows**: EV code signing cert (~$200–400/yr) + env vars `WINDOWS_CERTIFICATE_FILE` / `WINDOWS_CERTIFICATE_PASSWORD`.

For OTA updates on Windows specifically, the same certificate must be used across builds — Windows rejects updates where the `Publisher` doesn't match the installed package.

---

## End-user install script (copy-paste for non-technical recipients)

Send the user the DMG (`out/make/Pearschool Mini-0.0.1-arm64.dmg`) plus the message below. The friction here exists entirely because the app isn't code-signed yet — once you set up Apple notarization, everything below collapses into "drag to Applications, double-click."

> **Installing Pearschool Mini on your Mac**
>
> 1. Double-click the `.dmg` file I sent you. A window opens with the Pearschool Mini icon and an "Applications" folder.
> 2. Drag the **Pearschool Mini** icon into the **Applications** folder.
> 3. Close the window. You can throw the `.dmg` in the Trash now.
> 4. Open Applications, double-click **Pearschool Mini**.
> 5. You'll see a warning that says the app is "damaged" or "from an unidentified developer." This is normal — the app is fine, Apple just charges $99/year to remove the warning and we haven't paid that yet.
> 6. Click **Done** or **Move to Trash** to dismiss the warning (don't actually trash it).
> 7. Open **System Settings → Privacy & Security**.
> 8. Scroll down to the **Security** section. You'll see a line saying *"Pearschool Mini was blocked from use because it is not from an identified developer."*
> 9. Click **Open Anyway** next to that message. Enter your Mac password if asked.
> 10. Confirm by clicking **Open** in the dialog. The app starts.
>
> After this one-time confirmation, you can launch Pearschool Mini normally from Applications, Launchpad, or Spotlight forever.

### Faster path for users comfortable with Terminal

```sh
xattr -dr com.apple.quarantine "/Applications/Pearschool Mini.app"
```

Removes the quarantine flag and the app launches without any warning, ever. Requires the user to have already moved the app to `/Applications`.

### Why this warning appears (for your own reference)

macOS applies the `com.apple.quarantine` extended attribute to any file that arrives from the internet, AirDrop, Dropbox, etc. On launch, Gatekeeper checks if the binary is signed and notarized by an Apple Developer account. Without that, Gatekeeper refuses — sometimes with the misleading "damaged" wording on Sonoma 14.6+ and Sequoia 15. The app itself is intact; only the trust check fails.

The `.app` bundle is a folder that macOS displays as a single icon (~250MB unzipped). Once installed, it's fully self-contained — Chromium, Node, your renderer bundle, and the Bare worker all live inside the bundle. The OTA mechanism updates that bundle in place when `pear stage` publishes a new version.

---

## Three-phase test plan (two MacBooks, no signing yet)

### Phase 1 — Run the installer on this MacBook

Goal: prove the bundled `.app` works the same as `npm start`.

```sh
# 0. Fill in the fields Forge requires for make
npm pkg set description="Pear-runtime port of pearschool-mini"
npm pkg set author="storytellerjr"
npm pkg set license="MIT"

# 1. Build the installer
npm run make

# 2. Open the bundled app (not via npm start)
open "out/Pearschool Mini-darwin-arm64/Pearschool Mini.app"
```

**Verify:**
- [ ] Window opens, tabs render (Chat / Files / Tasks / Courses / Free clips)
- [ ] Worker log shows up at `~/Library/Application Support/Pearschool Mini/pear/app-storage/worker.log`
- [ ] No crashes — DevTools console is clean (open with Cmd+Opt+I)

If this works, the `.app` bundle is portable. Keep the path handy — you'll copy this exact bundle to the second MacBook.

### Phase 2 — Run the same `.app` on the second MacBook

Goal: prove the installer works on a machine that has never seen the source code.

```sh
# On MacBook 1 — compress so it transfers cleanly (preserves code signature metadata)
ditto -c -k --keepParent "out/Pearschool Mini-darwin-arm64/Pearschool Mini.app" "Pearschool Mini.app.zip"
```

Transfer `Pearschool Mini.app.zip` to MacBook 2 via AirDrop, USB, Dropbox, etc.

```sh
# On MacBook 2
unzip "Pearschool Mini.app.zip"
xattr -dr com.apple.quarantine "Pearschool Mini.app"   # clears quarantine if Gatekeeper blocks it
open "Pearschool Mini.app"
```

If the `xattr` step fails or you'd rather not run it: right-click the `.app` in Finder → Open → "Open" in the warning dialog. macOS remembers this choice for that exact bundle.

**Verify:**
- [ ] App launches on MacBook 2
- [ ] Worker log at `~/Library/Application Support/Pearschool Mini/` shows a *different* invite key than MacBook 1 (each install gets its own identity)
- [ ] (Optional) Pair the two instances — paste MacBook 1's invite into MacBook 2 (or vice versa) and confirm a message/file replicates

### Phase 3 — Test OTA update from MacBook 1 → MacBook 2

Goal: change one line on MacBook 1, watch MacBook 2's already-installed app update automatically without reinstalling.

**Important preconditions:**
- MacBook 2 must already be running the Phase 2 `.app` (or have it launched at least once so OTA storage exists).
- The `upgrade` field in `package.json` was set *before* Phase 1's `make`, so it's baked into the installed bundle on MacBook 2. ✅ already done.
- A seed machine must be reachable when MacBook 2 checks for updates. For testing, MacBook 1 itself plays the seed role.

```sh
# On MacBook 1

# 1. Make a visible change — e.g. update the product name
npm pkg set productName="Pearschool Mini v2"

# 2. Bump the version (OTA will NOT fire without a version bump)
npm version patch        # 0.0.1 → 0.0.2

# 3. Rebuild the installer
npm run make

# 4. Assemble a deployment directory (multi-arch normally — just arm64 mac for this test)
npx pear build --package=package.json \
  --darwin-arm64-app "out/Pearschool Mini-darwin-arm64/Pearschool Mini.app" \
  --target out/build

# 5. Dry-run stage first to inspect file diffs
npx pear stage --dry-run pear://j4eamjuw74fr4iqg16o65kb58m9ddafqjzszciiert5gmgz8n6ay ./out/build

# 6. Stage for real
npx pear stage pear://j4eamjuw74fr4iqg16o65kb58m9ddafqjzszciiert5gmgz8n6ay ./out/build

# 7. Seed the link so MacBook 2 can find it on the DHT
npx pear seed pear://j4eamjuw74fr4iqg16o65kb58m9ddafqjzszciiert5gmgz8n6ay
#   → leave this running in a terminal
```

**On MacBook 2:**
- Make sure the Phase 2 app is running (or launch it).
- It connects to the Pear DHT, finds MacBook 1's seed, pulls the update.
- The `pear.updater` `updating` / `updated` events fire — in our code, `electron/main.js` calls `pear.updater.applyUpdate()` on `updated`.
- **Quit and relaunch the app on MacBook 2** to pick up the new build (Electron apps don't hot-swap themselves mid-process — the swap happens on next launch).
- Window title / product name should now say "Pearschool Mini v2".

**Verify:**
- [ ] MacBook 2's `~/Library/Application Support/Pearschool Mini/pear/` folder has updated timestamps after the stage
- [ ] After relaunch, the app reflects the new version
- [ ] Worker on MacBook 2 logged a version change (check `worker.log` for `--- worker boot` markers near the stage time)

---

## DMG won't open — "The disk image couldn't be opened. Input/output error"

We hit this on the first `npm run make` output. The DMG checksums are valid (`hdiutil verify` passes) and mounts fine via `hdiutil attach` in Terminal, but Finder refuses to open it with an I/O error.

**Root cause:** Electron Forge's DMG maker (using the `ULFO`/LZFSE format) sometimes writes extended attributes that confuse Finder's mount path — specifically a bad `com.apple.FinderInfo` attribute (`deviddsk` instead of the expected disk image type code).

### Fix 1 — Clear extended attributes (fast)

```sh
xattr -c "out/make/Pearschool Mini-0.0.1-arm64.dmg"
open "out/make/Pearschool Mini-0.0.1-arm64.dmg"
```

The `-c` flag clears all extended attributes. Finder re-adds benign ones on access. This fixed our case.

### Fix 2 — Switch to UDZO format (prevents recurrence)

In `forge.config.cjs`, change the DMG format from `ULFO` (LZFSE) to `UDZO` (zlib). `UDZO` is older but Finder handles it more reliably:

```js
{ name: '@electron-forge/maker-dmg', config: { format: 'UDZO' } }
```

Then `rm -rf out/ && npm run make` to regenerate.

### Fix 3 — Skip DMG entirely, zip the `.app`

If DMG continues to cause issues, bypass it and distribute the `.app` directly:

```sh
ditto -c -k --keepParent "out/Pearschool Mini-darwin-arm64/Pearschool Mini.app" "Pearschool Mini.app.zip"
```

Recipients unzip and drag to Applications. Functionally identical — you just lose the polished drag-to-Applications window that a DMG provides.

### Diagnosing future DMG issues

```sh
# Verify the DMG's checksum is intact
hdiutil verify "out/make/Pearschool Mini-0.0.1-arm64.dmg"

# Try mounting via Terminal (bypasses Finder's xattr checks)
hdiutil attach "out/make/Pearschool Mini-0.0.1-arm64.dmg"

# Inspect extended attributes on the file
xattr -l "out/make/Pearschool Mini-0.0.1-arm64.dmg"
```

If `hdiutil verify` passes but Finder won't mount: it's always an xattr issue — `xattr -c` fixes it. If `hdiutil verify` fails: the DMG is genuinely corrupted and you need to re-run `npm run make`.

---

## When OTA *won't* fire — common gotchas

- **Version not bumped.** `npm version patch` is mandatory; the updater compares versions and skips if they're identical.
- **Wrong `upgrade` link in the installed bundle.** If MacBook 2 was installed before `pear touch` was run, it has no idea which key to listen to. Reinstall after fixing `upgrade`.
- **Seed not reachable.** `pear seed` must be running on at least one machine MacBook 2 can DHT-connect to. NAT / strict firewalls can block this — try the same Wi-Fi network first.
- **Stage operation failed silently.** Always do `pear stage --dry-run` first; check the diff is what you expect before the real run.
- **`updates: false` in `package.json`.** We have this set to `false` to prevent dev-build swaps. It must be removed (or set to `true`) for the bundled install to actually accept OTA updates. Update this before Phase 1's `make` if you want Phase 3 to work.

---

## Beyond the two-MacBook test

Once the loop works, the next maturity steps are:

1. **Always-on seed machine** — your Curaçao MacBook running `pear seed <link>` permanently, so users can pull updates even when your laptop is closed.
2. **Multi-arch builds** — `pear build` accepts `--darwin-x64-app`, `--linux-x64-app`, `--win32-x64-app` etc. Each one requires building on that OS (or in CI). Without these, only matching-arch users get installers; only matching-arch users get OTA updates.
3. **Code signing** — required to make installs frictionless on macOS / Windows. See [Code-signing reality check](#code-signing-reality-check) above.
4. **Provisioned + multisig links** — separate Pear keys for `dev` / `staging` / `rc` / `production` release lines, with multisig'd production releases preventing single-key compromise. Overkill for a few users; essential for a public app. See the [hello-pear-electron README](https://github.com/holepunchto/hello-pear-electron#peer-to-peer-deployments) for the full pipeline.
