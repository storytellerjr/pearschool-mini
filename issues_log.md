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

### 10. OTA updates not pulling on MacBook 2
- **Status:** Investigating
- **Symptoms:** Seed shows "2 peers" but "upload 0B". MacBook 2 quits and relaunches but stays on old version.
- **Possible causes:**
  - Seed reports `firewalled true` — both MacBooks may be behind NAT and can't connect directly for data transfer (DHT discovery works but data relay doesn't)
  - MacBook 2's v0.0.2 build may have had `updates` field issue before the `...pkg` fix
  - PearRuntime's updater may need additional configuration not covered in the scaffold
- **Workaround:** Manual reinstall via DMG/zip for each new version
- **Next steps:** Test on same WiFi network; check if `pear-runtime` needs explicit `updates: true`; investigate Hyperswarm relay/holepunching for firewalled peers

### 11. Two-MacBook chat sync not working
- **Status:** Investigating
- **Symptoms:** Both MacBooks run v0.0.4 with chat working locally. Blind peer key entered on both, invite pasted from MacBook 1 to MacBook 2, but no rooms or messages sync.
- **Possible causes:**
  - Same firewall/NAT issue as OTA — peers discover each other on DHT but can't transfer data
  - BlindPairing may need the blind peer relay configured differently (via `mirrors` in BlindPeering constructor rather than `swarm.joinPeer`)
  - The account-level invite may not be the right invite for `joinRoom()` — room-level invites might be needed
- **Workaround:** None yet
- **Next steps:** Test both MacBooks on same WiFi; investigate whether `swarm.joinPeer()` vs BlindPeering mirrors makes a difference; check chat-room.js pairing logic; add logging to `swarm.on('connection')` to confirm peers actually connect

### 12. App bundle size ~2.5GB
- **Status:** Known limitation
- **Cause:** Bare runtime native binaries are large: `bare-ffmpeg` (399MB), `bare-sidecar` (357MB), `react-native-bare-kit` (311MB), `rocksdb-native` (175MB)
- **Impact:** Slow AirDrop/transfer, large disk footprint
- **Possible mitigations:** Strip unused platform binaries from native deps; investigate if `bare-ffmpeg` and `react-native-bare-kit` can be excluded for non-camera/non-mobile builds
