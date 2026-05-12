import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { scan } from "../../src/commands/scan.js";
import { loadRegistry } from "../../src/lib/registry.js";
import { skillsStore } from "../../src/lib/paths.js";
import {
  createSandbox,
  markProject,
  writeSkillFixture,
  type Sandbox,
} from "../helpers/sandbox.js";

// Drive scan non-interactively by stubbing the picker to auto-select every
// candidate. The picker itself is TTY-only and not unit-tested here — its
// behavior must be smoke-tested by running `mechanic scan` interactively.
vi.mock("../../src/lib/skill-picker.js", () => ({
  skillPicker: async ({ items }: { items: Array<{ value: number }> }) =>
    items.map((c) => c.value),
}));

let sb: Sandbox;
afterEach(() => sb?.cleanup());

describe("scan with explicit dir", () => {
  it("finds skills nested several levels deep", async () => {
    sb = createSandbox();
    const repo = path.join(sb.base, "repo");
    writeSkillFixture(path.join(repo, "packages", "thing", ".claude", "skills", "deep"), "deep");

    await scan({ dir: repo });

    const reg = loadRegistry();
    expect(Object.keys(reg.skills)).toContain("deep");
    expect(reg.skills["deep"].source.type).toBe("local");
  });

  it("does not descend into a directory that is itself a skill", async () => {
    sb = createSandbox();
    const repo = path.join(sb.base, "repo");
    const outer = path.join(repo, "outer");
    writeSkillFixture(outer, "outer");
    // place a nested SKILL.md inside the outer skill — should be ignored
    writeSkillFixture(path.join(outer, "inner"), "inner");

    await scan({ dir: repo });

    const reg = loadRegistry();
    expect(reg.skills["outer"]).toBeDefined();
    expect(reg.skills["inner"]).toBeUndefined();
  });

  it("adoption copies the skill into the store and leaves the source untouched", async () => {
    sb = createSandbox();
    const source = path.join(sb.base, "src-tree", "my-skill");
    writeSkillFixture(source, "my-skill");
    const originalSkillMd = fs.readFileSync(path.join(source, "SKILL.md"), "utf8");

    await scan({ dir: path.dirname(source) });

    const store = path.join(skillsStore(), "my-skill");
    // store is a real directory containing a copy, not a symlink
    expect(fs.lstatSync(store).isDirectory()).toBe(true);
    expect(fs.lstatSync(store).isSymbolicLink()).toBe(false);
    expect(fs.readFileSync(path.join(store, "SKILL.md"), "utf8")).toBe(
      originalSkillMd,
    );
    // source must still be a real directory, untouched
    expect(fs.lstatSync(source).isDirectory()).toBe(true);
    expect(fs.lstatSync(source).isSymbolicLink()).toBe(false);
    expect(fs.readFileSync(path.join(source, "SKILL.md"), "utf8")).toBe(
      originalSkillMd,
    );
    // registry source.url points back at the original
    expect(loadRegistry().skills["my-skill"].source.url).toBe(source);
  });

  it("project-scope adoption does not mutate the scope dir or write the lock", async () => {
    sb = createSandbox();
    markProject(sb.cwd);
    const scopeSkillDir = path.join(sb.cwd, ".claude", "skills", "proj-skill");
    writeSkillFixture(scopeSkillDir, "proj-skill");

    await scan({});

    // adoption registered the skill and copied it
    expect(loadRegistry().skills["proj-skill"]).toBeDefined();
    expect(fs.lstatSync(path.join(skillsStore(), "proj-skill")).isDirectory()).toBe(true);
    // the scope dir is still a real, untouched directory
    expect(fs.lstatSync(scopeSkillDir).isDirectory()).toBe(true);
    expect(fs.lstatSync(scopeSkillDir).isSymbolicLink()).toBe(false);
    // scan is adoption-only: it does NOT write the project lock
    expect(fs.existsSync(path.join(sb.cwd, "mechanic.lock"))).toBe(false);
  });

  it("disambiguates duplicate proposed ids as id, id-2, id-3", async () => {
    sb = createSandbox();
    const repo = path.join(sb.base, "repo");
    writeSkillFixture(path.join(repo, "a", "shared"), "shared");
    writeSkillFixture(path.join(repo, "b", "shared"), "shared");
    writeSkillFixture(path.join(repo, "c", "shared"), "shared");

    await scan({ dir: repo });

    const ids = Object.keys(loadRegistry().skills).sort();
    expect(ids).toEqual(["shared", "shared-2", "shared-3"]);
  });
});
