import fs from "node:fs";
import path from "node:path";
import { USER_CLAUDE, findProjectRoot, PROJECT_MARKER } from "./paths.js";

export type Scope = "user" | "project";

export function resolveScopeDir(
  scope: Scope,
  opts: { create?: boolean } = {},
): string {
  if (scope === "user") return USER_CLAUDE;
  let root = findProjectRoot();
  if (!root) {
    if (!opts.create) {
      throw new Error(
        "No project found. Run inside a mechanic project (one with .mechanic.json) or use --scope user.",
      );
    }
    root = process.cwd();
    fs.writeFileSync(
      path.join(root, PROJECT_MARKER),
      JSON.stringify({ version: 1 }, null, 2) + "\n",
    );
  }
  return path.join(root, ".claude");
}

export function defaultScope(): Scope {
  return findProjectRoot() ? "project" : "user";
}

export function parseScope(s: string | undefined): Scope | undefined {
  if (!s) return undefined;
  if (s !== "user" && s !== "project") {
    throw new Error(`Invalid scope: ${s} (expected 'user' or 'project')`);
  }
  return s;
}
