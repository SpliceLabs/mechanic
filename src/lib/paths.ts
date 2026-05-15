import fs from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";

export const PROJECT_MARKER = ".mechanic.json";

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

export function userClaude(): string {
  return path.join(os.homedir(), ".claude");
}

export function userSkills(): string {
  return path.join(userClaude(), "skills");
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
