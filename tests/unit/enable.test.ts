import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { enable } from "../../src/commands/enable.js";
import {
  loadRegistry,
  saveRegistry,
} from "../../src/lib/registry.js";
import {
  skillsStore,
  ensureMechanicHome,
} from "../../src/lib/paths.js";
import { isOurSymlink } from "../../src/lib/symlink.js";
import {
  createSandbox,
  markProject,
  type Sandbox,
} from "../helpers/sandbox.js";

let sb: Sandbox;
afterEach(() => sb?.cleanup());

function seedStoreSkill(id: string, name: string = id): string {
  ensureMechanicHome();
  const store = path.join(skillsStore(), id);
  fs.mkdirSync(store, { recursive: true });
  fs.writeFileSync(
    path.join(store, "SKILL.md"),
    `---\nname: ${name}\n---\nbody\n`,
  );
  const reg = loadRegistry();
  reg.skills[id] = {
    name,
    source: { type: "local", url: "/somewhere/else" },
    ref: null,
    installedAt: "2026-05-12T00:00:00.000Z",
  };
  saveRegistry(reg);
  return store;
}

describe("enable --replace", () => {
  it("refuses when a real directory occupies the scope path", async () => {
    sb = createSandbox();
    markProject(sb.cwd);
    seedStoreSkill("occupy");

    const occupied = path.join(sb.cwd, ".claude", "skills", "occupy");
    fs.mkdirSync(occupied, { recursive: true });
    fs.writeFileSync(path.join(occupied, "marker"), "old");

    await expect(enable("occupy", { scope: "project" })).rejects.toThrow(
      /--replace/,
    );
    // the dir must not have been touched
    expect(fs.lstatSync(occupied).isDirectory()).toBe(true);
    expect(fs.lstatSync(occupied).isSymbolicLink()).toBe(false);
  });

  it("with --replace, removes the real dir and installs the symlink", async () => {
    sb = createSandbox();
    markProject(sb.cwd);
    const store = seedStoreSkill("occupy");

    const occupied = path.join(sb.cwd, ".claude", "skills", "occupy");
    fs.mkdirSync(occupied, { recursive: true });
    fs.writeFileSync(path.join(occupied, "marker"), "old");

    await enable("occupy", { scope: "project", replace: true });

    expect(isOurSymlink(occupied, store)).toBe(true);
    // the lock was written as part of project-scope enable
    const lock = JSON.parse(
      fs.readFileSync(path.join(sb.cwd, "mechanic.lock"), "utf8"),
    );
    expect(lock.skills.map((s: { id: string }) => s.id)).toContain("occupy");
  });
});
