import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import {
  findProjectRoot,
  skillsStore,
  ensureMechanicHome,
} from "../lib/paths.js";
import { loadLock } from "../lib/lock.js";
import {
  loadRegistry,
  saveRegistry,
  type SkillEntry,
} from "../lib/registry.js";
import { gitClone, gitCheckout, gitHeadSha } from "../lib/git.js";
import { readSkillFrontmatter, selectSkillFromClone } from "../lib/skill.js";
import { makeSymlink } from "../lib/symlink.js";
import { ensureGitignore } from "../lib/gitignore.js";

export async function install(): Promise<void> {
  const root = findProjectRoot();
  if (!root) {
    throw new Error(
      "Not inside a mechanic project. Run `mechanic init` first.",
    );
  }
  ensureMechanicHome();

  const lock = loadLock(root);
  if (lock.skills.length === 0) {
    console.log(pc.dim("mechanic.lock is empty. Nothing to install."));
    return;
  }

  const reg = loadRegistry();

  for (const entry of lock.skills) {
    const store = path.join(skillsStore(), entry.id);
    let regEntry: SkillEntry | undefined = reg.skills[entry.id];

    if (!regEntry) {
      if (entry.source.type === "git") {
        let resolvedRef: string | null = entry.ref ?? null;
        if (!fs.existsSync(store)) {
          if (entry.source.subpath) {
            const tmp = path.join(skillsStore(), `.tmp-install-${entry.id}-${Date.now()}`);
            try {
              gitClone(entry.source.url, tmp, {
                shallow: !entry.ref,
                ref: entry.source.ref,
              });
              if (entry.ref) gitCheckout(tmp, entry.ref);
              const picked = selectSkillFromClone(tmp, {
                subpath: entry.source.subpath,
              });
              if (!resolvedRef) resolvedRef = gitHeadSha(tmp);
              fs.cpSync(picked.dir, store, { recursive: true });
            } finally {
              fs.rmSync(tmp, { recursive: true, force: true });
            }
          } else {
            gitClone(entry.source.url, store, {
              shallow: !entry.ref,
              ref: entry.source.ref,
            });
            if (entry.ref) gitCheckout(store, entry.ref);
            if (!resolvedRef) resolvedRef = gitHeadSha(store);
          }
        }
        const fm = readSkillFrontmatter(store);
        regEntry = {
          name: fm.name,
          source: entry.source,
          ref: resolvedRef,
          installedAt: new Date().toISOString(),
        };
      } else {
        if (!fs.existsSync(entry.source.url)) {
          console.log(
            pc.red(
              `skip ${entry.id}: local source missing (${entry.source.url})`,
            ),
          );
          continue;
        }
        if (!fs.existsSync(store)) {
          fs.symlinkSync(entry.source.url, store);
        }
        const fm = readSkillFrontmatter(store);
        regEntry = {
          name: fm.name,
          source: entry.source,
          ref: null,
          installedAt: new Date().toISOString(),
        };
      }
      reg.skills[entry.id] = regEntry;
    }

    const link = path.join(root, ".claude/skills", regEntry.name);
    makeSymlink(store, link);
    console.log(
      `${pc.green("✓ installed")} ${pc.bold(entry.id)} ${pc.dim(`(${regEntry.name})`)}`,
    );
  }

  saveRegistry(reg);
  ensureGitignore(root);
}
