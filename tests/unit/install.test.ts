import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { install } from "../../src/commands/install.js";
import { saveLock } from "../../src/lib/lock.js";
import { loadRegistry } from "../../src/lib/registry.js";
import { isOurSymlink } from "../../src/lib/symlink.js";
import { skillsStore } from "../../src/lib/paths.js";
import {
  createSandbox,
  markProject,
  writeSkillFixture,
  type Sandbox,
} from "../helpers/sandbox.js";

let sb: Sandbox;
afterEach(() => sb?.cleanup());

describe("install", () => {
  it("throws when not in a project", async () => {
    sb = createSandbox();
    await expect(install()).rejects.toThrow(/Not inside a mechanic project/);
  });

  it("is a no-op for an empty lock", async () => {
    sb = createSandbox();
    markProject(sb.cwd);
    saveLock(sb.cwd, { version: 1, skills: [] });
    await expect(install()).resolves.not.toThrow();
  });

  it("restores a local-sourced skill from lock alone", async () => {
    sb = createSandbox();
    markProject(sb.cwd);
    const sourceDir = path.join(sb.base, "src-skill");
    writeSkillFixture(sourceDir, "lock-restored");
    saveLock(sb.cwd, {
      version: 1,
      skills: [
        {
          id: "lock-restored",
          source: { type: "local", url: sourceDir },
          ref: null,
        },
      ],
    });

    await install();

    const reg = loadRegistry();
    expect(reg.skills["lock-restored"]).toBeDefined();
    expect(reg.skills["lock-restored"].name).toBe("lock-restored");

    const store = path.join(skillsStore(), "lock-restored");
    const link = path.join(sb.cwd, ".claude/skills/lock-restored");
    expect(isOurSymlink(link, store)).toBe(true);
  });

  it("skips a local-sourced entry whose source path no longer exists", async () => {
    sb = createSandbox();
    markProject(sb.cwd);
    saveLock(sb.cwd, {
      version: 1,
      skills: [
        {
          id: "ghost",
          source: { type: "local", url: "/definitely/not/real/anywhere" },
          ref: null,
        },
      ],
    });

    await install();
    const reg = loadRegistry();
    expect(reg.skills["ghost"]).toBeUndefined();
    expect(
      fs.existsSync(path.join(sb.cwd, ".claude/skills/ghost")),
    ).toBe(false);
  });
});
