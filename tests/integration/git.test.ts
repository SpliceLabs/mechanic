import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  createSandbox,
  markProject,
  type Sandbox,
} from "../helpers/sandbox.js";
import { createBareSkillRepo } from "../helpers/git-fixture.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(HERE, "../../dist/index.js");

let sb: Sandbox;
afterEach(() => sb?.cleanup());

function run(args: string[]) {
  const res = spawnSync(process.execPath, [CLI, ...args], {
    env: { ...process.env, HOME: sb.home, NO_COLOR: "1" },
    cwd: sb.cwd,
    encoding: "utf8",
  });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

function readRegistry() {
  const p = path.join(sb.home, ".mechanic", "registry.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function shaAt(dir: string): string {
  const res = spawnSync("git", ["-C", dir, "rev-parse", "HEAD"], {
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`rev-parse failed in ${dir}`);
  return res.stdout.trim();
}

describe("git-sourced skills", () => {
  it("add clones from a git URL and records HEAD sha", () => {
    sb = createSandbox();
    const repo = createBareSkillRepo(sb.base, "git-skill");

    const out = run(["skill", "add", repo.remote]);
    expect(out.status, out.stderr).toBe(0);
    expect(out.stdout).toMatch(/added.*git-skill/);

    const reg = readRegistry();
    expect(reg.skills["git-skill"].source).toEqual({
      type: "git",
      url: repo.remote,
    });
    expect(reg.skills["git-skill"].ref).toBe(repo.head());
  });

  it("update fast-forwards a git-sourced skill to the remote HEAD", () => {
    sb = createSandbox();
    const repo = createBareSkillRepo(sb.base, "evolve");
    expect(run(["skill", "add", repo.remote]).status).toBe(0);

    const initialSha = readRegistry().skills["evolve"].ref;
    const newSha = repo.pushCommit("second commit");
    expect(newSha).not.toBe(initialSha);

    const out = run(["skill", "update", "evolve"]);
    expect(out.status, out.stderr).toBe(0);
    expect(out.stdout).toMatch(/updated.*evolve/);

    expect(readRegistry().skills["evolve"].ref).toBe(newSha);
  });

  it("install with a pinned ref checks out that ref (not remote HEAD)", () => {
    sb = createSandbox();
    const repo = createBareSkillRepo(sb.base, "pinned");
    const pinSha = repo.head();
    const newerSha = repo.pushCommit("after-pin");
    expect(newerSha).not.toBe(pinSha);

    markProject(sb.cwd);
    fs.writeFileSync(
      path.join(sb.cwd, "mechanic.lock"),
      JSON.stringify(
        {
          version: 1,
          skills: [
            {
              id: "pinned",
              source: { type: "git", url: repo.remote },
              ref: pinSha,
            },
          ],
        },
        null,
        2,
      ),
    );

    const out = run(["install"]);
    expect(out.status, out.stderr).toBe(0);

    const storeDir = path.join(sb.home, ".mechanic", "skills", "pinned");
    expect(shaAt(storeDir)).toBe(pinSha);
  });
});
