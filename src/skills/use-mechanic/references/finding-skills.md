# Finding skills with mechanic

When the user wants help with a task that might already be solved by an existing skill — "is there a skill for X?", "how do I do Y?", "find me something that does Z" — your job is to discover whether one exists, evaluate it, and offer to install it via mechanic. This file is the discovery playbook.

Use it whenever the user:

- Explicitly asks ("find a skill for…", "is there a mechanic skill that…")
- Asks "how do I do X" where X is the kind of repeatable task a skill would package up
- Mentions wanting Claude to be better at a specific domain (testing, deploys, design, docs, code review, …)
- Brings up a workflow that feels packageable and isn't already covered by their current installed skills

If the user just wants help with a one-off task that you can handle directly, skip this — don't push a skill on them.

## The mental model

mechanic is *not* a global skill marketplace like npm. There's no central registry, no install counts, no leaderboard. Skills live in git repos. Discovery is:

1. Know which repos collect skills.
2. Use `mechanic skill find <repo> --json` to list what's inside any given repo without registering anything.
3. Pair that with `gh` / web search when you don't already know a relevant repo.

`mechanic skill find ... --json` is the key tool here — it clones the repo to a tmp dir, walks for every `SKILL.md`, and prints JSON to stdout (one entry per skill: `name`, `proposedId`, `subpath`, `description`, `alreadyRegistered`). That output is exactly what an agent needs to decide whether anything in the repo matches the user's ask.

## Known curated repos to check first

Start by checking the well-known collections. Most "is there a skill for X" questions are answered by one of these:

| Repo | What's inside |
| --- | --- |
| `anthropics/skills` | Anthropic's first-party skills (pdf, docx, xlsx, pptx, canvas-design, frontend-design, mcp-builder, slack-gif-creator, web-artifacts-builder, webapp-testing, brand-guidelines, claude-api, doc-coauthoring, internal-comms, theme-factory, algorithmic-art, skill-creator, …) |
| `vercel-labs/agent-skills` | Web stack skills from Vercel (React best practices, Next.js, design, performance, …) |
| `ComposioHQ/awesome-claude-skills` | Community-curated index pointing at many third-party skill repos |
| `SpliceLabs/mechanic` (`builtin:<name>`) | Skills bundled with mechanic itself. Currently: `use-mechanic`. See `mechanic skill list` output for what's available locally. |

Treat this list as a starting set, not exhaustive. New repos appear; old ones disappear. Don't pretend to know what's inside a repo without checking it.

## The discovery flow

### Step 1 — Pin down what the user actually needs

Before searching, name the thing:

- Domain (web frontend, data analysis, devops, docs, …)
- Specific task (write a changelog, set up Playwright, format a CSV, …)
- Whether it's repeatable enough that a skill is worth installing vs. just doing it once inline

If it's a one-off (e.g., "rename this variable across the repo"), don't bother with a skill — just do it.

### Step 2 — Check what they already have

```sh
mechanic skill list
```

This shows registered + active skills *and* the bundled built-ins section. The user may already have a skill installed for this; don't re-suggest it.

### Step 3 — Enumerate the curated repos with `find --json`

Run `find --json` against the most likely curated repo for the user's domain. For example, web/React → `vercel-labs/agent-skills`; document processing → `anthropics/skills`; broad / unknown → start with `anthropics/skills` then widen.

```sh
mechanic skill find anthropics/skills --json
mechanic skill find vercel-labs/agent-skills --json
```

Parse the JSON and look for matches on `name`, `proposedId`, or `description`. The `subpath` field tells you the exact `mechanic skill add` argument you'd use.

If the curated repos don't have anything obvious, the next moves are:

- `gh search repos "claude skill <topic>" --limit 10` — find unknown repos
- Web search for "claude code skill <topic>"
- Ask the user if they have a repo in mind

### Step 4 — Verify the skill before recommending

You don't have install counts. Use these signals instead:

1. **Source reputation.** Skills from `anthropics`, `vercel-labs`, `microsoft`, `googleapis`, the user's own org, etc. are higher-trust. Skills from unknown personal accounts deserve a quick sanity check.
2. **GitHub stars + last-commit recency.** `gh repo view <owner>/<repo>` gives both. A repo with 3 stars and no commits in 18 months is a yellow flag.
3. **SKILL.md quality.** The `description` field you got from `find --json` is the agent-triggering surface. If it's vague ("helps with stuff") the skill is probably under-baked. Cat the SKILL.md to see if it's substantive — clear "when to use", explicit steps, examples.
4. **Bundled assets.** Skills that ship `scripts/` or `references/` are usually more deliberate than a one-file SKILL.md. Not a hard rule, but a useful signal.

Don't recommend something you haven't at least skimmed.

### Step 5 — Present + install

Tell the user what you found in plain terms — name, what it does, where it lives, the install command they'd run. Don't dump JSON at them.

```
Found one: `anthropics/skills/skills/pdf` (from the official anthropics/skills repo).
It handles reading, splitting, merging, watermarking, and OCRing PDFs.

To install globally:
  mechanic skill add anthropics/skills/skills/pdf
  mechanic skill enable pdf --scope user

Or scoped to just this project: drop the `--scope user` flag (the project
scope is the default inside a mechanic project, and writes `mechanic.lock`).

Want me to install it now?
```

If they say yes, run it. If user scope vs project scope is ambiguous (they didn't say "globally" or "for this project"), ask — picking wrong leaves the wrong kind of cleanup trail.

For repos with a lot of skills you want to install all at once, `mechanic skill find <repo> --all` registers every match in one clone (saves N round-trips vs. running `add` per skill).

### Step 6 — When nothing exists

If neither the curated repos nor a wider search turns up anything good:

1. Say so plainly. Don't invent a skill that doesn't exist or pretend a marginal hit is a good match.
2. Offer to do the task directly using general capabilities.
3. If it's a recurring workflow for them, mention they can scaffold their own with `mechanic skill new <name>` and either `add` it locally or push it to a repo and `add` from there.

```
I checked anthropics/skills, vercel-labs/agent-skills, and searched GitHub
for "claude skill xyz" — nothing focused on this. I can still help you
do it directly. If you end up doing this often, `mechanic skill new
my-xyz-skill` scaffolds a SKILL.md so you can package the workflow up
later.
```

## Common categories → which repo to try first

Rough heuristic for where to look first based on the user's ask. Always verify with `find --json` — don't assume a skill exists just because a category matches.

| Category | Try first |
| --- | --- |
| PDF / DOCX / XLSX / PPTX / OCR | `anthropics/skills` |
| Frontend / React / Next.js / web design | `vercel-labs/agent-skills`, then `anthropics/skills` |
| Design / canvas / brand guidelines | `anthropics/skills` |
| MCP servers, Slack, internal comms | `anthropics/skills` |
| Web app testing / e2e | `anthropics/skills` (webapp-testing) |
| Anything else | `ComposioHQ/awesome-claude-skills` (catalog), then `gh search repos` |

## Tips

- `find --json` requires no flags about quiet/no-color — the JSON goes to stdout, status messages go to stderr. Pipe to `jq` if you want to filter.
- The `proposedId` field is what the skill will be registered as. If it collides with an existing skill, `add` will prompt for an alias (or fail in non-interactive mode); be ready to suggest an alternative id.
- For an unknown repo with many skills, run `find <repo> --json | jq '.[].description'` first to skim what's there before committing to install anything.
- When you install something for the first time, `mechanic skill info <id>` after the fact shows the pinned ref + store path so you can verify it landed.
- Never recommend `mechanic skill add` against a URL the user didn't ask about *or* a repo that didn't come out of the curated list / a search you actually ran. Made-up sources don't exist and will fail noisily.
