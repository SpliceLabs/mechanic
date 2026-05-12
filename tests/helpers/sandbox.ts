import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface Sandbox {
  base: string;
  home: string;
  cwd: string;
  cleanup: () => void;
}

/**
 * Creates a temp HOME + cwd, mutates process.env.HOME and process.cwd().
 * Vitest is configured with pool=forks so env mutation is isolated per file.
 */
export function createSandbox(): Sandbox {
  // Use realpath so values match what os.homedir() / process.cwd() return
  // (macOS resolves /var/folders -> /private/var/folders).
  const base = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "mechanic-test-")),
  );
  const home = path.join(base, "home");
  const cwd = path.join(base, "cwd");
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(cwd, { recursive: true });

  const prevHome = process.env.HOME;
  const prevCwd = process.cwd();
  process.env.HOME = home;
  process.chdir(cwd);

  return {
    base,
    home,
    cwd,
    cleanup: () => {
      try {
        process.chdir(prevCwd);
      } catch {
        /* prev cwd may have been deleted by another test */
      }
      if (prevHome === undefined) delete process.env.HOME;
      else process.env.HOME = prevHome;
      fs.rmSync(base, { recursive: true, force: true });
    },
  };
}

export interface SkillFixtureOpts {
  description?: string;
  extraFrontmatter?: string;
  body?: string;
  /** If true, omit the SKILL.md entirely. */
  noSkillMd?: boolean;
  /** If true, write SKILL.md without frontmatter. */
  noFrontmatter?: boolean;
  /** If true, omit the `name:` field. */
  noName?: boolean;
}

export function writeSkillFixture(
  dir: string,
  name: string,
  opts: SkillFixtureOpts = {},
): string {
  fs.mkdirSync(dir, { recursive: true });
  if (opts.noSkillMd) return dir;

  const body = opts.body ?? `# ${name}\n\nFixture skill.`;
  if (opts.noFrontmatter) {
    fs.writeFileSync(path.join(dir, "SKILL.md"), body);
    return dir;
  }

  const lines = ["---"];
  if (!opts.noName) lines.push(`name: ${name}`);
  if (opts.description) lines.push(`description: ${opts.description}`);
  if (opts.extraFrontmatter) lines.push(opts.extraFrontmatter);
  lines.push("---", "", body);
  fs.writeFileSync(path.join(dir, "SKILL.md"), lines.join("\n") + "\n");
  return dir;
}

export function markProject(cwd: string): void {
  fs.writeFileSync(
    path.join(cwd, ".mechanic.json"),
    JSON.stringify({ version: 1 }, null, 2) + "\n",
  );
}
