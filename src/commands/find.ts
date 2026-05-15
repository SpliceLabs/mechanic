import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import {
  skillsStore,
  ensureMechanicHome,
  tmpStorePath,
} from "../lib/paths.js";
import { gitClone, gitHeadSha } from "../lib/git.js";
import { findSkillsIn, slugify } from "../lib/skill.js";
import { loadRegistry, saveRegistry, type SkillSource } from "../lib/registry.js";
import { sanitizeMetadata } from "../lib/sanitize.js";
import { parseSource } from "../lib/source-parser.js";
import { skillPicker } from "../lib/skill-picker.js";

export async function find(source: string): Promise<void> {
  ensureMechanicHome();
  const registry = loadRegistry();

  const parsed = parseSource(source);

  let searchRoot: string;
  let cleanupDir: string | null = null;
  let baseSource: SkillSource;
  let ref: string | null = null;

  if (parsed.type === "local") {
    const abs = parsed.localPath ?? parsed.url;
    if (!fs.existsSync(abs)) throw new Error(`Path not found: ${abs}`);
    searchRoot = abs;
    baseSource = { type: "local", url: abs };
  } else {
    const cloneDir = tmpStorePath("find");
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
    searchRoot = parsed.subpath
      ? path.join(cloneDir, parsed.subpath)
      : cloneDir;
    baseSource = {
      type: "git",
      url: parsed.url,
      ...(parsed.ref ? { ref: parsed.ref } : {}),
    };
  }

  try {
    const found = findSkillsIn(searchRoot);
    if (found.length === 0) {
      console.log(pc.dim(`No SKILL.md found in ${source}`));
      return;
    }

    const cols = process.stdout.columns ?? 80;
    const items = found.map((entry, i) => {
      const rel =
        path.relative(searchRoot, entry.dir) || path.basename(entry.dir);
      const proposedId = slugify(entry.fm.name);
      const name = sanitizeMetadata(entry.fm.name);
      const description = entry.fm.description
        ? sanitizeMetadata(entry.fm.description)
        : "";
      const collision = registry.skills[proposedId]
        ? pc.yellow(" (id taken)")
        : "";
      const head = `${proposedId.padEnd(24)} ${pc.dim(rel)}${collision}`;
      const headRaw = `${proposedId.padEnd(24)} ${rel}${collision ? " (id taken)" : ""}`;
      const tail = description || name;
      const budget = Math.max(20, cols - 6 - headRaw.length - 3);
      const tailTrunc =
        tail.length > budget ? tail.slice(0, budget - 1) + "…" : tail;
      return {
        value: i,
        label: `${head} ${pc.dim(`· ${tailTrunc}`)}`,
        searchKey: `${proposedId} ${name} ${rel} ${description}`,
      };
    });

    const picked = await skillPicker({
      message: `Skills in ${source}`,
      items,
      pageSize: 15,
    });

    if (picked.length === 0) {
      console.log(pc.dim("Nothing selected."));
      return;
    }

    for (const i of picked) {
      const entry = found[i];
      let id = slugify(entry.fm.name);
      let n = 2;
      while (registry.skills[id]) {
        id = `${slugify(entry.fm.name)}-${n}`;
        n++;
      }
      const dest = path.join(skillsStore(), id);

      if (baseSource.type === "local") {
        // Live link into the user's tree.
        fs.symlinkSync(entry.dir, dest);
      } else {
        // Copy the skill subtree out of the clone.
        fs.cpSync(entry.dir, dest, { recursive: true });
      }

      const subpath = path.relative(
        cleanupDir ?? searchRoot,
        entry.dir,
      );
      const entrySource: SkillSource = {
        ...baseSource,
        ...(subpath ? { subpath } : {}),
      };

      registry.skills[id] = {
        name: entry.fm.name,
        source: entrySource,
        ref,
        installedAt: new Date().toISOString(),
      };
      console.log(
        `${pc.green("✓ added")} ${pc.bold(id)} ${pc.dim(`(${sanitizeMetadata(entry.fm.name)})`)}`,
      );
    }
    saveRegistry(registry);
  } finally {
    if (cleanupDir) fs.rmSync(cleanupDir, { recursive: true, force: true });
  }
}
