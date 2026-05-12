import fs from "node:fs";
import { registryPath, ensureMechanicHome } from "./paths.js";

export interface SkillSource {
  type: "git" | "local";
  url: string;
}

export interface SkillEntry {
  name: string;
  source: SkillSource;
  ref: string | null;
  installedAt: string;
}

export interface Registry {
  version: 1;
  skills: Record<string, SkillEntry>;
}

export function loadRegistry(): Registry {
  ensureMechanicHome();
  const p = registryPath();
  if (!fs.existsSync(p)) return { version: 1, skills: {} };
  return JSON.parse(fs.readFileSync(p, "utf8")) as Registry;
}

export function saveRegistry(reg: Registry): void {
  ensureMechanicHome();
  fs.writeFileSync(registryPath(), JSON.stringify(reg, null, 2) + "\n");
}
