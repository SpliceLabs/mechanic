import path from "node:path";
import pc from "picocolors";
import { loadRegistry } from "../lib/registry.js";
import {
  SKILLS_STORE,
  USER_CLAUDE,
  findProjectRoot,
} from "../lib/paths.js";
import { isOurSymlink } from "../lib/symlink.js";

function activeIn(scopeDir: string, id: string, name: string): boolean {
  const link = path.join(scopeDir, "skills", name);
  return isOurSymlink(link, path.join(SKILLS_STORE, id));
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
    return {
      id,
      name: s.name,
      src: s.source.type,
      user: activeIn(USER_CLAUDE, id, s.name),
      proj: projectClaude ? activeIn(projectClaude, id, s.name) : false,
    };
  });

  const wId = Math.max(2, ...rows.map((r) => r.id.length));
  const wName = Math.max(4, ...rows.map((r) => r.name.length));
  const mark = (b: boolean) => (b ? pc.green("on ") : pc.dim("off"));

  console.log(
    pc.bold(
      `${"ID".padEnd(wId)}  ${"NAME".padEnd(wName)}  SRC    USER  PROJ`,
    ),
  );
  for (const r of rows) {
    console.log(
      `${r.id.padEnd(wId)}  ${r.name.padEnd(wName)}  ${r.src.padEnd(5)}  ${mark(r.user)}   ${mark(r.proj)}`,
    );
  }
}
