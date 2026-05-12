import { describe, it, expect, afterEach } from "vitest";
import {
  loadLock,
  upsertLock,
  removeLock,
} from "../../src/lib/lock.js";
import { createSandbox, type Sandbox } from "../helpers/sandbox.js";

let sb: Sandbox;
afterEach(() => sb?.cleanup());

describe("lock", () => {
  it("returns empty lock when file absent", () => {
    sb = createSandbox();
    const lock = loadLock(sb.cwd);
    expect(lock).toEqual({ version: 1, skills: [] });
  });

  it("upsert adds an entry", () => {
    sb = createSandbox();
    upsertLock(sb.cwd, {
      id: "alpha",
      source: { type: "git", url: "https://example.com/a.git" },
      ref: "sha-a",
    });
    expect(loadLock(sb.cwd).skills).toHaveLength(1);
  });

  it("upsert replaces existing entry with same id", () => {
    sb = createSandbox();
    upsertLock(sb.cwd, {
      id: "alpha",
      source: { type: "git", url: "https://example.com/a.git" },
      ref: "sha-a",
    });
    upsertLock(sb.cwd, {
      id: "alpha",
      source: { type: "git", url: "https://example.com/a.git" },
      ref: "sha-b",
    });
    const lock = loadLock(sb.cwd);
    expect(lock.skills).toHaveLength(1);
    expect(lock.skills[0].ref).toBe("sha-b");
  });

  it("keeps entries sorted by id (deterministic diffs)", () => {
    sb = createSandbox();
    upsertLock(sb.cwd, {
      id: "zebra",
      source: { type: "local", url: "/tmp/z" },
      ref: null,
    });
    upsertLock(sb.cwd, {
      id: "alpha",
      source: { type: "local", url: "/tmp/a" },
      ref: null,
    });
    upsertLock(sb.cwd, {
      id: "mike",
      source: { type: "local", url: "/tmp/m" },
      ref: null,
    });
    expect(loadLock(sb.cwd).skills.map((s) => s.id)).toEqual([
      "alpha",
      "mike",
      "zebra",
    ]);
  });

  it("remove drops an entry by id", () => {
    sb = createSandbox();
    upsertLock(sb.cwd, {
      id: "alpha",
      source: { type: "local", url: "/tmp/a" },
      ref: null,
    });
    upsertLock(sb.cwd, {
      id: "beta",
      source: { type: "local", url: "/tmp/b" },
      ref: null,
    });
    removeLock(sb.cwd, "alpha");
    const lock = loadLock(sb.cwd);
    expect(lock.skills.map((s) => s.id)).toEqual(["beta"]);
  });
});
