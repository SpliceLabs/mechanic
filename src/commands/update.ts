import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { loadRegistry, saveRegistry } from "../lib/registry.js";
import { skillsStore, findProjectRoot, tmpStorePath } from "../lib/paths.js";
import { gitClone, gitPull, gitHeadSha } from "../lib/git.js";
import { selectSkillFromClone } from "../lib/skill.js";
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

    if (s.source.type === "git") {
      const store = path.join(skillsStore(), sid);
      let ref: string;
      if (s.source.subpath) {
        // Skill lives at a subpath; re-clone and replace the store copy.
        const tmp = tmpStorePath(`update-${sid}`);
        try {
          gitClone(s.source.url, tmp, { ref: s.source.ref });
          const picked = selectSkillFromClone(tmp, {
            subpath: s.source.subpath,
          });
          ref = gitHeadSha(tmp);
          fs.rmSync(store, { recursive: true, force: true });
          fs.cpSync(picked.dir, store, { recursive: true });
        } finally {
          fs.rmSync(tmp, { recursive: true, force: true });
        }
      } else {
        gitPull(store);
        ref = gitHeadSha(store);
      }
      s.ref = ref;
      if (root && lockedIds.has(sid)) {
        upsertLock(root, { id: sid, source: s.source, ref });
      }
      console.log(
        `${pc.green("✓ updated")} ${pc.bold(sid)} ${pc.dim(`→ ${ref.slice(0, 8)}`)}`,
      );
      continue;
    }

    if (s.source.type === "archive") {
      console.log(pc.dim(`skip ${sid}: archive install is frozen`));
      continue;
    }

    // local source: re-copy from origin if the store holds a real-dir copy.
    // Store entries that are themselves symlinks (e.g. `mechanic add <path>`
    // semantics) follow the source directly — nothing to refresh.
    const store = path.join(skillsStore(), sid);
    let storeStat: fs.Stats;
    try {
      storeStat = fs.lstatSync(store);
    } catch {
      console.log(pc.yellow(`skip ${sid}: store entry missing`));
      continue;
    }
    if (storeStat.isSymbolicLink()) {
      console.log(pc.dim(`skip ${sid}: linked local source — already live`));
      continue;
    }
    if (!fs.existsSync(s.source.url)) {
      console.log(
        pc.yellow(`skip ${sid}: source path missing (${s.source.url})`),
      );
      continue;
    }
    fs.rmSync(store, { recursive: true, force: true });
    fs.cpSync(s.source.url, store, { recursive: true });
    console.log(
      `${pc.green("✓ refreshed")} ${pc.bold(sid)} ${pc.dim(`from ${s.source.url}`)}`,
    );
  }
  saveRegistry(reg);
}
