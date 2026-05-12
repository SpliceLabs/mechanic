import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { writeSkillFixture } from "./sandbox.js";

function git(cwd: string, args: string[]): string {
  const res = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Mechanic Test",
      GIT_AUTHOR_EMAIL: "test@mechanic.local",
      GIT_COMMITTER_NAME: "Mechanic Test",
      GIT_COMMITTER_EMAIL: "test@mechanic.local",
    },
  });
  if (res.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed (cwd=${cwd}):\n${res.stderr || res.stdout}`,
    );
  }
  return res.stdout.trim();
}

export interface GitFixture {
  /** Bare repo path — pass this as the URL to `mechanic add` / clone. */
  remote: string;
  /** Working tree where commits are authored. */
  work: string;
  /** Current HEAD sha of the bare repo. */
  head(): string;
  /** Author another commit and push it. Returns the new HEAD sha. */
  pushCommit(message: string, mutate?: (workDir: string) => void): string;
}

/**
 * Stand up a bare git repo containing a single SKILL.md commit so the CLI
 * can clone from it. Everything lives under `base`.
 */
export function createBareSkillRepo(
  base: string,
  skillName: string,
): GitFixture {
  const remote = path.join(base, `${skillName}.git`);
  const work = path.join(base, `${skillName}-work`);
  fs.mkdirSync(work, { recursive: true });

  writeSkillFixture(work, skillName, { description: "git fixture" });
  git(work, ["init", "-q", "-b", "main"]);
  git(work, ["add", "."]);
  git(work, ["commit", "-q", "-m", "initial"]);

  git(base, ["init", "-q", "--bare", "-b", "main", remote]);
  git(work, ["remote", "add", "origin", remote]);
  git(work, ["push", "-q", "origin", "main"]);

  return {
    remote,
    work,
    head: () => git(remote, ["rev-parse", "HEAD"]),
    pushCommit: (message, mutate) => {
      if (mutate) mutate(work);
      else fs.appendFileSync(path.join(work, "SKILL.md"), `\n<!-- ${message} -->\n`);
      git(work, ["add", "."]);
      git(work, ["commit", "-q", "-m", message]);
      git(work, ["push", "-q", "origin", "main"]);
      return git(work, ["rev-parse", "HEAD"]);
    },
  };
}
