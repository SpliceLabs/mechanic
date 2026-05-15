#!/usr/bin/env node
import { Command } from "commander";
import { createRequire } from "node:module";
import pc from "picocolors";
import { add } from "./commands/add.js";
import { list } from "./commands/list.js";
import { info } from "./commands/info.js";
import { enable } from "./commands/enable.js";
import { disable } from "./commands/disable.js";
import { remove } from "./commands/remove.js";
import { update } from "./commands/update.js";
import { scan } from "./commands/scan.js";
import { init } from "./commands/init.js";
import { install } from "./commands/install.js";
import { doctor } from "./commands/doctor.js";
import { newSkill } from "./commands/new.js";
import { find } from "./commands/find.js";
import * as hooks from "./commands/hooks/index.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

const program = new Command();

program
  .name("mechanic")
  .description("Skill registry + scope manager for Claude Code")
  .version(pkg.version);

const skill = program
  .command("skill")
  .description("Manage individual skills (add, enable, update, …)");

skill
  .command("add")
  .description("Register a skill from a git URL or local path")
  .argument("<source>", "git URL or local path")
  .action(add);

skill
  .command("list")
  .alias("ls")
  .description("List registered skills and active scopes")
  .action(list);

skill
  .command("info")
  .description("Show details for a registered skill")
  .argument("<id>")
  .action(info);

skill
  .command("enable")
  .description("Activate a skill in a scope")
  .argument("<id>")
  .option("-s, --scope <scope>", "user | project")
  .option("--replace", "If a real directory occupies the scope path, remove it first")
  .action(enable);

skill
  .command("disable")
  .description("Deactivate a skill in a scope")
  .argument("<id>")
  .option("-s, --scope <scope>", "user | project")
  .action(disable);

skill
  .command("remove")
  .alias("rm")
  .description("Unregister and delete a skill")
  .argument("<id>")
  .action(remove);

skill
  .command("update")
  .description("Pull updates for git-sourced skills")
  .argument("[id]")
  .option("-a, --all", "Update every git-sourced skill")
  .action((id: string | undefined, opts: { all?: boolean }) =>
    update(id, opts),
  );

skill
  .command("find")
  .description(
    "Browse a repo (remote or local) for SKILL.md files and pick which to register",
  )
  .argument("<source>", "git URL, GitHub shorthand, or local path")
  .action(find);

skill
  .command("scan")
  .description(
    "Find unmanaged skills and adopt them. Without args scans user + project " +
      "scopes; with a path, recursively walks that directory.",
  )
  .argument(
    "[dir]",
    "directory to scan instead of user/project scopes (read-only adoption)",
  )
  .option("-v, --verbose", "Log every path inspected and why it was kept or skipped")
  .action((dir: string | undefined, opts: { verbose?: boolean }) =>
    scan({ dir, verbose: opts.verbose }),
  );

skill
  .command("new")
  .description("Scaffold a SKILL.md template in ./<name>/")
  .argument("<name>", "skill name (kebab-case)")
  .action(newSkill);

// ---------------------------------------------------------------------------
// `mechanic hooks <verb>` — Claude Code hook configurations.
// Scaffolded surface only; the underlying commands throw "not yet implemented".
// Shape mirrors `mechanic skill <verb>` so the eventual implementation can
// reuse the same registry/scope/lock primitives.
// ---------------------------------------------------------------------------

const hook = program
  .command("hooks")
  .description("Manage Claude Code hook configurations (scaffold — not yet implemented)");

hook
  .command("add")
  .description("Register a hook from a git URL or local path")
  .argument("<source>", "git URL or local path")
  .action(hooks.add);

hook
  .command("list")
  .alias("ls")
  .description("List registered hooks and active scopes")
  .action(hooks.list);

hook
  .command("info")
  .description("Show details for a registered hook")
  .argument("<id>")
  .action(hooks.info);

hook
  .command("enable")
  .description("Activate a hook in a scope")
  .argument("<id>")
  .option("-s, --scope <scope>", "user | project")
  .option("--replace", "If a real entry occupies the scope path, remove it first")
  .action(hooks.enable);

hook
  .command("disable")
  .description("Deactivate a hook in a scope")
  .argument("<id>")
  .option("-s, --scope <scope>", "user | project")
  .action(hooks.disable);

hook
  .command("remove")
  .alias("rm")
  .description("Unregister and delete a hook")
  .argument("<id>")
  .action(hooks.remove);

hook
  .command("update")
  .description("Pull updates for git-sourced hooks")
  .argument("[id]")
  .option("-a, --all", "Update every git-sourced hook")
  .action((id: string | undefined, opts: { all?: boolean }) =>
    hooks.update(id, opts),
  );

hook
  .command("find")
  .description("Browse a repo for hook configurations and pick which to register")
  .argument("<source>", "git URL, GitHub shorthand, or local path")
  .action(hooks.find);

hook
  .command("scan")
  .description(
    "Find unmanaged hooks and adopt them. Without args scans user + project " +
      "scopes; with a path, recursively walks that directory.",
  )
  .argument("[dir]", "directory to scan instead of user/project scopes")
  .option("-v, --verbose", "Log every path inspected and why it was kept or skipped")
  .action((dir: string | undefined, opts: { verbose?: boolean }) =>
    hooks.scan({ dir, verbose: opts.verbose }),
  );

hook
  .command("new")
  .description("Scaffold a hook template in ./<name>/")
  .argument("<name>", "hook name (kebab-case)")
  .action(hooks.newHook);

program
  .command("init")
  .description("Mark current directory as a mechanic project")
  .action(init);

program
  .command("install")
  .description("Apply mechanic.lock — register and enable each pinned skill")
  .action(install);

program
  .command("doctor")
  .description("Diagnose broken symlinks, orphan store dirs, stale registry")
  .option("--fix", "Remove broken/orphan artifacts and stale registry entries")
  .action(doctor);

program.parseAsync(process.argv).catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(pc.red(msg));
  process.exit(1);
});
