import { describe, it, expect, afterEach } from "vitest";
import { loadRegistry, saveRegistry } from "../../src/lib/registry.js";
import { createSandbox, type Sandbox } from "../helpers/sandbox.js";

let sb: Sandbox;
afterEach(() => sb?.cleanup());

describe("registry", () => {
  it("returns an empty registry when no file exists", () => {
    sb = createSandbox();
    const reg = loadRegistry();
    expect(reg).toEqual({ version: 1, skills: {} });
  });

  it("round-trips skills through save/load", () => {
    sb = createSandbox();
    const reg = loadRegistry();
    reg.skills["foo"] = {
      name: "foo",
      source: { type: "git", url: "https://example.com/foo.git" },
      ref: "abc123",
      installedAt: "2026-05-12T00:00:00.000Z",
    };
    saveRegistry(reg);
    const loaded = loadRegistry();
    expect(loaded).toEqual(reg);
  });

  it("ensures the mechanic home directory on save", () => {
    sb = createSandbox();
    const reg = loadRegistry();
    saveRegistry(reg);
    // implicit: no throw means directory creation succeeded
    const again = loadRegistry();
    expect(again.version).toBe(1);
  });
});
