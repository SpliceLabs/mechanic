import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import {
  readSkillFrontmatter,
  slugify,
} from "../../src/lib/skill.js";
import {
  createSandbox,
  writeSkillFixture,
  type Sandbox,
} from "../helpers/sandbox.js";

let sb: Sandbox;
afterEach(() => sb?.cleanup());

describe("readSkillFrontmatter", () => {
  it("parses a valid SKILL.md", () => {
    sb = createSandbox();
    const dir = path.join(sb.base, "skill");
    writeSkillFixture(dir, "my-skill", { description: "hello" });
    const fm = readSkillFrontmatter(dir);
    expect(fm.name).toBe("my-skill");
    expect(fm.description).toBe("hello");
  });

  it("throws when SKILL.md is missing", () => {
    sb = createSandbox();
    const dir = path.join(sb.base, "skill");
    writeSkillFixture(dir, "x", { noSkillMd: true });
    expect(() => readSkillFrontmatter(dir)).toThrow(/No SKILL\.md/);
  });

  it("throws when frontmatter block is absent", () => {
    sb = createSandbox();
    const dir = path.join(sb.base, "skill");
    writeSkillFixture(dir, "x", { noFrontmatter: true });
    expect(() => readSkillFrontmatter(dir)).toThrow(/No YAML frontmatter/);
  });

  it("throws when `name` field is missing", () => {
    sb = createSandbox();
    const dir = path.join(sb.base, "skill");
    writeSkillFixture(dir, "x", { noName: true, description: "anon" });
    expect(() => readSkillFrontmatter(dir)).toThrow(/missing 'name'/);
  });
});

describe("slugify", () => {
  it.each([
    ["My Skill", "my-skill"],
    ["foo_bar.baz", "foo-bar-baz"],
    ["  trim me  ", "trim-me"],
    ["CamelCase", "camelcase"],
    ["already-good", "already-good"],
    ["multi   spaces", "multi-spaces"],
  ])("slugify(%j) === %j", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});
