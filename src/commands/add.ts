import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { input } from "@inquirer/prompts";
import { skillsStore, ensureMechanicHome } from "../lib/paths.js";
import { gitClone, gitHeadSha } from "../lib/git.js";
import {
  readSkillFrontmatter,
  selectSkillFromClone,
  slugify,
} from "../lib/skill.js";
import { loadRegistry, saveRegistry, type SkillSource } from "../lib/registry.js";
import { extractSkillArchive, isSkillArchive } from "../lib/archive.js";
import { sanitizeMetadata } from "../lib/sanitize.js";
import { parseSource, type ParsedSource } from "../lib/source-parser.js";

export async function add(source: string): Promise<void> {
  ensureMechanicHome();
  const registry = loadRegistry();

  const parsed: ParsedSource = parseSource(source);

  let sourceMeta: SkillSource;
  let ref: string | null = null;
  let skillDir: string;
  let cleanupDir: string | null = null;

  if (parsed.type === "local") {
    const abs = parsed.localPath ?? parsed.url;
    if (!fs.existsSync(abs)) throw new Error(`Path not found: ${abs}`);
    if (isSkillArchive(abs)) {
      const tmp = path.join(skillsStore(), `.tmp-${Date.now()}`);
      extractSkillArchive(abs, tmp);
      cleanupDir = tmp;
      sourceMeta = { type: "archive", url: abs };
      skillDir = tmp;
    } else {
      sourceMeta = { type: "local", url: abs };
      skillDir = abs;
    }
  } else {
    // github | gitlab | git → clone
    const cloneDir = path.join(skillsStore(), `.tmp-${Date.now()}`);
    cleanupDir = cloneDir;
    try {
      gitClone(parsed.url, cloneDir, { ref: parsed.ref });
    } catch (err) {
      if (cleanupDir && fs.existsSync(cleanupDir)) {
        fs.rmSync(cleanupDir, { recursive: true, force: true });
      }
      throw err;
    }
    ref = gitHeadSha(cloneDir);

    const picked = selectSkillFromClone(cloneDir, {
      subpath: parsed.subpath,
      skillFilter: parsed.skillFilter,
    });
    skillDir = picked.dir;

    sourceMeta = {
      type: "git",
      url: parsed.url,
      ...(parsed.ref ? { ref: parsed.ref } : {}),
      ...(picked.subpath ? { subpath: picked.subpath } : {}),
    };
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
      if (cleanupDir) fs.rmSync(cleanupDir, { recursive: true, force: true });
      throw new Error(`id '${id}' is also taken`);
    }
  }

  const finalStore = path.join(skillsStore(), id);

  if (sourceMeta.type === "local") {
    // Live link to user's original directory.
    fs.symlinkSync(sourceMeta.url, finalStore);
  } else if (sourceMeta.type === "archive") {
    // Archive extract: rename whole extracted tmp dir.
    fs.renameSync(cleanupDir!, finalStore);
    cleanupDir = null;
  } else if (sourceMeta.subpath) {
    // git + subpath: store is just the skill subtree; update re-clones.
    fs.cpSync(skillDir, finalStore, { recursive: true });
    fs.rmSync(cleanupDir!, { recursive: true, force: true });
    cleanupDir = null;
  } else {
    // git root skill: keep the full clone so `update` can `git pull`.
    fs.renameSync(cleanupDir!, finalStore);
    cleanupDir = null;
  }

  registry.skills[id] = {
    name: fm.name,
    source: sourceMeta,
    ref,
    installedAt: new Date().toISOString(),
  };
  saveRegistry(registry);

  console.log(
    `${pc.green("✓ added")} ${pc.bold(id)} ${pc.dim(`(${sanitizeMetadata(fm.name)})`)}`,
  );
}
