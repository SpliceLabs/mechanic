# @splicelabs/mechanic

A skill registry and scope manager for [Claude Code](https://claude.com/claude-code).

Register a skill once from a Git URL, local path, or `.skill` archive, then toggle it on or off across user and project scopes. Mechanic owns a canonical copy of every skill under `~/.mechanic/skills/<id>` and activates skills by creating symlinks into the appropriate `.claude/skills/` directory. Project-scoped activations are pinned via a `mechanic.lock` file so teammates can reproduce them with `mechanic install`.

## Install

```sh
npm install -g @splicelabs/mechanic
```

Requires Node 18+ and `git` on `PATH`.

## Quick start

```sh
# register a skill from GitHub
mechanic add https://github.com/some-org/cool-skill.git

# or from a local directory you're authoring
mechanic add ./my-skill

# or from a packaged .skill archive (zip)
mechanic add ./cool-skill.skill

# list what's known
mechanic list

# enable in your user scope (~/.claude/skills/)
mechanic enable cool-skill --scope user

# inside a project, scope defaults to the project
cd my-repo
mechanic init
mechanic enable cool-skill              # writes mechanic.lock + .gitignore

# teammate clones the repo and restores the same skills
mechanic install
```

## Concepts

**Registry.** A JSON file at `~/.mechanic/registry.json` listing every skill mechanic knows about. The source of truth for identity (`id`, name, source URL, ref).

**Store.** `~/.mechanic/skills/<id>/` holds the canonical copy of each skill. Git-sourced skills are cloned here; local-sourced skills are a symlink to the real directory; `.skill`-sourced skills are extracted in place (frozen — `update` is a no-op).

**`.skill` archives.** A `.skill` file is a plain zip containing a skill. Mechanic accepts either layout: `SKILL.md` at the archive root, or wrapped in a single top-level directory. Useful for distributing a skill as a single file.

**Scopes.** Mechanic activates skills in two scopes:

- **user** &mdash; `~/.claude/skills/`, available to every Claude Code session for your user.
- **project** &mdash; `<project>/.claude/skills/`, scoped to a directory tree marked by `.mechanic.json`. The directory is gitignored; reproducibility comes from `mechanic.lock`.

Activation is a symlink from the scope directory back to the store. Deactivation removes the symlink. The store entry is never touched until you run `mechanic remove`.

**Lock file.** `mechanic.lock` in a project root records every skill enabled at project scope, with the source URL and (for git sources) the commit SHA. `mechanic install` rebuilds the project's `.claude/skills/` from the lock.

## Commands

| Command | Description |
| --- | --- |
| `mechanic add <source>` | Register a skill from a git URL, a local path, or a `.skill` zip archive. |
| `mechanic list` | Show every registered skill and whether it's active in each scope. |
| `mechanic info <id>` | Print details for one skill: source, ref, store path, active scopes. |
| `mechanic enable <id> [--scope user\|project] [--replace]` | Activate a skill in a scope. Defaults to project if you're inside one. `--replace` removes a real directory at the scope path before installing the symlink. |
| `mechanic disable <id> [--scope ...]` | Deactivate a skill in a scope. |
| `mechanic remove <id>` | Deactivate everywhere, delete the store entry, drop the registry record. |
| `mechanic update [id] [--all]` | Pull updates for git-sourced skills. For local sources held as a copy in the store, re-copies from the original path so edits at the source land in the store. `.skill`-sourced skills are frozen and skipped. |
| `mechanic scan [dir] [--verbose]` | Find unmanaged skills and **copy** them into the store. Source trees are never mutated. Without args, walks user + project scope `.claude/skills/` directories. With a path, recursively walks that directory (depth 5). `--verbose` logs every path inspected and why it was kept or skipped. Adoption only registers + copies — to activate an adopted skill in a scope, run `mechanic enable <id> [--scope ...]` (use `--replace` if the scope path is still occupied by the original real directory). Interactive checklist supports type-to-search, `esc` to quit (or to clear filter while searching), `enter` to confirm. |
| `mechanic init` | Mark the current directory as a mechanic project (`.mechanic.json` + `.gitignore`). |
| `mechanic install` | Apply `mechanic.lock`: clone or symlink each pinned skill, register it, and enable it at project scope. |
| `mechanic doctor [--fix]` | Diagnose broken symlinks, orphan store directories, and stale registry entries. `--fix` cleans them up. |

## Project layout when you adopt mechanic

```
my-project/
  .mechanic.json        # project marker
  mechanic.lock         # commit this — pins every project-scoped skill
  .gitignore            # mechanic appends ".claude/skills/"
  .claude/
    skills/             # gitignored; populated with symlinks by mechanic
```

## Development

```sh
git clone https://github.com/SpliceLabs/mechanic.git
cd mechanic
npm install
npm test                # build + run vitest
npm run dev             # tsc --watch
node dist/index.js …    # run the CLI locally
```

The test strategy is documented in [`tests/README.md`](tests/README.md).

## License

MIT &copy; Splice Labs
