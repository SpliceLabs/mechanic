---
name: use-mechanic
description: How to operate the `mechanic` CLI to discover, install, enable, share, and troubleshoot Claude Code skills. Use whenever the user wants to add a skill from GitHub/GitLab/a local path/a `.skill` archive, toggle a skill on or off, pin skills for teammates via `mechanic.lock`, reproduce a teammate's project skill setup with `mechanic install`, scan a tree for `SKILL.md` files, run `mechanic doctor`, or anything else involving the `mechanic` command — including discovery-shaped questions like "is there a skill for X", "find me a skill that does Y", "how do I get Claude better at Z" — even if they describe the goal without naming `mechanic` (e.g. "wire this skill into my repo", "make this skill available everywhere", "restore the project's skills after cloning").
---

# Use mechanic

`mechanic` is a skill registry + scope manager for Claude Code. It keeps one canonical copy of every skill in a store at `~/.mechanic/skills/<id>/`, and "activates" a skill in a scope by symlinking from the scope's skills dir to the store. This skill teaches you how to drive that workflow on the user's behalf.

## Mental model — keep these four things straight

Most mistakes come from confusing these. Hold them clearly.

- **Registry** — `~/.mechanic/registry.json`. Every skill mechanic knows about. Source of truth for identity (id, name, source url, ref).
- **Store** — `~/.mechanic/skills/<id>/`. The actual files. Git skills live here as clones; local skills are symlinks back to the user's source dir; `.skill` archives are extracted here (frozen — `update` is a no-op).
- **Scope** — where the skill is *active*. Two scopes:
  - `user` → `~/.claude/skills/<skill-name>` symlink → store. Every session for this user sees it.
  - `project` → `<project>/.claude/skills/<skill-name>` symlink → store. Only sessions in this project tree see it. A directory is a "mechanic project" iff it (or an ancestor) contains `.mechanic.json`.
- **Lock** — `mechanic.lock` at project root. Pins every project-scoped skill (id, source, ref). Committed to git. `mechanic install` recreates the project scope from it on a fresh clone.

A registered skill is not active. Activation is a separate step (`enable`). Disabling does not unregister — it just removes the scope symlink. Removing (`remove`) deactivates everywhere, deletes the store dir, and drops the registry entry.

## Picking a scope

Default scope when `enable` is run with no `--scope`:
- Inside a mechanic project (`.mechanic.json` found by walking up from cwd): **project**.
- Otherwise: **user**.

Choose explicitly when you're unsure what the user wants:
- "Available everywhere", "all my projects", "globally" → `--scope user`.
- "For this repo", "for the team", "for this project" → `--scope project` (and ensure `mechanic init` has been run; project scope writes `mechanic.lock`).

If you're not sure which the user means, ask. Picking wrong leaves a confusing trail (lock entries they didn't want, or symlinks in `~/.claude/skills` they have to clean up).

## Discovering new skills

If the user is asking "is there a skill for X" / "find me something that does Y" / "how do I make Claude better at Z" — i.e. they don't yet know which skill they want — the install flows below skip a step. You need to *find* a candidate first.

Read `references/finding-skills.md` for the full discovery playbook (which curated repos to check, how to use `mechanic skill find --json` to enumerate them, how to judge quality without install counts, when to fall back to GitHub search, and how to present findings to the user). The short version:

1. `mechanic skill list` — make sure they don't already have it
2. `mechanic skill find <curated-repo> --json` — enumerate candidates in well-known collections (`anthropics/skills`, `vercel-labs/agent-skills`, `ComposioHQ/awesome-claude-skills`, plus whatever `mechanic skill list` shows under "Bundled built-ins")
3. Verify the match is real (source reputation, recent commits, substantive SKILL.md) — don't recommend a skill you haven't at least skimmed
4. Present it, ask scope (user vs project), then jump into the install flow below

If nothing fits, say so plainly and offer to do the task inline; don't fabricate a skill that doesn't exist.

## The common flows

### Install a skill from GitHub

Use shorthand wherever possible — it's what users expect.

```sh
mechanic skill add owner/repo                          # repo root is the skill
mechanic skill add owner/repo/path/to/skill            # subpath inside repo
mechanic skill add owner/repo@skill-name               # filter by SKILL.md `name:`
mechanic skill add owner/repo#feature-branch           # specific ref
mechanic skill add gitlab:group/subgroup/repo          # gitlab shorthand
mechanic skill add https://github.com/owner/repo.git   # full git url also fine
```

After `add`, the skill is in the **registry + store** but not active. To activate:

```sh
mechanic skill enable <id>                             # project scope if in a project, else user
mechanic skill enable <id> --scope user                # force user scope
```

The id comes from `add`'s output (`✓ added <id>`). If you didn't capture it, `mechanic skill list` shows everything.

### Install a skill from a local path you're authoring

```sh
mechanic skill add ./my-skill                          # symlink semantics: live edits to the source land in the store
mechanic skill enable my-skill --scope user
```

Edits to `./my-skill` are visible immediately because the store is a symlink to it. Good for iterating on a skill you're writing.

### Install a packaged `.skill` archive

```sh
mechanic skill add ./cool-skill.skill                  # extracted into store; frozen
mechanic skill enable cool-skill
```

`.skill` is a zip. `mechanic skill update` skips it (no upstream to pull from).

### Set up project-scoped skills for a team

```sh
cd my-repo
mechanic init                                          # writes .mechanic.json + .gitignore entry for .claude/skills/
mechanic skill add owner/some-skill
mechanic skill enable some-skill                       # defaults to project scope here; writes mechanic.lock
git add .mechanic.json mechanic.lock .gitignore
git commit -m "wire up shared skills via mechanic"
```

Teammate clones the repo:

```sh
mechanic install                                       # rebuilds .claude/skills/ from mechanic.lock
```

`mechanic.lock` is what makes this reproducible — it pins the source url and (for git skills) the resolved commit SHA. Treat it like `package-lock.json`: commit it, don't hand-edit it.

### Non-Claude-Code agent dirs (Cursor, etc.)

`mechanic` writes symlinks into `.claude/skills/` by default. Override per-project or per-invocation:

```sh
mechanic init --agent-dir .cursor/skills               # persisted in .mechanic.json
mechanic skill enable some-skill --agent-dir .cursor/skills    # one-off override
```

User scope follows the same path under `$HOME` (`~/.cursor/skills/` in the example above).

### Adopt existing skills already on disk

```sh
mechanic skill scan                                    # walks user + project .claude/skills, offers to adopt unmanaged dirs
mechanic skill scan ./some/tree --verbose              # walk arbitrary tree; verbose explains why each path was kept/skipped
mechanic skill find owner/monorepo                     # browse a remote/local repo, multi-select which SKILL.md dirs to register
mechanic skill find owner/monorepo --json              # non-interactive: print every discovered skill as JSON (proposedId, subpath, description, alreadyRegistered) so agents can pick a target subpath before calling `add`
mechanic skill find owner/monorepo --all               # non-interactive: register every discovered skill in one clone (avoids re-cloning per `add`)
```

`--json` and `--all` make `find` safe for non-TTY contexts (CI, agents). With no flag and no TTY, `find` errors out rather than hanging on a picker that can't render.

`scan` **copies** skills into the store (source tree is never mutated). After adopting, the original directory is still sitting in the scope's skills dir as a real folder — to make mechanic own activation in that scope, run `mechanic skill enable <id> --replace`. Without `--replace`, enable refuses to clobber a real directory.

### Update, disable, remove

```sh
mechanic skill update                                  # pull every git-sourced skill
mechanic skill update <id>                             # one skill
mechanic skill disable <id> [--scope ...]              # remove scope symlink only; store + registry untouched
mechanic skill remove <id>                             # nuke everywhere: disable all scopes, delete store, drop registry
```

`update` for local-source skills added via `mechanic skill scan` re-copies from the original path. Local skills added via `mechanic skill add ./path` are symlinks — they're already live and `update` is a no-op for them. `.skill` archives can't be updated; redistribute a new archive instead.

### Diagnose breakage

```sh
mechanic skill list                                    # what's registered, what's active where
mechanic skill info <id>                               # source, ref, store path, active scopes
mechanic doctor                                        # broken symlinks, orphan store dirs, stale tmp clones, registry/store drift
mechanic doctor --fix                                  # clean them up
```

When the user reports "the skill isn't showing up in Claude" or similar, run `list` first to see whether it's registered + active in the expected scope, then `doctor` if state looks weird.

## Safety rails worth knowing

- `enable` won't clobber a real directory at the scope path. If they hit that, ask before suggesting `--replace` — it deletes that directory.
- mechanic refuses to remove symlinks it doesn't own (anything pointing outside `~/.mechanic/skills/`), so manual symlinks the user made by hand are safe.
- Archive extraction has a zip-slip guard; `.skill` files from untrusted sources still warrant a quick look before adding.

## Pitfalls

- **"I added it but Claude doesn't see it."** `add` registers; you also need `enable`. Run `mechanic skill list` to confirm scope status.
- **Project scope in a directory that isn't a mechanic project.** `enable` will fall back to user scope silently if it can't find `.mechanic.json`. If the user wanted project scope, run `mechanic init` first.
- **Teammate cloned the repo but skills aren't there.** They need `mechanic install`. `.claude/skills/` is gitignored — only the lock file travels.
- **Stale tmp dirs in the store.** Failed clones can leave `~/.mechanic/skills/.tmp-*` behind. `mechanic doctor --fix` cleans those.
- **Hand-edited `mechanic.lock`.** Don't. Use `enable` / `disable` and let mechanic maintain it.

## When NOT to use mechanic

- The user just wants to **write** a new skill from scratch — that's `skill-creator` territory. mechanic only scaffolds a barebones SKILL.md (`mechanic skill new <name>`); use skill-creator for the iterative dev loop.
- The user wants Claude Code **hooks** configured — `mechanic hooks` is scaffolded but not implemented yet. Point them at the `update-config` skill or hand-edit `~/.claude/settings.json` instead.
- The user wants to manage non-skill Claude Code state (settings, MCP servers, agents). mechanic only handles skills.

## Quick reference

| Goal | Command |
| --- | --- |
| Register a skill | `mechanic skill add <source>` |
| Activate in current default scope | `mechanic skill enable <id>` |
| Activate everywhere for this user | `mechanic skill enable <id> --scope user` |
| Activate for a project (writes lock) | `cd <project> && mechanic init && mechanic skill enable <id>` |
| Restore project skills on a fresh clone | `mechanic install` |
| Bulk-register from a monorepo | `mechanic skill find <repo>` |
| Adopt unmanaged skills already on disk | `mechanic skill scan` |
| Pull latest for git skills | `mechanic skill update [--all]` |
| Turn off in a scope | `mechanic skill disable <id> [--scope ...]` |
| Forget completely | `mechanic skill remove <id>` |
| See what's registered + active | `mechanic skill list` |
| Inspect one skill | `mechanic skill info <id>` |
| Repair drift | `mechanic doctor [--fix]` |
