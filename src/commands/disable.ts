import path from "node:path";
import pc from "picocolors";
import { loadRegistry } from "../lib/registry.js";
import { skillsStore, findProjectRoot } from "../lib/paths.js";
import {
  scopeSkillsDir,
  defaultScope,
  parseScope,
  type Scope,
} from "../lib/scope.js";
import { safeUnlink } from "../lib/symlink.js";
import { removeLock } from "../lib/lock.js";

export async function disable(
  id: string,
  opts: { scope?: string; agentDir?: string },
): Promise<void> {
  const reg = loadRegistry();
  const s = reg.skills[id];
  if (!s) throw new Error(`Unknown skill: ${id}`);

  const scope: Scope = parseScope(opts.scope) ?? defaultScope();
  const skillsDir = scopeSkillsDir(scope, { agentDir: opts.agentDir });
  const link = path.join(skillsDir, s.name);
  const ok = safeUnlink(link, path.join(skillsStore(), id));

  if (!ok) {
    console.log(
      pc.yellow(`not active in ${scope} (or not owned by mechanic)`),
    );
    return;
  }

  if (scope === "project") {
    const root = findProjectRoot();
    if (root) removeLock(root, id);
  }

  console.log(
    `${pc.green("✓ disabled")} ${pc.bold(id)} ${pc.dim(`@ ${scope}`)}`,
  );
}
