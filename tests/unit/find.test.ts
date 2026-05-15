import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { find } from "../../src/commands/find.js";
import { loadRegistry } from "../../src/lib/registry.js";
import { skillsStore } from "../../src/lib/paths.js";
import {
  createSandbox,
  writeSkillFixture,
  type Sandbox,
} from "../helpers/sandbox.js";

vi.mock("../../src/lib/skill-picker.js", () => ({
  skillPicker: async ({ items }: { items: Array<{ value: number }> }) =>
    items.map((c) => c.value),
}));

let sb: Sandbox;
afterEach(() => sb?.cleanup());

describe("find (local source)", () => {
  it("discovers every SKILL.md and bulk-registers picked skills", async () => {
    sb = createSandbox();
    const repo = path.join(sb.base, "repo");
    writeSkillFixture(path.join(repo, "skills", "alpha"), "alpha");
    writeSkillFixture(path.join(repo, "packages", "beta"), "beta");
    writeSkillFixture(path.join(repo, "deep", "nested", "gamma"), "gamma");

    await find(repo);

    const reg = loadRegistry();
    expect(Object.keys(reg.skills).sort()).toEqual(["alpha", "beta", "gamma"]);

    // local sources are stored as symlinks back to the original skill dir
    for (const id of ["alpha", "beta", "gamma"]) {
      const storeEntry = path.join(skillsStore(), id);
      expect(fs.lstatSync(storeEntry).isSymbolicLink()).toBe(true);
      expect(reg.skills[id].source.type).toBe("local");
    }
  });

  it("disambiguates id collisions across the picked set", async () => {
    sb = createSandbox();
    const repo = path.join(sb.base, "repo");
    writeSkillFixture(path.join(repo, "a", "shared"), "shared");
    writeSkillFixture(path.join(repo, "b", "shared"), "shared");

    await find(repo);

    const ids = Object.keys(loadRegistry().skills).sort();
    expect(ids).toEqual(["shared", "shared-2"]);
  });

  it("errors out when path does not exist", async () => {
    sb = createSandbox();
    await expect(find(path.join(sb.base, "missing"))).rejects.toThrow(
      /Path not found/,
    );
  });
});
