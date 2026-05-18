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

    await find(repo, { all: true });

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

    await find(repo, { all: true });

    const ids = Object.keys(loadRegistry().skills).sort();
    expect(ids).toEqual(["shared", "shared-2"]);
  });

  it("errors out when path does not exist", async () => {
    sb = createSandbox();
    await expect(
      find(path.join(sb.base, "missing"), { all: true }),
    ).rejects.toThrow(/Path not found/);
  });

  it("refuses to run interactively when stdin is not a TTY", async () => {
    sb = createSandbox();
    const repo = path.join(sb.base, "repo");
    writeSkillFixture(path.join(repo, "skills", "alpha"), "alpha");
    await expect(find(repo)).rejects.toThrow(/--json.*--all/);
  });

  it("--json emits discovery metadata without registering anything", async () => {
    sb = createSandbox();
    const repo = path.join(sb.base, "repo");
    writeSkillFixture(path.join(repo, "skills", "alpha"), "alpha");
    writeSkillFixture(path.join(repo, "skills", "beta"), "beta");

    const writes: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    try {
      await find(repo, { json: true });
    } finally {
      process.stdout.write = origWrite;
    }

    const out = JSON.parse(writes.join(""));
    expect(Array.isArray(out)).toBe(true);
    expect(out.map((e: { proposedId: string }) => e.proposedId).sort()).toEqual([
      "alpha",
      "beta",
    ]);
    for (const e of out) {
      expect(e).toHaveProperty("subpath");
      expect(e).toHaveProperty("alreadyRegistered", false);
    }
    expect(Object.keys(loadRegistry().skills)).toEqual([]);
  });
});
