import fs from "node:fs";
import { REGISTRY_PATH, ensureMechanicHome } from "./paths.js";

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
  if (!fs.existsSync(REGISTRY_PATH)) return { version: 1, skills: {} };
  const raw = fs.readFileSync(REGISTRY_PATH, "utf8");
  return JSON.parse(raw) as Registry;
}

export function saveRegistry(reg: Registry): void {
  ensureMechanicHome();
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(reg, null, 2) + "\n");
}
