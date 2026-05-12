import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { checkbox } from "@inquirer/prompts";
import { loadRegistry, saveRegistry, type Registry } from "../lib/registry.js";
import {
  SKILLS_STORE,
  USER_CLAUDE,
  findProjectRoot,
  ensureMechanicHome,
} from "../lib/paths.js";
import { readSkillFrontmatter, slugify } from "../lib/skill.js";

interface Candidate {
  scope: "user" | "project";
  pathOnDisk: string;
  name: string;
  proposedId: string;
}

function scanScope(
  scope: "user" | "project",
  scopeDir: string,
  reg: Registry,
): Candidate[] {
  const skillsDir = path.join(scopeDir, "skills");
  if (!fs.existsSync(skillsDir)) return [];
  const out: Candidate[] = [];
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    const full = path.join(skillsDir, entry.name);
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(full);
    } catch {
      continue;
    }
    if (stat.isSymbolicLink()) {
      const tgt = fs.readlinkSync(full);
      const resolved = path.resolve(path.dirname(full), tgt);
      if (resolved.startsWith(path.resolve(SKILLS_STORE))) continue;
    } else if (!stat.isDirectory()) {
      continue;
    }
    try {
      const fm = readSkillFrontmatter(full);
      const id = slugify(fm.name);
      if (reg.skills[id]) continue;
      out.push({ scope, pathOnDisk: full, name: fm.name, proposedId: id });
    } catch {
      /* not a skill, skip */
    }
  }
  return out;
}

export async function scan(): Promise<void> {
  ensureMechanicHome();
  const reg = loadRegistry();
  const candidates: Candidate[] = [];
  candidates.push(...scanScope("user", USER_CLAUDE, reg));
  const root = findProjectRoot();
  if (root) {
    candidates.push(...scanScope("project", path.join(root, ".claude"), reg));
  }

  if (candidates.length === 0) {
    console.log(pc.dim("Nothing new to adopt."));
    return;
  }

  const picked = await checkbox<number>({
    message: "Select skills to adopt (space toggles, enter confirms):",
    choices: candidates.map((c, i) => ({
      name: `${c.proposedId.padEnd(24)} ${pc.dim(`${c.scope}: ${c.pathOnDisk}`)}`,
      value: i,
    })),
  });

  if (picked.length === 0) {
    console.log(pc.dim("Nothing selected."));
    return;
  }

  for (const i of picked) {
    const c = candidates[i];
    let id = c.proposedId;
    while (reg.skills[id]) id = `${id}-2`;
    const dest = path.join(SKILLS_STORE, id);

    fs.renameSync(c.pathOnDisk, dest);
    fs.symlinkSync(dest, c.pathOnDisk);

    reg.skills[id] = {
      name: c.name,
      source: { type: "local", url: dest },
      ref: null,
      installedAt: new Date().toISOString(),
    };
    console.log(
      `${pc.green("✓ adopted")} ${pc.bold(id)} ${pc.dim(`from ${c.scope}`)}`,
    );
  }
  saveRegistry(reg);
}
