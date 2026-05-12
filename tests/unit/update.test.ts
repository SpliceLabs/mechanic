import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { update } from "../../src/commands/update.js";
import {
  loadRegistry,
  saveRegistry,
} from "../../src/lib/registry.js";
import {
  skillsStore,
  ensureMechanicHome,
} from "../../src/lib/paths.js";
import {
  createSandbox,
  writeSkillFixture,
  type Sandbox,
} from "../helpers/sandbox.js";

let sb: Sandbox;
afterEach(() => sb?.cleanup());

function registerLocal(id: string, sourceUrl: string): void {
  const reg = loadRegistry();
  reg.skills[id] = {
    name: id,
    source: { type: "local", url: sourceUrl },
    ref: null,
    installedAt: "2026-05-12T00:00:00.000Z",
  };
  saveRegistry(reg);
}

describe("update for local sources", () => {
  it("re-copies a copied local source from its origin", async () => {
    sb = createSandbox();
    ensureMechanicHome();
    const source = path.join(sb.base, "src-tree", "evolve");
    writeSkillFixture(source, "evolve");

    const store = path.join(skillsStore(), "evolve");
    fs.cpSync(source, store, { recursive: true });
    registerLocal("evolve", source);

    // mutate source after adoption
    fs.writeFileSync(path.join(source, "new-file"), "fresh");

    await update("evolve", {});

    expect(fs.existsSync(path.join(store, "new-file"))).toBe(true);
  });

  it("skips a local source whose store entry is itself a symlink (add semantics)", async () => {
    sb = createSandbox();
    ensureMechanicHome();
    const source = path.join(sb.base, "src-tree", "linked");
    writeSkillFixture(source, "linked");

    const store = path.join(skillsStore(), "linked");
    fs.symlinkSync(source, store);
    registerLocal("linked", source);

    await expect(update("linked", {})).resolves.not.toThrow();
    // store still a symlink, unchanged
    expect(fs.lstatSync(store).isSymbolicLink()).toBe(true);
    expect(fs.readlinkSync(store)).toBe(source);
  });

  it("skips when the source path no longer exists", async () => {
    sb = createSandbox();
    ensureMechanicHome();
    const store = path.join(skillsStore(), "ghost");
    fs.mkdirSync(store, { recursive: true });
    fs.writeFileSync(path.join(store, "SKILL.md"), "---\nname: ghost\n---\n");
    registerLocal("ghost", "/definitely/not/real/anywhere");

    await expect(update("ghost", {})).resolves.not.toThrow();
    // store still present and untouched
    expect(fs.existsSync(path.join(store, "SKILL.md"))).toBe(true);
  });
});
