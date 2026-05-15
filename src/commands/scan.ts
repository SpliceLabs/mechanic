import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { skillPicker } from "../lib/skill-picker.js";
import { loadRegistry, saveRegistry, type Registry } from "../lib/registry.js";
import {
  skillsStore,
  userClaude,
  findProjectRoot,
  ensureMechanicHome,
} from "../lib/paths.js";
import { readSkillFrontmatter, slugify } from "../lib/skill.js";
import { sanitizeMetadata } from "../lib/sanitize.js";

type Origin = "user" | "project" | "external";

interface Candidate {
  origin: Origin;
  /** Where the skill lives on disk right now. */
  pathOnDisk: string;
  name: string;
  proposedId: string;
  description?: string;
}

type Verdict =
  | "candidate"
  | "scope-dir-missing"
  | "not-dir-or-symlink"
  | "mechanic-owned"
  | "no-skill-md"
  | "already-registered";

interface ScanResult {
  candidates: Candidate[];
  decisions: Array<{ path: string; verdict: Verdict; detail?: string }>;
}

const EXTERNAL_SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "out",
  ".next",
  ".cache",
  "coverage",
  ".vscode",
  ".idea",
  "__pycache__",
  ".venv",
  "venv",
  "target",
]);

const EXTERNAL_MAX_DEPTH = 5;

function scanScope(
  origin: "user" | "project",
  scopeDir: string,
  reg: Registry,
): ScanResult {
  const skillsDir = path.join(scopeDir, "skills");
  if (!fs.existsSync(skillsDir)) {
    return {
      candidates: [],
      decisions: [{ path: skillsDir, verdict: "scope-dir-missing" }],
    };
  }

  const candidates: Candidate[] = [];
  const decisions: ScanResult["decisions"] = [];

  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    const full = path.join(skillsDir, entry.name);
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(full);
    } catch {
      continue;
    }

    if (stat.isSymbolicLink()) {
      const tgt = fs.readlinkSync(full);
      const resolved = path.resolve(path.dirname(full), tgt);
      if (resolved.startsWith(path.resolve(skillsStore()))) {
        decisions.push({
          path: full,
          verdict: "mechanic-owned",
          detail: `-> ${resolved}`,
        });
        continue;
      }
    } else if (!stat.isDirectory()) {
      decisions.push({ path: full, verdict: "not-dir-or-symlink" });
      continue;
    }

    let fm;
    try {
      fm = readSkillFrontmatter(full);
    } catch (err) {
      decisions.push({
        path: full,
        verdict: "no-skill-md",
        detail: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    const id = slugify(fm.name);
    if (reg.skills[id]) {
      decisions.push({
        path: full,
        verdict: "already-registered",
        detail: `id '${id}'`,
      });
      continue;
    }

    candidates.push({
      origin,
      pathOnDisk: full,
      name: sanitizeMetadata(fm.name),
      proposedId: id,
      description: fm.description ? sanitizeMetadata(fm.description) : undefined,
    });
    decisions.push({
      path: full,
      verdict: "candidate",
      detail: `id '${id}'`,
    });
  }

  return { candidates, decisions };
}

/**
 * Walk an arbitrary directory looking for skills (any subdir containing a
 * SKILL.md). Stops descending once it finds a SKILL.md (skills don't nest).
 */
function scanExternal(root: string, reg: Registry): ScanResult {
  const candidates: Candidate[] = [];
  const decisions: ScanResult["decisions"] = [];

  function walk(dir: string, depth: number): void {
    let fm;
    try {
      fm = readSkillFrontmatter(dir);
    } catch {
      fm = null;
    }

    if (fm) {
      const id = slugify(fm.name);
      if (reg.skills[id]) {
        decisions.push({
          path: dir,
          verdict: "already-registered",
          detail: `id '${id}'`,
        });
      } else {
        candidates.push({
          origin: "external",
          pathOnDisk: dir,
          name: sanitizeMetadata(fm.name),
          proposedId: id,
          description: fm.description ? sanitizeMetadata(fm.description) : undefined,
        });
        decisions.push({
          path: dir,
          verdict: "candidate",
          detail: `id '${id}'`,
        });
      }
      return; // don't descend into a skill
    }

    if (depth >= EXTERNAL_MAX_DEPTH) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory() && !e.isSymbolicLink()) continue;
      if (EXTERNAL_SKIP_DIRS.has(e.name)) continue;
      walk(path.join(dir, e.name), depth + 1);
    }
  }

  const abs = path.resolve(root);
  if (!fs.existsSync(abs)) {
    decisions.push({
      path: abs,
      verdict: "scope-dir-missing",
      detail: "path does not exist",
    });
    return { candidates, decisions };
  }
  walk(abs, 0);
  return { candidates, decisions };
}

function logVerbose(label: string, header: string, r: ScanResult): void {
  console.log(pc.bold(`[${label}]`) + ` ${header}`);
  if (r.decisions.length === 0) {
    console.log(pc.dim("  (no entries)"));
    return;
  }
  for (const d of r.decisions) {
    const tag =
      d.verdict === "candidate"
        ? pc.green(d.verdict)
        : d.verdict === "scope-dir-missing"
          ? pc.dim(d.verdict)
          : pc.yellow(d.verdict);
    const detail = d.detail ? pc.dim(` — ${d.detail}`) : "";
    console.log(`  ${tag.padEnd(28)} ${d.path}${detail}`);
  }
}

export async function scan(
  opts: { dir?: string; verbose?: boolean } = {},
): Promise<void> {
  ensureMechanicHome();
  const reg = loadRegistry();

  const results: Array<{ label: string; header: string; result: ScanResult }> =
    [];

  if (opts.dir) {
    const abs = path.resolve(opts.dir);
    results.push({
      label: "external",
      header: `${abs} (depth ${EXTERNAL_MAX_DEPTH})`,
      result: scanExternal(abs, reg),
    });
  } else {
    results.push({
      label: "user",
      header: path.join(userClaude(), "skills"),
      result: scanScope("user", userClaude(), reg),
    });
    const root = findProjectRoot();
    if (root) {
      results.push({
        label: "project",
        header: path.join(root, ".claude", "skills"),
        result: scanScope("project", path.join(root, ".claude"), reg),
      });
    } else if (opts.verbose) {
      console.log(pc.dim("[project] not inside a mechanic project — skipped"));
    }
  }

  if (opts.verbose) {
    for (const { label, header, result } of results) logVerbose(label, header, result);
    console.log("");
  }

  const candidates = results.flatMap((r) => r.result.candidates);

  if (candidates.length === 0) {
    console.log(pc.dim("Nothing new to adopt."));
    if (!opts.verbose) {
      console.log(
        pc.dim("Re-run with --verbose to see why each path was skipped."),
      );
    }
    return;
  }

  const cols = process.stdout.columns ?? 80;
  const picked = await skillPicker({
    message: "Select skills to adopt",
    items: candidates.map((c, i) => {
      const headRaw = `${c.proposedId.padEnd(24)} ${c.origin}`;
      const head = `${c.proposedId.padEnd(24)} ${pc.dim(c.origin)}`;
      const tail = c.description ?? c.pathOnDisk;
      // 6 = "> [x] " prefix from picker, 3 = " · "
      const budget = Math.max(20, cols - 6 - headRaw.length - 3);
      const tailTrunc =
        tail.length > budget ? tail.slice(0, budget - 1) + "…" : tail;
      return {
        value: i,
        label: `${head} ${pc.dim(`· ${tailTrunc}`)}`,
        searchKey: `${c.proposedId} ${c.name} ${c.pathOnDisk} ${c.origin} ${c.description ?? ""}`,
      };
    }),
    pageSize: 15,
  });

  if (picked.length === 0) {
    console.log(pc.dim("Nothing selected."));
    return;
  }

  for (const i of picked) {
    const c = candidates[i];
    let id = c.proposedId;
    let n = 2;
    while (reg.skills[id]) {
      id = `${c.proposedId}-${n}`;
      n++;
    }
    const dest = path.join(skillsStore(), id);

    // Copy semantics for every origin: the source tree is never mutated.
    // The original path is recorded as the source so `mechanic update` can
    // refresh the store copy later.
    fs.cpSync(c.pathOnDisk, dest, { recursive: true });

    reg.skills[id] = {
      name: c.name,
      source: { type: "local", url: c.pathOnDisk },
      ref: null,
      installedAt: new Date().toISOString(),
    };
    console.log(
      `${pc.green("✓ adopted")} ${pc.bold(id)} ${pc.dim(`from ${c.origin}`)}`,
    );
  }
  saveRegistry(reg);
}
