import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { newSkill } from "../../src/commands/new.js";
import { readSkillFrontmatter } from "../../src/lib/skill.js";
import { createSandbox, type Sandbox } from "../helpers/sandbox.js";

let sb: Sandbox;
afterEach(() => sb?.cleanup());

describe("new", () => {
  it("scaffolds a SKILL.md with frontmatter that parses cleanly", async () => {
    sb = createSandbox();
    await newSkill("My New Skill");
    const dir = path.join(sb.cwd, "my-new-skill");
    expect(fs.existsSync(path.join(dir, "SKILL.md"))).toBe(true);
    const fm = readSkillFrontmatter(dir);
    expect(fm.name).toBe("my-new-skill");
    expect(typeof fm.description).toBe("string");
  });

  it("refuses to overwrite an existing directory", async () => {
    sb = createSandbox();
    fs.mkdirSync(path.join(sb.cwd, "already-here"));
    await expect(newSkill("already-here")).rejects.toThrow(/Refusing/);
  });

  it("rejects an empty / invalid name", async () => {
    sb = createSandbox();
    await expect(newSkill("!!!")).rejects.toThrow(/Invalid skill name/);
  });
});
