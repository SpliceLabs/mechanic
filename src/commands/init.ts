import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import {
  findProjectRoot,
  PROJECT_MARKER,
  readProjectMarker,
  writeProjectMarker,
  normalizeAgentDir,
  DEFAULT_AGENT_DIR,
} from "../lib/paths.js";
import { ensureGitignore } from "../lib/gitignore.js";

export async function init(opts: { agentDir?: string } = {}): Promise<void> {
  const cwd = process.cwd();
  const existing = findProjectRoot(cwd);
  if (existing && existing !== cwd) {
    console.log(pc.yellow(`Already inside a mechanic project: ${existing}`));
    return;
  }

  const requested = opts.agentDir
    ? normalizeAgentDir(opts.agentDir)
    : undefined;
  const marker = path.join(cwd, PROJECT_MARKER);
  const current = fs.existsSync(marker) ? readProjectMarker(cwd) : null;

  const data = {
    version: 1,
    ...(current?.agentDir ? { agentDir: current.agentDir } : {}),
    ...(requested ? { agentDir: requested } : {}),
  };

  if (current && current.agentDir === data.agentDir) {
    console.log(pc.dim(`exists: ${marker}`));
  } else {
    writeProjectMarker(cwd, data);
    console.log(`${pc.green("✓ wrote")} ${marker}`);
  }

  const effective = data.agentDir ?? DEFAULT_AGENT_DIR;
  ensureGitignore(cwd, effective);
  console.log(`${pc.green("✓ ensured")} .gitignore covers ${effective}/`);
}
