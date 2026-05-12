import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  parseScope,
  resolveScopeDir,
  defaultScope,
} from "../../src/lib/scope.js";
import { findProjectRoot } from "../../src/lib/paths.js";
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

describe("resolveScopeDir", () => {
  it("returns ~/.claude for user scope", () => {
    sb = createSandbox();
    expect(resolveScopeDir("user")).toBe(path.join(sb.home, ".claude"));
  });

  it("throws for project scope when no project marker exists", () => {
    sb = createSandbox();
    expect(() => resolveScopeDir("project")).toThrow(/No project/);
  });

  it("auto-creates .mechanic.json when create:true", () => {
    sb = createSandbox();
    const dir = resolveScopeDir("project", { create: true });
    expect(dir).toBe(path.join(sb.cwd, ".claude"));
    expect(fs.existsSync(path.join(sb.cwd, ".mechanic.json"))).toBe(true);
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
