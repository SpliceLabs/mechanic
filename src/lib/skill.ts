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
