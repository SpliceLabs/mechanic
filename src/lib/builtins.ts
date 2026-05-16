import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Compiled location: dist/lib/builtins.js → dist/skills/
const BUILTINS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "skills",
);

export function builtinsDir(): string {
  return BUILTINS_DIR;
}

export function builtinSkillPath(name: string): string {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(name)) {
    throw new Error(`Invalid built-in skill name: '${name}'`);
  }
  const p = path.join(BUILTINS_DIR, name);
  if (!fs.existsSync(path.join(p, "SKILL.md"))) {
    const available = listBuiltinSkills();
    const hint = available.length
      ? ` Available: ${available.join(", ")}.`
      : " No built-in skills are bundled with this install.";
    throw new Error(`Unknown built-in skill: '${name}'.${hint}`);
  }
  return p;
}

export function listBuiltinSkills(): string[] {
  if (!fs.existsSync(BUILTINS_DIR)) return [];
  return fs
    .readdirSync(BUILTINS_DIR, { withFileTypes: true })
    .filter(
      (e) =>
        e.isDirectory() &&
        fs.existsSync(path.join(BUILTINS_DIR, e.name, "SKILL.md")),
    )
    .map((e) => e.name)
    .sort();
}
