import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import { add } from "../../src/commands/add.js";
import { skillsStore } from "../../src/lib/paths.js";
import { loadRegistry } from "../../src/lib/registry.js";
import { createSandbox, type Sandbox } from "../helpers/sandbox.js";
import { createBareSkillRepo } from "../helpers/git-fixture.js";

let sb: Sandbox;
afterEach(() => sb?.cleanup());

function tmpDirsInStore(): string[] {
  if (!fs.existsSync(skillsStore())) return [];
  return fs
    .readdirSync(skillsStore())
    .filter((e) => e.startsWith(".tmp-"));
}

describe("add cleanup", () => {
  it("leaves no .tmp-* dir behind when the subpath is missing", async () => {
    sb = createSandbox();
    const repo = createBareSkillRepo(sb.base, "cleanup-fixture");

    // The fixture only has a SKILL.md at the root; this subpath doesn't exist.
    // selectSkillFromClone throws after gitClone has already created the tmp
    // dir — pre-fix this would leak the .tmp-clone-* dir into the store.
    await expect(add(`${repo.remote}/does/not/exist`)).rejects.toThrow();

    expect(tmpDirsInStore()).toEqual([]);
    expect(Object.keys(loadRegistry().skills)).toEqual([]);
  });
});
