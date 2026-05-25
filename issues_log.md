# Issues Log — Pearschool Mini (pear-runtime migration)

Tracking issues discovered during the pear-electron → pear-runtime migration and the two-MacBook distribution test on 2026-05-24.

---

## Resolved

### 1. forge.config.js fails to load
- **Error:** `module is not defined in ES module scope`
- **Cause:** `"type": "module"` in package.json makes `.js` files ESM, but `module.exports` is CJS
- **Fix:** Rename to `forge.config.cjs`

### 2. Black window — renderer can't resolve bare imports
- **Error:** `Failed to resolve module specifier "react"` (silent — just a black window)
- **Cause:** `pear-electron` resolved bare imports at runtime; plain Electron with `contextIsolation: true` cannot. The scaffold's `swc` step is transform-only, not a bundler.
- **Fix:** Replace `build:swc` with esbuild bundling: `esbuild ui/root.jsx --bundle --format=esm --outfile=build/root.js --loader:.jsx=jsx --jsx=automatic`

### 3. Preload script fails — window.pear undefined
- **Error:** `Cannot use import statement outside a module` → `Cannot read properties of undefined (reading 'on')`
- **Cause:** Electron's sandboxed preload runs as CJS, but `.js` in a `type: module` project is parsed as ESM
- **Fix:** Rename to `preload.cjs`, use `require()` instead of `import`

### 4. DMG won't open — "Input/output error"
- **Error:** `The disk image couldn't be opened. The operation couldn't be completed. Input/output error`
- **Cause:** Electron Forge's DMG maker (ULFO/LZFSE format) writes a bad `com.apple.FinderInfo` xattr (`deviddsk`) that confuses Finder's mount path. `hdiutil verify` passes fine.
- **Fix:** `xattr -c <dmg-file>` clears the bad attribute. Prevent recurrence by switching to `{ format: 'UDZO' }` in forge.config.cjs, or skip DMG and zip the `.app` with `ditto`.

### 5. DevTools opens in packaged app
- **Error:** Detached DevTools window appears on every launch of the bundled `.app`
- **Cause:** `openDevTools()` was called unconditionally (left over from debugging)
- **Fix:** Gate behind `if (!app.isPackaged)`

### 6. Worker crashes with `Uncaught %o {}` on app restart
- **Error:** Worker log shows `ERR Uncaught %o {}`, no Storage/Name/Invite lines
- **Cause:** Stale Corestore/Autobase data from a previous session conflicting with HRPC schema changes (added method id 16 for `set-blind-peer-key`)
- **Fix:** Clear storage: `rm -rf ~/Library/Application\ Support/Pearschool\ Mini/pear/app-storage`
- **Note:** This happens every time the HRPC schema changes. In production, schema migrations should be handled properly.

### 7. Blind peer key decoded as hex instead of z32
- **Error:** `swarm.joinPeer()` receives garbage bytes — peer connection silently fails
- **Cause:** `npx blind-peer` outputs z32-encoded keys, but the handler used `b4a.from(key, 'hex')`
- **Fix:** Use `idEnc.decode(key)` which auto-detects z32/hex/buffer encoding

### 8. Preload can't require('../package.json')
- **Error:** `Error: module not found: ../package.json` → preload crashes → window.pear undefined
- **Cause:** Electron's sandboxed preload restricts relative `require()` paths
- **Fix:** Get version via sync IPC: preload calls `ipcRenderer.sendSync('get-version')`, main.js responds with `pkg.version`

### 9. `updates` field not passed to PearRuntime
- **Error:** OTA updates never fire — seed shows peers connecting but 0B uploaded
- **Cause:** PearRuntime constructor was only passed `version`, `upgrade`, `name` — missing `updates`. Without it, the updater doesn't check for new versions.
- **Fix:** Spread `...pkg` into PearRuntime options: `new PearRuntime({ ...pkg, dir: ..., name: pkg.productName })`
- **Note:** This is a one-time manual-reinstall fix — already-installed builds without this change can't pull OTA updates.

---

## Open

### 10. Worker auto-initialized without config (CLI flags gone after migration)
- **Status:** Resolved 2026-05-25
- **Symptoms:** App launched but blind peering never worked, invite couldn't be passed, name was auto-generated as `User <timestamp>`
- **Cause:** Old `pear run` passed `--name`, `--blind-peer-key`, `--invite` as CLI flags. After migrating to pear-runtime (Electron), `pear.run('workers/main.js', [pear.storage])` only passes the storage path. Worker auto-initialized with empty flags `{}`.
- **Fix:** Added `configure` HRPC method (schema + spec regeneration). Worker defers initialization until UI sends configure RPC with name, blindPeerKey, and optional invite. Keys tab now shows a setup form before connecting. Other tabs disabled until configured.
- **Related:** Also fixed `setBlindPeerKey` handler which incorrectly used `swarm.joinPeer()` instead of configuring `BlindPeering({ mirrors })` at construction time.

### 11. Deprecated console-message args in Electron 33+
- **Status:** Resolved 2026-05-25
- **Symptoms:** `(electron) 'console-message' arguments are deprecated` warning on every launch
- **Fix:** Changed from positional args `(_e, level, message, line, sourceId)` to Event object `(e)` with `e.level`, `e.message`, `e.sourceId`, `e.line`

### 12. OTA updates not pulling on MacBook 2
- **Status:** Investigating
- **Symptoms:** Seed shows "2 peers" but "upload 0B". MacBook 2 quits and relaunches but stays on old version.
- **Possible causes:**
  - Seed reports `firewalled true` — both MacBooks may be behind NAT and can't connect directly for data transfer (DHT discovery works but data relay doesn't)
  - MacBook 2's v0.0.2 build may have had `updates` field issue before the `...pkg` fix
  - PearRuntime's updater may need additional configuration not covered in the scaffold
- **Workaround:** Manual reinstall via DMG/zip for each new version
- **Next steps:** Test on same WiFi network; check if `pear-runtime` needs explicit `updates: true`; investigate Hyperswarm relay/holepunching for firewalled peers

### 13. Packaged app hangs on "Connecting..." on MacBook 2
- **Status:** Open — likely network issue, not app bug
- **Date:** 2026-05-25
- **Symptoms:** Bundled `.app` (v0.0.5) on MacBook 2 shows Keys tab setup form, user enters name + blind peer key (with or without invite), clicks Connect — UI stays on "Connecting..." forever. Same app works instantly with two `--profile` instances on MacBook 1.
- **What we found:**
  - No `worker.log` written (bare-fs `writeFileSync` fails silently in packaged app — separate minor issue)
  - RocksDB corestore LOG shows 479 writes / 2497 keys in first 600s, then zero writes — worker is alive but stalled mid-init
  - Worker hangs at `BlindPeering.addAutobase()` or `ChatAccount.ready()` — both need Hyperswarm connectivity to the blind peer relay
  - `ping` from MacBook 2 → MacBook 1 shows "No route to host" for first 4 packets, then connects with 5-90ms jitter — WiFi is unreliable
  - MacBook 2 also has npm issues running `npx blind-peer` (space handling in terminal) — untested whether a local blind peer would fix it
- **Root cause:** Flaky WiFi between the two MacBooks. Hyperswarm DHT uses UDP, which is less forgiving than TCP on unreliable connections. Packets dropped during DHT bootstrap cause peer discovery and blind peering handshake to stall indefinitely.
- **Why it works on MacBook 1:** Both `--profile` instances use localhost — no WiFi involved. The blind peer is local, DHT discovery is instant.
- **Suggestions to fix/verify:**
  1. **Test on a stable network** — phone hotspot, ethernet, or sit closer to the router. If it connects, the app is confirmed working and this is purely a WiFi issue.
  2. **Run a blind peer locally on MacBook 2** — `npx --yes blind-peer -s /tmp/pearschool-mini-blind-local` (make sure there's a space before `-s`). Connect with the local key. If this works, cross-machine blind peering needs a more reliable network.
  3. **Add a connection timeout + retry** — the app currently hangs forever if init stalls. Add a timeout to `BlindPeering.addAutobase()` and the pairing promise, with a "Retry" button in the UI.
  4. **Add init progress feedback** — show which step is hanging (corestore ready → account ready → blind peering → rooms). Currently the UI just says "Connecting..." with no visibility into where it's stuck.
  5. **Investigate Hyperswarm relay** — for networks where direct UDP doesn't work, Hyperswarm supports relay connections via `@hyperswarm/relay`. This might be needed for real-world deployment on restrictive WiFi networks.
  6. **Fix worker.log in packaged app** — bare-fs `writeFileSync` silently fails in the packaged app. The log path should be valid (`pear/app-storage/worker.log`) since the corestore writes to the same parent directory. Investigate bare-fs path handling in packaged Electron context.

### 14. App bundle size ~5GB
- **Status:** Known limitation
- **Cause:** Bare runtime native binaries are large: `bare-ffmpeg` (399MB), `bare-sidecar` (357MB), `react-native-bare-kit` (311MB), `rocksdb-native` (175MB)
- **Impact:** Slow AirDrop/transfer, large disk footprint, Keet transfer corrupts the file
- **Possible mitigations:** Strip unused platform binaries from native deps; investigate if `bare-ffmpeg` and `react-native-bare-kit` can be excluded for non-camera/non-mobile builds
