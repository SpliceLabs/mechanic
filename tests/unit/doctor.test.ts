import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { doctor } from "../../src/commands/doctor.js";
import {
  loadRegistry,
  saveRegistry,
} from "../../src/lib/registry.js";
import {
  skillsStore,
  userClaude,
  ensureMechanicHome,
} from "../../src/lib/paths.js";
import {
  createSandbox,
  type Sandbox,
} from "../helpers/sandbox.js";

let sb: Sandbox;
afterEach(() => sb?.cleanup());

function seedRegistryEntry(id: string, name: string): string {
  ensureMechanicHome();
  const store = path.join(skillsStore(), id);
  fs.mkdirSync(store, { recursive: true });
  const reg = loadRegistry();
  reg.skills[id] = {
    name,
    source: { type: "local", url: store },
    ref: null,
    installedAt: new Date().toISOString(),
  };
  saveRegistry(reg);
  return store;
}

function symlinkInScope(scopeDir: string, name: string, target: string): string {
  const dir = path.join(scopeDir, "skills");
  fs.mkdirSync(dir, { recursive: true });
  const link = path.join(dir, name);
  fs.symlinkSync(target, link);
  return link;
}

describe("doctor", () => {
  it("reports healthy when registry, store and links agree", async () => {
    sb = createSandbox();
    const store = seedRegistryEntry("clean", "clean");
    symlinkInScope(userClaude(), "clean", store);
    await expect(doctor({})).resolves.not.toThrow();
  });

  it("detects a broken symlink (target gone) and fixes it", async () => {
    sb = createSandbox();
    const store = seedRegistryEntry("vanish", "vanish");
    const link = symlinkInScope(userClaude(), "vanish", store);
    fs.rmSync(store, { recursive: true, force: true });

    await doctor({ fix: true });
    expect(fs.existsSync(link)).toBe(false);
    // missing-store fix should also drop the registry entry
    expect(loadRegistry().skills["vanish"]).toBeUndefined();
  });

  it("detects and removes a symlink to an unregistered store id", async () => {
    sb = createSandbox();
    ensureMechanicHome();
    const orphanStore = path.join(skillsStore(), "wild");
    fs.mkdirSync(orphanStore, { recursive: true });
    const link = symlinkInScope(userClaude(), "wild", orphanStore);

    await doctor({ fix: true });
    // both the symlink and orphan store dir get cleaned
    expect(fs.existsSync(link)).toBe(false);
    expect(fs.existsSync(orphanStore)).toBe(false);
  });

  it("does not modify state without --fix", async () => {
    sb = createSandbox();
    const store = seedRegistryEntry("dryrun", "dryrun");
    const link = symlinkInScope(userClaude(), "dryrun", store);
    fs.rmSync(store, { recursive: true, force: true });

    await doctor({});
    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
    expect(loadRegistry().skills["dryrun"]).toBeDefined();
  });

  it("ignores foreign (non-mechanic) symlinks in scope dirs", async () => {
    sb = createSandbox();
    const foreignTarget = path.join(sb.base, "elsewhere");
    fs.mkdirSync(foreignTarget);
    const link = symlinkInScope(userClaude(), "foreign", foreignTarget);

    await doctor({ fix: true });
    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
  });
});
