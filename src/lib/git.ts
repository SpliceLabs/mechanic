import { spawnSync } from "node:child_process";

export function gitClone(url: string, dest: string): void {
  const res = spawnSync("git", ["clone", "--depth", "1", url, dest], {
    stdio: "inherit",
  });
  if (res.status !== 0) throw new Error(`git clone failed for ${url}`);
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
