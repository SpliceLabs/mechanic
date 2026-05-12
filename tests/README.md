# Tests

Test strategy for `@splice-labs/mechanic`.

## Goal

Cover the behavior that **would actually break in a way the user cares about**: filesystem safety, data integrity, scope semantics, CLI wiring. Skip tests that just rephrase the implementation.

## Runner

[Vitest](https://vitest.dev/) with `pool: forks`.

- Forks isolate `process.env.HOME` and `process.cwd()` mutations per test file (vitest threads share these — forks don't).
- TS sources are imported directly; no separate compile step for units.
- The integration suite spawns `node dist/index.js`, so `pretest` runs `tsc` first.

Run:

```sh
npm test          # build + run once
npm run test:watch
```

## Layout

```
tests/
  README.md
  helpers/
    sandbox.ts       # temp HOME + cwd, fixture writers
  unit/
    symlink.test.ts
    registry.test.ts
    lock.test.ts
    skill.test.ts
    gitignore.test.ts
    scope.test.ts
  integration/
    cli.test.ts      # spawn the built binary, exercise commands
```

## Coverage rationale

### What we test

| Module | Why it matters |
|---|---|
| `lib/symlink` | The activation primitive. `safeUnlink` must refuse foreign symlinks — if it doesn't, mechanic could delete user files. The most safety-critical code in the project. |
| `lib/registry` | Persistence of the source of truth. JSON corruption or schema drift breaks everything. |
| `lib/lock` | Determinism (sort order) + upsert/remove semantics matter for clean git diffs. |
| `lib/skill` | Parsing user-supplied content. Bad frontmatter must fail loudly, not silently. |
| `lib/gitignore` | Idempotency is the whole point — duplicate entries are a daily papercut. |
| `lib/scope` | Project detection + auto-create gate. Wrong scope = symlink in wrong directory. |
| CLI integration | Verifies commander wiring, exit codes, end-to-end filesystem effects in an isolated HOME. |

### What we deliberately skip

- **`lib/paths`** — trivial constants and a simple ancestor walk (covered indirectly via `scope`).
- **`lib/git`** — wraps the `git` binary; testing it means either mocking subprocesses (low value) or spinning up real repos (slow, flaky). Out of scope for unit tests. Integration left to `update` exercises in dev.
- **commander wiring details** — covered by the one integration smoke test; per-flag unit tests would just retest commander.
- **picocolors output** — visual only.
- **Interactive prompts (`add` conflict, `scan` checkbox)** — would require driving stdin against TTY-only widgets. Not worth the mocking burden. The non-interactive paths exercise the underlying primitives.

## Sandbox contract

`createSandbox()` returns `{ home, cwd, cleanup }` and **mutates `process.env.HOME` and `process.cwd()`**. Every test using it must call `cleanup()` in `afterEach`. The fork pool keeps parallel files from colliding.

```ts
let sb: Sandbox;
afterEach(() => sb?.cleanup());

it("...", () => {
  sb = createSandbox();
  // ...
});
```

## Adding tests

A new test earns its place if it answers one of:

1. **Could this silently break user data or shared state?** (symlinks, registry, lock — yes; output formatting — no)
2. **Is the contract subtle?** (idempotency, sort order, error vs silent success)
3. **Is it the only thing exercising a code path the CLI depends on?**

If not, leave it out. Tests are a tax — only collect when the asset earns it.
