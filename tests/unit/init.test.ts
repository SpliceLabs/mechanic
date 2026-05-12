import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { init } from "../../src/commands/init.js";
import {
  createSandbox,
  markProject,
  type Sandbox,
} from "../helpers/sandbox.js";

let sb: Sandbox;
afterEach(() => sb?.cleanup());

describe("init", () => {
  it("creates .mechanic.json and ensures .gitignore", async () => {
    sb = createSandbox();
    await init();
    expect(fs.existsSync(path.join(sb.cwd, ".mechanic.json"))).toBe(true);
    expect(
      fs.readFileSync(path.join(sb.cwd, ".gitignore"), "utf8"),
    ).toContain(".claude/skills/");
  });

  it("is idempotent — no duplicate .gitignore entry", async () => {
    sb = createSandbox();
    await init();
    await init();
    const gi = fs.readFileSync(path.join(sb.cwd, ".gitignore"), "utf8");
    expect(gi.match(/\.claude\/skills\//g)?.length).toBe(1);
  });

  it("refuses to nest under an existing project", async () => {
    sb = createSandbox();
    markProject(sb.cwd);
    const nested = path.join(sb.cwd, "nested");
    fs.mkdirSync(nested);
    process.chdir(nested);
    await init();
    expect(fs.existsSync(path.join(nested, ".mechanic.json"))).toBe(false);
  });
});
