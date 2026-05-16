import fs from "node:fs";
import path from "node:path";

/**
 * Append an ignore entry for the project's agent skills dir if no equivalent
 * line is already present. Idempotent.
 */
export function ensureGitignore(projectRoot: string, agentDir: string): void {
  const entry = agentDir.endsWith("/") ? agentDir : `${agentDir}/`;
  const equivalents = new Set([
    entry,
    entry.slice(0, -1),
    `/${entry}`,
    `/${entry.slice(0, -1)}`,
  ]);
  const p = path.join(projectRoot, ".gitignore");
  let content = "";
  if (fs.existsSync(p)) content = fs.readFileSync(p, "utf8");
  const lines = content.split("\n").map((l) => l.trim());
  if (lines.some((l) => equivalents.has(l))) return;
  const sep = content.length === 0 || content.endsWith("\n") ? "" : "\n";
  fs.writeFileSync(p, `${content}${sep}\n# mechanic\n${entry}\n`);
}
