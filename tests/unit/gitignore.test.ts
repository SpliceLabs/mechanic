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
  it("creates .gitignore with the entry when none exists", () => {
    sb = createSandbox();
    ensureGitignore(sb.cwd);
    expect(read()).toContain(".claude/skills/");
  });

  it("appends entry to an existing .gitignore", () => {
    sb = createSandbox();
    fs.writeFileSync(path.join(sb.cwd, ".gitignore"), "node_modules\ndist\n");
    ensureGitignore(sb.cwd);
    const content = read();
    expect(content).toContain("node_modules");
    expect(content).toContain(".claude/skills/");
  });

  it("is idempotent — no duplicate entry on repeat calls", () => {
    sb = createSandbox();
    ensureGitignore(sb.cwd);
    ensureGitignore(sb.cwd);
    ensureGitignore(sb.cwd);
    const matches = read().match(/\.claude\/skills\//g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("treats `.claude/` as equivalent (no duplicate)", () => {
    sb = createSandbox();
    fs.writeFileSync(path.join(sb.cwd, ".gitignore"), ".claude/\n");
    ensureGitignore(sb.cwd);
    expect(read()).not.toContain(".claude/skills/");
  });

  it("treats `.claude/skills` (no trailing slash) as equivalent", () => {
    sb = createSandbox();
    fs.writeFileSync(path.join(sb.cwd, ".gitignore"), ".claude/skills\n");
    ensureGitignore(sb.cwd);
    expect(read().match(/\.claude\/skills/g)?.length).toBe(1);
  });
});
