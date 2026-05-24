# Git Tips — Pearschool Mini

Rollback and recovery recipes for the Pear runtime migration.

## The safety net

Before starting the migration, we created:

- **Tag `pre-pear-migration`** at commit `155cfb5` (the last known-working state on `main`)
- **Branch `pear-runtime-migration`** where all migration work happens
- `main` stays untouched until the migration is verified

Both the tag and `main` are pushed to `origin` (https://github.com/storytellerjr/pearschool-mini), so even a wiped local checkout can be restored.

## How to get back to the working version

### Option A — Throw away the migration branch entirely

Use this when the migration is a dead end and you want to start over from a clean `main`.

```bash
git checkout main
git branch -D pear-runtime-migration
```

### Option B — Reset the migration branch to the working state

Use this when you want to keep the branch name but discard all migration commits and uncommitted changes.

```bash
git reset --hard pre-pear-migration
```

### Option C — Rescue `main` if you accidentally committed to it

Use this if migration commits ended up on `main` by mistake.

```bash
git checkout main
git reset --hard pre-pear-migration
```

> Warning: if you already pushed the bad commits to `origin/main`, you'll need `git push --force-with-lease origin main` to overwrite the remote. Only do this if you're sure no one else has pulled.

### Option D — Restore from the remote tag (nuclear option)

Use this if local git history is corrupted or you're on a fresh machine.

```bash
git fetch origin --tags
git checkout -B main pre-pear-migration
```

## When the migration works — promoting it to `main`

```bash
# Push the migration branch
git push -u origin pear-runtime-migration

# Open a PR on GitHub and merge there (recommended), OR fast-forward locally:
git checkout main
git merge --ff-only pear-runtime-migration
git push origin main
```

## Useful inspection commands

```bash
git log --oneline -10                      # Recent commits on current branch
git branch -a                              # All local + remote branches
git tag -l                                 # All tags
git diff pre-pear-migration..HEAD          # What changed since the snapshot
git status                                 # Working tree state
```

## Auth notes

This repo's `origin` uses HTTPS and authenticates via the `gh` CLI token for the **storytellerjr** account.

- Check which account is active: `gh auth status`
- Switch accounts: `gh auth switch --hostname github.com --user storytellerjr`
- Re-link git to the gh token if pushes start failing: `gh auth setup-git --hostname github.com`
