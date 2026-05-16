import os from "node:os";
import path from "node:path";
import {
  findProjectRoot,
  resolveAgentDir,
  writeProjectMarker,
} from "./paths.js";

export type Scope = "user" | "project";

export interface ScopeOpts {
  /** Create a project marker at cwd if none is found (project scope only). */
  create?: boolean;
  /** Override the resolved agent dir for this invocation. */
  agentDir?: string;
}

/**
 * Returns the full skills directory for a scope, e.g. `~/.claude/skills` or
 * `<project-root>/.claude/skills`. Both legs are built off the resolved
 * agent dir (default `.claude/skills`, overridable per project or per call).
 */
export function scopeSkillsDir(scope: Scope, opts: ScopeOpts = {}): string {
  if (scope === "user") {
    return path.join(
      os.homedir(),
      resolveAgentDir({ override: opts.agentDir, projectRoot: null }),
    );
  }

  let root = findProjectRoot();
  if (!root) {
    if (!opts.create) {
      throw new Error(
        "No project found. Run inside a mechanic project (one with .mechanic.json) or use --scope user.",
      );
    }
    root = process.cwd();
    writeProjectMarker(root, { version: 1 });
  }
  return path.join(
    root,
    resolveAgentDir({ override: opts.agentDir, projectRoot: root }),
  );
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

