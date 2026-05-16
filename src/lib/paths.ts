import fs from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";

export const PROJECT_MARKER = ".mechanic.json";

/**
 * Default skills directory used by Claude Code. Can be overridden per project
 * via `.mechanic.json` (`agentDir` field) or per invocation via `--agent-dir`.
 * Always a relative path; both `user` (under $HOME) and `project` (under the
 * project root) scopes derive from it.
 */
export const DEFAULT_AGENT_DIR = ".claude/skills";

interface ProjectMarker {
  version: number;
  agentDir?: string;
}

export function readProjectMarker(root: string): ProjectMarker | null {
  const p = path.join(root, PROJECT_MARKER);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as ProjectMarker;
  } catch {
    return null;
  }
}

export function writeProjectMarker(root: string, data: ProjectMarker): void {
  fs.writeFileSync(
    path.join(root, PROJECT_MARKER),
    JSON.stringify(data, null, 2) + "\n",
  );
}

/**
 * Normalize a user-supplied agent dir. Rejects absolute paths and any segment
 * equal to `..` (path traversal). Trims trailing slashes.
 */
export function normalizeAgentDir(s: string): string {
  if (!s.trim()) throw new Error("agent dir must not be empty");
  if (path.isAbsolute(s) || /^[a-zA-Z]:[/\\]/.test(s)) {
    throw new Error(`agent dir must be relative: ${s}`);
  }
  const cleaned = s.replace(/\\/g, "/").replace(/\/+$/, "");
  for (const segment of cleaned.split("/")) {
    if (segment === "..") {
      throw new Error(`agent dir must not contain '..': ${s}`);
    }
  }
  return cleaned;
}

/**
 * Resolve the effective agent dir for the current invocation.
 * Precedence: explicit `override` → project marker `agentDir` → default.
 */
export function resolveAgentDir(
  opts: { override?: string; projectRoot?: string | null } = {},
): string {
  if (opts.override) return normalizeAgentDir(opts.override);
  const root =
    opts.projectRoot === undefined ? findProjectRoot() : opts.projectRoot;
  if (root) {
    const marker = readProjectMarker(root);
    if (marker?.agentDir) return normalizeAgentDir(marker.agentDir);
  }
  return DEFAULT_AGENT_DIR;
}

// Paths derived from $HOME are exposed as functions so tests can mutate
// process.env.HOME after module load and still see fresh values.

export function mechanicHome(): string {
  return path.join(os.homedir(), ".mechanic");
}

export function skillsStore(): string {
  return path.join(mechanicHome(), "skills");
}

export function registryPath(): string {
  return path.join(mechanicHome(), "registry.json");
}

export function ensureMechanicHome(): void {
  fs.mkdirSync(skillsStore(), { recursive: true });
}

/**
 * Build a tmp dir path inside `skillsStore()` that is unique across parallel
 * mechanic invocations. Caller is responsible for cleanup on success/failure.
 */
export function tmpStorePath(label = "tmp"): string {
  const rand = crypto.randomBytes(4).toString("hex");
  return path.join(skillsStore(), `.tmp-${label}-${process.pid}-${Date.now()}-${rand}`);
}

export function findProjectRoot(from: string = process.cwd()): string | null {
  let cur = path.resolve(from);
  for (;;) {
    if (fs.existsSync(path.join(cur, PROJECT_MARKER))) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
}
