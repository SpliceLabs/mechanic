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

function activeIn(scopeDir: string, id: string, name: string): boolean {
  const link = path.join(scopeDir, "skills", name);
  return isOurSymlink(link, path.join(skillsStore(), id));
}

export async function list(): Promise<void> {
  const reg = loadRegistry();
  const ids = Object.keys(reg.skills).sort();
  if (ids.length === 0) {
    console.log(pc.dim("No skills registered. Try `mechanic add <source>`."));
    return;
  }

  const projectRoot = findProjectRoot();
  const projectClaude = projectRoot ? path.join(projectRoot, ".claude") : null;

  const rows = ids.map((id) => {
    const s = reg.skills[id];
    let description: string | undefined;
    try {
      description = readSkillFrontmatter(
        path.join(skillsStore(), id),
      ).description;
    } catch {}
    return {
      id,
      name: sanitizeMetadata(s.name),
      src: s.source.type,
      user: activeIn(userClaude(), id, s.name),
      proj: projectClaude ? activeIn(projectClaude, id, s.name) : false,
      description: description ? sanitizeMetadata(description) : "",
    };
  });

  const wId = Math.max(2, ...rows.map((r) => r.id.length));
  const wName = Math.max(4, ...rows.map((r) => r.name.length));
  const wSrc = Math.max(3, ...rows.map((r) => r.src.length));
  const mark = (b: boolean) => (b ? pc.green("on ") : pc.dim("off"));

  const cols = process.stdout.columns ?? 80;
  // prefix before DESC: id + 2sp + name + 2sp + src + 2sp + "USER" (4) + 2sp + "PROJ" (4) + 2sp
  const prefixLen = wId + 2 + wName + 2 + wSrc + 2 + 4 + 2 + 4 + 2;
  const descBudget = Math.max(10, cols - prefixLen);
  const trunc = (s: string) =>
    s.length > descBudget ? s.slice(0, descBudget - 1) + "…" : s;

  console.log(
    pc.bold(
      `${"ID".padEnd(wId)}  ${"NAME".padEnd(wName)}  ${"SRC".padEnd(wSrc)}  USER  PROJ  DESC`,
    ),
  );
  for (const r of rows) {
    console.log(
      `${r.id.padEnd(wId)}  ${r.name.padEnd(wName)}  ${r.src.padEnd(wSrc)}  ${mark(r.user)}   ${mark(r.proj)}   ${pc.dim(trunc(r.description))}`,
    );
  }
}
