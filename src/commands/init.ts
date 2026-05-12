import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { findProjectRoot, PROJECT_MARKER } from "../lib/paths.js";
import { ensureGitignore } from "../lib/gitignore.js";

export async function init(): Promise<void> {
  const cwd = process.cwd();
  const existing = findProjectRoot(cwd);
  if (existing && existing !== cwd) {
    console.log(
      pc.yellow(`Already inside a mechanic project: ${existing}`),
    );
    return;
  }

  const marker = path.join(cwd, PROJECT_MARKER);
  if (fs.existsSync(marker)) {
    console.log(pc.dim(`exists: ${marker}`));
  } else {
    fs.writeFileSync(marker, JSON.stringify({ version: 1 }, null, 2) + "\n");
    console.log(`${pc.green("✓ created")} ${marker}`);
  }

  ensureGitignore(cwd);
  console.log(`${pc.green("✓ ensured")} .gitignore covers .claude/skills/`);
}
