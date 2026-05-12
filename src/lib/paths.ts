import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const MECHANIC_HOME = path.join(os.homedir(), ".mechanic");
export const SKILLS_STORE = path.join(MECHANIC_HOME, "skills");
export const REGISTRY_PATH = path.join(MECHANIC_HOME, "registry.json");

export const USER_CLAUDE = path.join(os.homedir(), ".claude");
export const USER_SKILLS = path.join(USER_CLAUDE, "skills");

export const PROJECT_MARKER = ".mechanic.json";

export function ensureMechanicHome(): void {
  fs.mkdirSync(SKILLS_STORE, { recursive: true });
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
