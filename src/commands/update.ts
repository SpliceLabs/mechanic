import path from "node:path";
import pc from "picocolors";
import { loadRegistry, saveRegistry } from "../lib/registry.js";
import { SKILLS_STORE, findProjectRoot } from "../lib/paths.js";
import { gitPull, gitHeadSha } from "../lib/git.js";
import { loadLock, upsertLock } from "../lib/lock.js";

export async function update(
  id: string | undefined,
  opts: { all?: boolean },
): Promise<void> {
  const reg = loadRegistry();
  const ids = opts.all
    ? Object.keys(reg.skills)
    : id
      ? [id]
      : [];
  if (ids.length === 0) throw new Error("Specify <id> or --all");

  const root = findProjectRoot();
  const lockedIds = root
    ? new Set(loadLock(root).skills.map((s) => s.id))
    : new Set<string>();

  for (const sid of ids) {
    const s = reg.skills[sid];
    if (!s) {
      console.log(pc.yellow(`skip ${sid}: not registered`));
      continue;
    }
    if (s.source.type !== "git") {
      console.log(pc.dim(`skip ${sid}: local source`));
      continue;
    }
    const dir = path.join(SKILLS_STORE, sid);
    gitPull(dir);
    const ref = gitHeadSha(dir);
    s.ref = ref;
    if (root && lockedIds.has(sid)) {
      upsertLock(root, { id: sid, source: s.source, ref });
    }
    console.log(
      `${pc.green("✓ updated")} ${pc.bold(sid)} ${pc.dim(`→ ${ref.slice(0, 8)}`)}`,
    );
  }
  saveRegistry(reg);
}
