import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { loadRegistry, saveRegistry } from "../lib/registry.js";
import {
  skillsStore,
  userClaude,
  findProjectRoot,
} from "../lib/paths.js";
import { safeUnlink } from "../lib/symlink.js";
import { removeLock } from "../lib/lock.js";

export async function remove(id: string): Promise<void> {
  const reg = loadRegistry();
  const s = reg.skills[id];
  if (!s) throw new Error(`Unknown skill: ${id}`);

  const store = path.join(skillsStore(), id);
  safeUnlink(path.join(userClaude(), "skills", s.name), store);
  const root = findProjectRoot();
  if (root) {
    safeUnlink(path.join(root, ".claude/skills", s.name), store);
    removeLock(root, id);
  }

  let stat: fs.Stats | null = null;
  try {
    stat = fs.lstatSync(store);
  } catch {
    /* missing, fine */
  }
  if (stat) {
    if (stat.isSymbolicLink()) fs.unlinkSync(store);
    else fs.rmSync(store, { recursive: true, force: true });
  }

  delete reg.skills[id];
  saveRegistry(reg);
  console.log(`${pc.green("✓ removed")} ${pc.bold(id)}`);
}
