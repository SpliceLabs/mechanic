import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  isOurSymlink,
  makeSymlink,
  safeUnlink,
} from "../../src/lib/symlink.js";
import { createSandbox, type Sandbox } from "../helpers/sandbox.js";

let sb: Sandbox;
afterEach(() => sb?.cleanup());

describe("isOurSymlink", () => {
  it("returns true when link points at expected target", () => {
    sb = createSandbox();
    const target = path.join(sb.base, "real");
    const link = path.join(sb.base, "link");
    fs.mkdirSync(target);
    fs.symlinkSync(target, link);
    expect(isOurSymlink(link, target)).toBe(true);
  });

  it("returns false when path is a regular directory", () => {
    sb = createSandbox();
    const real = path.join(sb.base, "real");
    fs.mkdirSync(real);
    expect(isOurSymlink(real, real)).toBe(false);
  });

  it("returns false when symlink points elsewhere", () => {
    sb = createSandbox();
    const a = path.join(sb.base, "a");
    const b = path.join(sb.base, "b");
    const link = path.join(sb.base, "link");
    fs.mkdirSync(a);
    fs.mkdirSync(b);
    fs.symlinkSync(a, link);
    expect(isOurSymlink(link, b)).toBe(false);
  });

  it("returns false when path does not exist", () => {
    sb = createSandbox();
    expect(isOurSymlink(path.join(sb.base, "nope"), sb.base)).toBe(false);
  });
});

describe("makeSymlink", () => {
  it("creates a symlink and parent dirs", () => {
    sb = createSandbox();
    const target = path.join(sb.base, "real");
    const link = path.join(sb.base, "deep", "nest", "link");
    fs.mkdirSync(target);
    makeSymlink(target, link);
    expect(isOurSymlink(link, target)).toBe(true);
  });

  it("is idempotent when same link already exists", () => {
    sb = createSandbox();
    const target = path.join(sb.base, "real");
    const link = path.join(sb.base, "link");
    fs.mkdirSync(target);
    makeSymlink(target, link);
    expect(() => makeSymlink(target, link)).not.toThrow();
  });

  it("throws when symlink points to a different target", () => {
    sb = createSandbox();
    const a = path.join(sb.base, "a");
    const b = path.join(sb.base, "b");
    const link = path.join(sb.base, "link");
    fs.mkdirSync(a);
    fs.mkdirSync(b);
    makeSymlink(a, link);
    expect(() => makeSymlink(b, link)).toThrow(/pointing elsewhere/);
  });

  it("refuses to clobber a real file or dir", () => {
    sb = createSandbox();
    const real = path.join(sb.base, "real");
    const obstacle = path.join(sb.base, "obstacle");
    fs.mkdirSync(real);
    fs.mkdirSync(obstacle);
    expect(() => makeSymlink(real, obstacle)).toThrow(/not a symlink/);
  });
});

describe("safeUnlink", () => {
  it("removes a symlink that points to the expected target", () => {
    sb = createSandbox();
    const target = path.join(sb.base, "real");
    const link = path.join(sb.base, "link");
    fs.mkdirSync(target);
    fs.symlinkSync(target, link);
    expect(safeUnlink(link, target)).toBe(true);
    expect(fs.existsSync(link)).toBe(false);
  });

  it("refuses to remove a symlink pointing elsewhere (safety)", () => {
    sb = createSandbox();
    const a = path.join(sb.base, "a");
    const b = path.join(sb.base, "b");
    const link = path.join(sb.base, "link");
    fs.mkdirSync(a);
    fs.mkdirSync(b);
    fs.symlinkSync(a, link);
    expect(safeUnlink(link, b)).toBe(false);
    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
  });

  it("refuses to remove a real directory", () => {
    sb = createSandbox();
    const real = path.join(sb.base, "real");
    fs.mkdirSync(real);
    expect(safeUnlink(real, real)).toBe(false);
    expect(fs.existsSync(real)).toBe(true);
  });

  it("returns false on missing path", () => {
    sb = createSandbox();
    expect(safeUnlink(path.join(sb.base, "nope"), sb.base)).toBe(false);
  });
});
