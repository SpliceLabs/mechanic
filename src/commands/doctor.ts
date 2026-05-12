import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import {
  loadRegistry,
  saveRegistry,
  type Registry,
} from "../lib/registry.js";
import {
  skillsStore,
  userClaude,
  findProjectRoot,
} from "../lib/paths.js";

type IssueKind =
  | "broken-symlink"
  | "orphan-symlink"
  | "missing-store"
  | "orphan-store";

interface Issue {
  kind: IssueKind;
  scope: "user" | "project" | "registry" | "store";
  target: string; // path to remove (symlink/dir) or registry id
  detail: string;
}

function scanLinks(
  scopeName: "user" | "project",
  scopeDir: string,
  reg: Registry,
): Issue[] {
  const dir = path.join(scopeDir, "skills");
  if (!fs.existsSync(dir)) return [];
  const issues: Issue[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(full);
    } catch {
      continue;
    }
    if (!stat.isSymbolicLink()) continue;
    const tgt = fs.readlinkSync(full);
    const resolved = path.resolve(path.dirname(full), tgt);
    if (!resolved.startsWith(path.resolve(skillsStore()))) continue;

    if (!fs.existsSync(resolved)) {
      issues.push({
        kind: "broken-symlink",
        scope: scopeName,
        target: full,
        detail: `target gone: ${resolved}`,
      });
      continue;
    }
    const storeId = path.basename(resolved);
    if (!reg.skills[storeId]) {
      issues.push({
        kind: "orphan-symlink",
        scope: scopeName,
        target: full,
        detail: `points at unregistered store id '${storeId}'`,
      });
    }
  }
  return issues;
}

export async function doctor(opts: { fix?: boolean }): Promise<void> {
  const reg = loadRegistry();
  const issues: Issue[] = [];

  for (const id of Object.keys(reg.skills)) {
    const store = path.join(skillsStore(), id);
    if (!fs.existsSync(store)) {
      issues.push({
        kind: "missing-store",
        scope: "registry",
        target: id,
        detail: `registry has '${id}' but store dir missing`,
      });
    }
  }

  if (fs.existsSync(skillsStore())) {
    for (const entry of fs.readdirSync(skillsStore())) {
      if (entry.startsWith(".")) continue;
      if (!reg.skills[entry]) {
        issues.push({
          kind: "orphan-store",
          scope: "store",
          target: path.join(skillsStore(), entry),
          detail: `store dir '${entry}' not in registry`,
        });
      }
    }
  }

  issues.push(...scanLinks("user", userClaude(), reg));
  const root = findProjectRoot();
  if (root) issues.push(...scanLinks("project", path.join(root, ".claude"), reg));

  if (issues.length === 0) {
    console.log(pc.green("✓ healthy — no issues found"));
    return;
  }

  for (const i of issues) {
    console.log(
      `${pc.yellow(i.kind.padEnd(16))} ${pc.dim(`[${i.scope}]`)} ${i.target}`,
    );
    console.log(`  ${pc.dim(i.detail)}`);
  }

  if (!opts.fix) {
    console.log("");
    console.log(
      pc.dim(`Re-run with ${pc.bold("--fix")} to clean up.`),
    );
    return;
  }

  let fixed = 0;
  for (const i of issues) {
    switch (i.kind) {
      case "broken-symlink":
      case "orphan-symlink":
        fs.unlinkSync(i.target);
        fixed++;
        break;
      case "missing-store":
        delete reg.skills[i.target];
        fixed++;
        break;
      case "orphan-store": {
        const stat = fs.lstatSync(i.target);
        if (stat.isSymbolicLink()) fs.unlinkSync(i.target);
        else fs.rmSync(i.target, { recursive: true, force: true });
        fixed++;
        break;
      }
    }
  }
  saveRegistry(reg);
  console.log(
    `${pc.green("✓ fixed")} ${fixed} issue${fixed === 1 ? "" : "s"}`,
  );
}
