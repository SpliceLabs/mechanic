import path from "node:path";
import pc from "picocolors";
import { loadRegistry } from "../lib/registry.js";
import {
  skillsStore,
  userClaude,
  findProjectRoot,
} from "../lib/paths.js";
import { isOurSymlink } from "../lib/symlink.js";
import { readSkillFrontmatter } from "../lib/skill.js";
import { sanitizeMetadata } from "../lib/sanitize.js";

export async function info(id: string): Promise<void> {
  const reg = loadRegistry();
  const s = reg.skills[id];
  if (!s) {
    console.error(pc.red(`Unknown skill: ${id}`));
    process.exitCode = 1;
    return;
  }
  const store = path.join(skillsStore(), id);
  let description: string | undefined;
  try {
    description = readSkillFrontmatter(store).description;
  } catch {}
  console.log(pc.bold(id));
  console.log(`  name:    ${sanitizeMetadata(s.name)}`);
  if (description) console.log(`  desc:    ${sanitizeMetadata(description)}`);
  const sourceExtras = [
    s.source.ref ? `branch ${s.source.ref}` : null,
    s.source.subpath ? `subpath ${s.source.subpath}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  console.log(
    `  source:  ${s.source.type} ${s.source.url}${sourceExtras ? pc.dim(` (${sourceExtras})`) : ""}`,
  );
  console.log(`  ref:     ${s.ref ?? pc.dim("(local)")}`);
  console.log(`  store:   ${store}`);
  console.log(`  added:   ${s.installedAt}`);

  const active: string[] = [];
  if (isOurSymlink(path.join(userClaude(), "skills", s.name), store)) {
    active.push("user");
  }
  const root = findProjectRoot();
  if (root && isOurSymlink(path.join(root, ".claude/skills", s.name), store)) {
    active.push(`project (${root})`);
  }
  console.log(`  active:  ${active.length ? active.join(", ") : pc.dim("(none)")}`);
}
