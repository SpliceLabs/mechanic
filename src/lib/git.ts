import { spawnSync } from "node:child_process";

export class GitCloneError extends Error {
  readonly url: string;
  readonly isAuthError: boolean;

  constructor(message: string, url: string, isAuthError = false) {
    super(message);
    this.name = "GitCloneError";
    this.url = url;
    this.isAuthError = isAuthError;
  }
}

const NO_PROMPT_ENV = {
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
  GIT_LFS_SKIP_SMUDGE: "1",
};

const LFS_DISABLE_ARGS = [
  "-c",
  "filter.lfs.required=false",
  "-c",
  "filter.lfs.smudge=",
  "-c",
  "filter.lfs.clean=",
  "-c",
  "filter.lfs.process=",
];

export interface GitCloneOptions {
  shallow?: boolean;
  /** Branch, tag, or ref to check out via `--branch` (requires `shallow`). */
  ref?: string;
}

export function gitClone(
  url: string,
  dest: string,
  opts: GitCloneOptions = {},
): void {
  const args = [...LFS_DISABLE_ARGS, "clone"];
  if (opts.shallow !== false) args.push("--depth", "1");
  if (opts.ref) args.push("--branch", opts.ref);
  args.push(url, dest);
  const res = spawnSync("git", args, { stdio: "inherit", env: NO_PROMPT_ENV });
  if (res.status !== 0) {
    const stderr = typeof res.stderr === "string" ? res.stderr : "";
    const isAuth =
      /Authentication failed|could not read Username|Permission denied|Repository not found/i.test(
        stderr,
      );
    throw new GitCloneError(
      `git clone failed for ${url}${opts.ref ? ` (ref ${opts.ref})` : ""}`,
      url,
      isAuth,
    );
  }
}

export function gitCheckout(dir: string, ref: string): void {
  const res = spawnSync("git", ["-C", dir, "checkout", ref], {
    stdio: "inherit",
    env: NO_PROMPT_ENV,
  });
  if (res.status !== 0) throw new Error(`git checkout ${ref} failed in ${dir}`);
}

export function gitPull(dir: string): void {
  const res = spawnSync("git", ["-C", dir, "pull", "--ff-only"], {
    stdio: "inherit",
    env: NO_PROMPT_ENV,
  });
  if (res.status !== 0) throw new Error(`git pull failed in ${dir}`);
}

export function gitHeadSha(dir: string): string {
  const res = spawnSync("git", ["-C", dir, "rev-parse", "HEAD"], {
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`git rev-parse failed in ${dir}`);
  return res.stdout.trim();
}
