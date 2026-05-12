import fs from "node:fs";
import path from "node:path";

function lstatOrNull(p: string): fs.Stats | null {
  try {
    return fs.lstatSync(p);
  } catch {
    return null;
  }
}

export function isOurSymlink(linkPath: string, expectedTarget: string): boolean {
  const stat = lstatOrNull(linkPath);
  if (!stat || !stat.isSymbolicLink()) return false;
  const actual = fs.readlinkSync(linkPath);
  return path.resolve(actual) === path.resolve(expectedTarget);
}

export function makeSymlink(target: string, linkPath: string): void {
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  const existing = lstatOrNull(linkPath);
  if (existing) {
    if (existing.isSymbolicLink()) {
      const actual = fs.readlinkSync(linkPath);
      if (path.resolve(actual) === path.resolve(target)) return;
      throw new Error(
        `${linkPath} is a symlink pointing elsewhere (${actual}). Refusing to clobber.`,
      );
    }
    throw new Error(
      `${linkPath} exists and is not a symlink. Refusing to clobber.`,
    );
  }
  fs.symlinkSync(target, linkPath);
}

export function safeUnlink(linkPath: string, expectedTarget: string): boolean {
  if (!isOurSymlink(linkPath, expectedTarget)) return false;
  fs.unlinkSync(linkPath);
  return true;
}
