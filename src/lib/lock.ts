import fs from "node:fs";
import path from "node:path";
import type { SkillSource } from "./registry.js";

export interface LockEntry {
  id: string;
  source: SkillSource;
  ref: string | null;
}

export interface Lock {
  version: 1;
  skills: LockEntry[];
}

function lockPath(projectRoot: string): string {
  return path.join(projectRoot, "mechanic.lock");
}

export function loadLock(projectRoot: string): Lock {
  const p = lockPath(projectRoot);
  if (!fs.existsSync(p)) return { version: 1, skills: [] };
  return JSON.parse(fs.readFileSync(p, "utf8")) as Lock;
}

export function saveLock(projectRoot: string, lock: Lock): void {
  fs.writeFileSync(lockPath(projectRoot), JSON.stringify(lock, null, 2) + "\n");
}

export function upsertLock(projectRoot: string, entry: LockEntry): void {
  const lock = loadLock(projectRoot);
  const i = lock.skills.findIndex((s) => s.id === entry.id);
  if (i >= 0) lock.skills[i] = entry;
  else lock.skills.push(entry);
  lock.skills.sort((a, b) => a.id.localeCompare(b.id));
  saveLock(projectRoot, lock);
}

export function removeLock(projectRoot: string, id: string): void {
  const lock = loadLock(projectRoot);
  lock.skills = lock.skills.filter((s) => s.id !== id);
  saveLock(projectRoot, lock);
}
