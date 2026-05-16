import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ensureGitignore } from "../../src/lib/gitignore.js";
import { createSandbox, type Sandbox } from "../helpers/sandbox.js";

let sb: Sandbox;
afterEach(() => sb?.cleanup());

function read(): string {
  return fs.readFileSync(path.join(sb.cwd, ".gitignore"), "utf8");
}

describe("ensureGitignore", () => {
  it("creates .gitignore with the default agent entry when none exists", () => {
    sb = createSandbox();
    ensureGitignore(sb.cwd, ".claude/skills");
    expect(read()).toContain(".claude/skills/");
  });

  it("appends entry to an existing .gitignore", () => {
    sb = createSandbox();
    fs.writeFileSync(path.join(sb.cwd, ".gitignore"), "node_modules\ndist\n");
    ensureGitignore(sb.cwd, ".claude/skills");
    const content = read();
    expect(content).toContain("node_modules");
    expect(content).toContain(".claude/skills/");
  });

  it("is idempotent — no duplicate entry on repeat calls", () => {
    sb = createSandbox();
    ensureGitignore(sb.cwd, ".claude/skills");
    ensureGitignore(sb.cwd, ".claude/skills");
    ensureGitignore(sb.cwd, ".claude/skills");
    const matches = read().match(/\.claude\/skills\//g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("treats `.claude/skills` (no trailing slash) as equivalent", () => {
    sb = createSandbox();
    fs.writeFileSync(path.join(sb.cwd, ".gitignore"), ".claude/skills\n");
    ensureGitignore(sb.cwd, ".claude/skills");
    expect(read().match(/\.claude\/skills/g)?.length).toBe(1);
  });

  it("writes the supplied custom agent dir", () => {
    sb = createSandbox();
    ensureGitignore(sb.cwd, ".cursor/skills");
    const content = read();
    expect(content).toContain(".cursor/skills/");
    expect(content).not.toContain(".claude/skills/");
  });
});
