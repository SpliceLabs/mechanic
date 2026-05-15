import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  createSandbox,
  writeSkillFixture,
  type Sandbox,
} from "../helpers/sandbox.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(HERE, "../../dist/index.js");

let sb: Sandbox;
afterEach(() => sb?.cleanup());

function run(
  args: string[],
  opts: { input?: string } = {},
): { status: number | null; stdout: string; stderr: string } {
  const res = spawnSync(process.execPath, [CLI, ...args], {
    env: { ...process.env, HOME: sb.home, NO_COLOR: "1" },
    cwd: sb.cwd,
    encoding: "utf8",
    input: opts.input,
  });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

describe("CLI integration", () => {
  it("prints help", () => {
    sb = createSandbox();
    const { status, stdout } = run(["--help"]);
    expect(status).toBe(0);
    expect(stdout).toContain("mechanic");
    expect(stdout).toContain("skill");
    expect(stdout).toContain("install");
  });

  it("round-trip: add → list → enable user → disable → remove", () => {
    sb = createSandbox();
    const skillDir = path.join(sb.base, "external-skill");
    writeSkillFixture(skillDir, "round-trip-skill");

    const add = run(["skill", "add", skillDir]);
    expect(add.status, add.stderr).toBe(0);
    expect(add.stdout).toMatch(/added.*round-trip-skill/);

    const list1 = run(["skill", "list"]);
    expect(list1.stdout).toContain("round-trip-skill");
    expect(list1.stdout).toMatch(/off\s+off/);

    const enable = run(["skill", "enable", "round-trip-skill", "--scope", "user"]);
    expect(enable.status, enable.stderr).toBe(0);
    const link = path.join(sb.home, ".claude/skills/round-trip-skill");
    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);

    const list2 = run(["skill", "list"]);
    expect(list2.stdout).toMatch(/on\s+\s*off/);

    const disable = run(["skill", "disable", "round-trip-skill", "--scope", "user"]);
    expect(disable.status, disable.stderr).toBe(0);
    expect(fs.existsSync(link)).toBe(false);

    const remove = run(["skill", "remove", "round-trip-skill"]);
    expect(remove.status, remove.stderr).toBe(0);
    const list3 = run(["skill", "list"]);
    expect(list3.stdout).toContain("No skills registered");
  });

  it("project scope: creates .mechanic.json, mechanic.lock, and .gitignore", () => {
    sb = createSandbox();
    const skillDir = path.join(sb.base, "proj-skill");
    writeSkillFixture(skillDir, "proj-skill");

    expect(run(["skill", "add", skillDir]).status).toBe(0);
    const enable = run(["skill", "enable", "proj-skill", "--scope", "project"]);
    expect(enable.status, enable.stderr).toBe(0);

    expect(fs.existsSync(path.join(sb.cwd, ".mechanic.json"))).toBe(true);
    const gi = fs.readFileSync(path.join(sb.cwd, ".gitignore"), "utf8");
    expect(gi).toContain(".claude/skills/");
    const lock = JSON.parse(
      fs.readFileSync(path.join(sb.cwd, "mechanic.lock"), "utf8"),
    );
    expect(lock.skills.map((s: { id: string }) => s.id)).toContain(
      "proj-skill",
    );

    const disable = run(["skill", "disable", "proj-skill", "--scope", "project"]);
    expect(disable.status).toBe(0);
    const lockAfter = JSON.parse(
      fs.readFileSync(path.join(sb.cwd, "mechanic.lock"), "utf8"),
    );
    expect(lockAfter.skills).toHaveLength(0);
  });

  it("exits non-zero on unknown skill id", () => {
    sb = createSandbox();
    const { status, stderr } = run(["skill", "info", "missing-skill"]);
    expect(status).not.toBe(0);
    expect(stderr + "").toMatch(/missing-skill|Unknown/);
  });

  it("info reports a registered skill", () => {
    sb = createSandbox();
    const skillDir = path.join(sb.base, "info-skill");
    writeSkillFixture(skillDir, "info-skill", { description: "documented" });
    run(["skill", "add", skillDir]);
    const { status, stdout } = run(["skill", "info", "info-skill"]);
    expect(status).toBe(0);
    expect(stdout).toContain("info-skill");
    expect(stdout).toContain("local");
  });
});
