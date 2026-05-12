import { spawnSync } from "node:child_process";

export function gitClone(
  url: string,
  dest: string,
  opts: { shallow?: boolean } = {},
): void {
  const args = ["clone"];
  if (opts.shallow !== false) args.push("--depth", "1");
  args.push(url, dest);
  const res = spawnSync("git", args, { stdio: "inherit" });
  if (res.status !== 0) throw new Error(`git clone failed for ${url}`);
}

export function gitCheckout(dir: string, ref: string): void {
  const res = spawnSync("git", ["-C", dir, "checkout", ref], {
    stdio: "inherit",
  });
  if (res.status !== 0) throw new Error(`git checkout ${ref} failed in ${dir}`);
}

export function gitPull(dir: string): void {
  const res = spawnSync("git", ["-C", dir, "pull", "--ff-only"], {
    stdio: "inherit",
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
