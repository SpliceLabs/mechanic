import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { input } from "@inquirer/prompts";
import { skillsStore, ensureMechanicHome } from "../lib/paths.js";
import { gitClone, gitHeadSha } from "../lib/git.js";
import { readSkillFrontmatter, slugify } from "../lib/skill.js";
import { loadRegistry, saveRegistry, type SkillSource } from "../lib/registry.js";

function isGitUrl(s: string): boolean {
  return /^(https?:\/\/|git@|ssh:\/\/|git:\/\/)/.test(s) || s.endsWith(".git");
}

export async function add(source: string): Promise<void> {
  ensureMechanicHome();
  const registry = loadRegistry();

  let sourceMeta: SkillSource;
  let ref: string | null = null;
  let skillDir: string;
  let tmpClone: string | null = null;

  if (isGitUrl(source)) {
    tmpClone = path.join(skillsStore(), `.tmp-${Date.now()}`);
    gitClone(source, tmpClone);
    ref = gitHeadSha(tmpClone);
    sourceMeta = { type: "git", url: source };
    skillDir = tmpClone;
  } else {
    const abs = path.resolve(source);
    if (!fs.existsSync(abs)) {
      throw new Error(`Path not found: ${abs}`);
    }
    sourceMeta = { type: "local", url: abs };
    skillDir = abs;
  }

  const fm = readSkillFrontmatter(skillDir);
  let id = slugify(fm.name);

  if (registry.skills[id]) {
    const alias = await input({
      message: `Skill id '${id}' already registered. Choose new id:`,
      default: `${id}-2`,
      validate: (v) => (slugify(v).length > 0 ? true : "id required"),
    });
    id = slugify(alias);
    if (registry.skills[id]) {
      if (tmpClone) fs.rmSync(tmpClone, { recursive: true, force: true });
      throw new Error(`id '${id}' is also taken`);
    }
  }

  const finalStore = path.join(skillsStore(), id);
  if (sourceMeta.type === "git") {
    fs.renameSync(tmpClone!, finalStore);
  } else {
    fs.symlinkSync(sourceMeta.url, finalStore);
  }

  registry.skills[id] = {
    name: fm.name,
    source: sourceMeta,
    ref,
    installedAt: new Date().toISOString(),
  };
  saveRegistry(registry);

  console.log(`${pc.green("✓ added")} ${pc.bold(id)} ${pc.dim(`(${fm.name})`)}`);
}
