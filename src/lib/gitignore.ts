import fs from "node:fs";
import path from "node:path";

const ENTRY = ".claude/skills/";
const EQUIVALENT = new Set([
  ".claude/skills/",
  ".claude/skills",
  "/.claude/skills/",
  "/.claude/skills",
  ".claude/",
  ".claude",
]);

export function ensureGitignore(projectRoot: string): void {
  const p = path.join(projectRoot, ".gitignore");
  let content = "";
  if (fs.existsSync(p)) content = fs.readFileSync(p, "utf8");
  const lines = content.split("\n").map((l) => l.trim());
  if (lines.some((l) => EQUIVALENT.has(l))) return;
  const sep = content.length === 0 || content.endsWith("\n") ? "" : "\n";
  fs.writeFileSync(p, `${content}${sep}\n# mechanic\n${ENTRY}\n`);
}
