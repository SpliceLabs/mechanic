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

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

const program = new Command();

program
  .name("mechanic")
  .description("Skill registry + scope manager for Claude Code")
  .version(pkg.version);

program
  .command("add")
  .description("Register a skill from a git URL or local path")
  .argument("<source>", "git URL or local path")
  .action(add);

program
  .command("list")
  .alias("ls")
  .description("List registered skills and active scopes")
  .action(list);

program
  .command("info")
  .description("Show details for a registered skill")
  .argument("<id>")
  .action(info);

program
  .command("enable")
  .description("Activate a skill in a scope")
  .argument("<id>")
  .option("-s, --scope <scope>", "user | project")
  .action(enable);

program
  .command("disable")
  .description("Deactivate a skill in a scope")
  .argument("<id>")
  .option("-s, --scope <scope>", "user | project")
  .action(disable);

program
  .command("remove")
  .alias("rm")
  .description("Unregister and delete a skill")
  .argument("<id>")
  .action(remove);

program
  .command("update")
  .description("Pull updates for git-sourced skills")
  .argument("[id]")
  .option("-a, --all", "Update every git-sourced skill")
  .action((id: string | undefined, opts: { all?: boolean }) =>
    update(id, opts),
  );

program
  .command("scan")
  .description("Find unmanaged skills in scope dirs and adopt them")
  .action(scan);

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
