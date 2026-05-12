import path from "node:path";
import pc from "picocolors";
import { loadRegistry } from "../lib/registry.js";
import {
  SKILLS_STORE,
  USER_CLAUDE,
  findProjectRoot,
} from "../lib/paths.js";
import { isOurSymlink } from "../lib/symlink.js";

export async function info(id: string): Promise<void> {
  const reg = loadRegistry();
  const s = reg.skills[id];
  if (!s) {
    console.error(pc.red(`Unknown skill: ${id}`));
    process.exitCode = 1;
    return;
  }
  const store = path.join(SKILLS_STORE, id);
  console.log(pc.bold(id));
  console.log(`  name:    ${s.name}`);
  console.log(`  source:  ${s.source.type} ${s.source.url}`);
  console.log(`  ref:     ${s.ref ?? pc.dim("(local)")}`);
  console.log(`  store:   ${store}`);
  console.log(`  added:   ${s.installedAt}`);

  const active: string[] = [];
  if (isOurSymlink(path.join(USER_CLAUDE, "skills", s.name), store)) {
    active.push("user");
  }
  const root = findProjectRoot();
  if (root && isOurSymlink(path.join(root, ".claude/skills", s.name), store)) {
    active.push(`project (${root})`);
  }
  console.log(`  active:  ${active.length ? active.join(", ") : pc.dim("(none)")}`);
}
