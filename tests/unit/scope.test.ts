import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  parseScope,
  scopeSkillsDir,
  defaultScope,
} from "../../src/lib/scope.js";
import {
  findProjectRoot,
  resolveAgentDir,
  normalizeAgentDir,
  writeProjectMarker,
  DEFAULT_AGENT_DIR,
} from "../../src/lib/paths.js";
import {
  createSandbox,
  markProject,
  type Sandbox,
} from "../helpers/sandbox.js";

let sb: Sandbox;
afterEach(() => sb?.cleanup());

describe("parseScope", () => {
  it("returns undefined for undefined input", () => {
    expect(parseScope(undefined)).toBeUndefined();
  });

  it("accepts 'user' and 'project'", () => {
    expect(parseScope("user")).toBe("user");
    expect(parseScope("project")).toBe("project");
  });

  it("throws on invalid scope", () => {
    expect(() => parseScope("global")).toThrow(/Invalid scope/);
  });
});

describe("findProjectRoot", () => {
  it("returns null when no marker is found", () => {
    sb = createSandbox();
    expect(findProjectRoot(sb.cwd)).toBeNull();
  });

  it("finds the nearest ancestor with .mechanic.json", () => {
    sb = createSandbox();
    markProject(sb.cwd);
    const nested = path.join(sb.cwd, "a", "b", "c");
    fs.mkdirSync(nested, { recursive: true });
    expect(findProjectRoot(nested)).toBe(sb.cwd);
  });
});

describe("scopeSkillsDir", () => {
  it("returns ~/<default-agent-dir> for user scope", () => {
    sb = createSandbox();
    expect(scopeSkillsDir("user")).toBe(
      path.join(sb.home, DEFAULT_AGENT_DIR),
    );
  });

  it("throws for project scope when no project marker exists", () => {
    sb = createSandbox();
    expect(() => scopeSkillsDir("project")).toThrow(/No project/);
  });

  it("auto-creates .mechanic.json when create:true", () => {
    sb = createSandbox();
    const dir = scopeSkillsDir("project", { create: true });
    expect(dir).toBe(path.join(sb.cwd, DEFAULT_AGENT_DIR));
    expect(fs.existsSync(path.join(sb.cwd, ".mechanic.json"))).toBe(true);
  });

  it("honors the per-call agentDir override on both scopes", () => {
    sb = createSandbox();
    markProject(sb.cwd);
    expect(scopeSkillsDir("user", { agentDir: ".cursor/skills" })).toBe(
      path.join(sb.home, ".cursor/skills"),
    );
    expect(scopeSkillsDir("project", { agentDir: ".cursor/skills" })).toBe(
      path.join(sb.cwd, ".cursor/skills"),
    );
  });

  it("reads project agentDir from .mechanic.json", () => {
    sb = createSandbox();
    writeProjectMarker(sb.cwd, { version: 1, agentDir: ".agents/skills" });
    expect(scopeSkillsDir("project")).toBe(
      path.join(sb.cwd, ".agents/skills"),
    );
  });
});

describe("defaultScope", () => {
  it("is 'user' when not inside a project", () => {
    sb = createSandbox();
    expect(defaultScope()).toBe("user");
  });

  it("is 'project' when inside a project", () => {
    sb = createSandbox();
    markProject(sb.cwd);
    expect(defaultScope()).toBe("project");
  });
});

describe("resolveAgentDir + normalizeAgentDir", () => {
  it("override wins over project marker", () => {
    sb = createSandbox();
    writeProjectMarker(sb.cwd, { version: 1, agentDir: ".cursor/skills" });
    expect(resolveAgentDir({ override: ".roo/skills" })).toBe(".roo/skills");
  });

  it("falls back to project marker, then default", () => {
    sb = createSandbox();
    expect(resolveAgentDir({})).toBe(DEFAULT_AGENT_DIR);
    writeProjectMarker(sb.cwd, { version: 1, agentDir: ".agents/skills" });
    expect(resolveAgentDir({})).toBe(".agents/skills");
  });

  it("rejects absolute and traversal paths", () => {
    expect(() => normalizeAgentDir("/abs/dir")).toThrow(/relative/);
    expect(() => normalizeAgentDir("a/../etc")).toThrow(/\.\./);
    expect(() => normalizeAgentDir("")).toThrow(/empty/);
  });

  it("trims trailing slashes", () => {
    expect(normalizeAgentDir(".cursor/skills/")).toBe(".cursor/skills");
  });
});
