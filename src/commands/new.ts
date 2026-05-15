import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { slugify } from "../lib/skill.js";

const TEMPLATE = `---
name: %NAME%
description: One-sentence description of when this skill should be used.
---

# %TITLE%

Brief overview of what this skill helps with.

## When to use

- Use when the user asks for X.
- Skip when Y is already handled elsewhere.

## Steps

1. First, do this.
2. Then, do that.
3. Finally, hand off.

## Notes

Anything else worth documenting — gotchas, references, invariants.
`;

function titleCase(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase() + p.slice(1))
    .join(" ");
}

export async function newSkill(name: string): Promise<void> {
  const slug = slugify(name);
  if (!slug) {
    throw new Error(`Invalid skill name: '${name}'`);
  }
  const dir = path.resolve(slug);
  if (fs.existsSync(dir)) {
    throw new Error(`Refusing to overwrite existing path: ${dir}`);
  }
  fs.mkdirSync(dir, { recursive: true });
  const skillMd = TEMPLATE.replaceAll("%NAME%", slug).replaceAll(
    "%TITLE%",
    titleCase(slug),
  );
  fs.writeFileSync(path.join(dir, "SKILL.md"), skillMd);
  console.log(
    `${pc.green("✓ scaffolded")} ${pc.bold(slug)} ${pc.dim(`in ${dir}`)}`,
  );
  console.log(pc.dim(`Edit ${path.join(dir, "SKILL.md")} then run \`mechanic add ${dir}\`.`));
}
