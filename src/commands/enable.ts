import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { loadRegistry } from "../lib/registry.js";
import {
  skillsStore,
  findProjectRoot,
  resolveAgentDir,
} from "../lib/paths.js";
import {
  scopeSkillsDir,
  defaultScope,
  parseScope,
  type Scope,
} from "../lib/scope.js";
import { makeSymlink } from "../lib/symlink.js";
import { upsertLock } from "../lib/lock.js";
import { ensureGitignore } from "../lib/gitignore.js";

export async function enable(
  id: string,
  opts: { scope?: string; replace?: boolean; agentDir?: string },
): Promise<void> {
  const reg = loadRegistry();
  const s = reg.skills[id];
  if (!s) throw new Error(`Unknown skill: ${id}`);

  const scope: Scope = parseScope(opts.scope) ?? defaultScope();
  const skillsDir = scopeSkillsDir(scope, {
    create: scope === "project",
    agentDir: opts.agentDir,
  });
  const target = path.join(skillsStore(), id);
  const link = path.join(skillsDir, s.name);

  let existing: fs.Stats | null = null;
  try {
    existing = fs.lstatSync(link);
  } catch {
    /* missing */
  }

  if (existing && !existing.isSymbolicLink()) {
    if (!opts.replace) {
      throw new Error(
        `${link} exists as a real directory. Re-run with --replace to remove it ` +
          `and activate the mechanic-managed symlink in its place.`,
      );
    }
    fs.rmSync(link, { recursive: true, force: true });
  }

  makeSymlink(target, link);

  if (scope === "project") {
    const root = findProjectRoot();
    if (!root) throw new Error("Project root resolution failed unexpectedly");
    upsertLock(root, { id, source: s.source, ref: s.ref });
    ensureGitignore(
      root,
      resolveAgentDir({ override: opts.agentDir, projectRoot: root }),
    );
  }

  console.log(
    `${pc.green("✓ enabled")} ${pc.bold(id)} ${pc.dim(`@ ${scope}`)}`,
  );
}
