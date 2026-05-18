import path from "node:path";
import pc from "picocolors";
import { loadRegistry, type Registry } from "../lib/registry.js";
import { skillsStore, findProjectRoot } from "../lib/paths.js";
import { scopeSkillsDir } from "../lib/scope.js";
import { isOurSymlink } from "../lib/symlink.js";
import { readSkillFrontmatter, slugify } from "../lib/skill.js";
import { sanitizeMetadata } from "../lib/sanitize.js";
import { builtinSkillPath, listBuiltinSkills } from "../lib/builtins.js";

function activeIn(skillsDir: string, id: string, name: string): boolean {
  const link = path.join(skillsDir, name);
  return isOurSymlink(link, path.join(skillsStore(), id));
}

interface BuiltinRow {
  name: string;
  proposedId: string;
  description: string;
}

function collectUnregisteredBuiltins(reg: Registry): BuiltinRow[] {
  const rows: BuiltinRow[] = [];
  for (const name of listBuiltinSkills()) {
    let fm;
    try {
      fm = readSkillFrontmatter(builtinSkillPath(name));
    } catch {
      continue;
    }
    const proposedId = slugify(fm.name);
    if (reg.skills[proposedId]) continue;
    rows.push({
      name,
      proposedId,
      description: fm.description
        ? sanitizeMetadata(fm.description)
        : "",
    });
  }
  return rows;
}

function printBuiltinsSection(rows: BuiltinRow[]): void {
  if (rows.length === 0) return;
  console.log("");
  console.log(
    pc.bold("Bundled built-ins") +
      pc.dim(" — install with `mechanic skill add builtin:<name>`"),
  );
  const wName = Math.max(4, ...rows.map((r) => r.name.length));
  const cols = process.stdout.columns ?? 80;
  const descBudget = Math.max(10, cols - wName - 4);
  for (const r of rows) {
    const desc =
      r.description.length > descBudget
        ? r.description.slice(0, descBudget - 1) + "…"
        : r.description;
    console.log(`  ${r.name.padEnd(wName)}  ${pc.dim(desc)}`);
  }
}

export async function list(opts: { agentDir?: string } = {}): Promise<void> {
  const reg = loadRegistry();
  const ids = Object.keys(reg.skills).sort();
  const builtinRows = collectUnregisteredBuiltins(reg);

  if (ids.length === 0) {
    console.log(
      pc.dim("No skills registered. Try `mechanic skill add <source>`."),
    );
    printBuiltinsSection(builtinRows);
    return;
  }

  const userDir = scopeSkillsDir("user", { agentDir: opts.agentDir });
  const projectRoot = findProjectRoot();
  const projectDir = projectRoot
    ? scopeSkillsDir("project", { agentDir: opts.agentDir })
    : null;

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
      user: activeIn(userDir, id, s.name),
      proj: projectDir ? activeIn(projectDir, id, s.name) : false,
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

  printBuiltinsSection(builtinRows);
}
