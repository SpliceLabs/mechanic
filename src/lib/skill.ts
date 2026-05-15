import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

export interface SkillFrontmatter {
  name: string;
  description?: string;
  [k: string]: unknown;
}

export function readSkillFrontmatter(skillDir: string): SkillFrontmatter {
  const skillMd = path.join(skillDir, "SKILL.md");
  if (!fs.existsSync(skillMd)) {
    throw new Error(`No SKILL.md found in ${skillDir}`);
  }
  const content = fs.readFileSync(skillMd, "utf8");
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error(`No YAML frontmatter in ${skillMd}`);
  const parsed = yaml.load(match[1]) as SkillFrontmatter | null;
  if (!parsed || typeof parsed !== "object" || !parsed.name) {
    throw new Error(`SKILL.md frontmatter missing 'name' field in ${skillMd}`);
  }
  return parsed;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const SKILL_SEARCH_SKIP = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "out",
  ".next",
  ".cache",
  "coverage",
  "__pycache__",
  ".venv",
  "venv",
  "target",
]);

/**
 * Recursively walk `root` looking for SKILL.md files. Stops descending once a
 * SKILL.md is found (skills don't nest). Returns [dir, frontmatter] pairs.
 */
export function findSkillsIn(
  root: string,
  maxDepth = 6,
): Array<{ dir: string; fm: SkillFrontmatter }> {
  const out: Array<{ dir: string; fm: SkillFrontmatter }> = [];
  const walk = (dir: string, depth: number): void => {
    try {
      const fm = readSkillFrontmatter(dir);
      out.push({ dir, fm });
      return;
    } catch {
      // not a skill — descend
    }
    if (depth >= maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (SKILL_SEARCH_SKIP.has(e.name)) continue;
      walk(path.join(dir, e.name), depth + 1);
    }
  };
  walk(root, 0);
  return out;
}

/**
 * Pick the skill directory to register out of a cloned repo.
 * Priority: explicit subpath → skillFilter (match by frontmatter name) →
 * root SKILL.md → single skill discovered anywhere → error otherwise.
 * Returns the absolute skill dir and the subpath relative to `cloneRoot`.
 */
export function selectSkillFromClone(
  cloneRoot: string,
  opts: { subpath?: string; skillFilter?: string } = {},
): { dir: string; subpath: string } {
  if (opts.subpath) {
    const dir = path.join(cloneRoot, opts.subpath);
    if (!fs.existsSync(dir)) {
      throw new Error(`Subpath '${opts.subpath}' not found in clone`);
    }
    readSkillFrontmatter(dir); // validates SKILL.md
    return { dir, subpath: opts.subpath };
  }

  if (opts.skillFilter) {
    const found = findSkillsIn(cloneRoot).filter(
      (s) => s.fm.name === opts.skillFilter || slugify(s.fm.name) === slugify(opts.skillFilter!),
    );
    if (found.length === 0) {
      throw new Error(`Skill '${opts.skillFilter}' not found in clone`);
    }
    if (found.length > 1) {
      throw new Error(
        `Multiple skills match '${opts.skillFilter}' in clone: ${found
          .map((s) => path.relative(cloneRoot, s.dir))
          .join(", ")}`,
      );
    }
    return {
      dir: found[0].dir,
      subpath: path.relative(cloneRoot, found[0].dir),
    };
  }

  // Root SKILL.md?
  try {
    readSkillFrontmatter(cloneRoot);
    return { dir: cloneRoot, subpath: "" };
  } catch {
    // not at root — search
  }
  const found = findSkillsIn(cloneRoot);
  if (found.length === 0) {
    throw new Error(`No SKILL.md found in clone`);
  }
  if (found.length > 1) {
    throw new Error(
      `Clone contains ${found.length} skills; specify subpath or @skill-name. ` +
        `Found: ${found.map((s) => path.relative(cloneRoot, s.dir)).slice(0, 5).join(", ")}${found.length > 5 ? "…" : ""}`,
    );
  }
  return {
    dir: found[0].dir,
    subpath: path.relative(cloneRoot, found[0].dir),
  };
}
