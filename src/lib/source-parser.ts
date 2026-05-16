import path from "node:path";
import { builtinSkillPath } from "./builtins.js";

export type ParsedSourceType = "github" | "gitlab" | "git" | "local";

export interface ParsedSource {
  type: ParsedSourceType;
  /** Canonical URL for git operations, or resolved absolute path for local. */
  url: string;
  /** Subdirectory within the repo that contains the skill. */
  subpath?: string;
  /** Resolved absolute path (local sources only). */
  localPath?: string;
  /** Branch, tag, or commit ref. */
  ref?: string;
  /** Skill name from `owner/repo@skill-name` or `#ref@skill-name` syntax. */
  skillFilter?: string;
}

function isLocalPath(input: string): boolean {
  return (
    path.isAbsolute(input) ||
    input.startsWith("./") ||
    input.startsWith("../") ||
    input === "." ||
    input === ".." ||
    /^[a-zA-Z]:[/\\]/.test(input)
  );
}

export function sanitizeSubpath(subpath: string): string {
  const normalized = subpath.replace(/\\/g, "/");
  for (const segment of normalized.split("/")) {
    if (segment === "..") {
      throw new Error(
        `Unsafe subpath: "${subpath}" contains path traversal segments`,
      );
    }
  }
  return subpath;
}

interface FragmentRefResult {
  inputWithoutFragment: string;
  ref?: string;
  skillFilter?: string;
}

function decodeFragment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function looksLikeGitSource(input: string): boolean {
  if (
    input.startsWith("github:") ||
    input.startsWith("gitlab:") ||
    input.startsWith("git@")
  ) {
    return true;
  }
  if (input.startsWith("http://") || input.startsWith("https://")) {
    try {
      const parsed = new URL(input);
      const pathname = parsed.pathname;
      if (parsed.hostname === "github.com") {
        return /^\/[^/]+\/[^/]+(?:\.git)?(?:\/tree\/[^/]+(?:\/.*)?)?\/?$/.test(
          pathname,
        );
      }
      if (parsed.hostname === "gitlab.com") {
        return /^\/.+?\/[^/]+(?:\.git)?(?:\/-\/tree\/[^/]+(?:\/.*)?)?\/?$/.test(
          pathname,
        );
      }
    } catch {
      // fall through
    }
  }
  if (/^https?:\/\/.+\.git(?:$|[/?])/i.test(input)) return true;
  return (
    !input.includes(":") &&
    !input.startsWith(".") &&
    !input.startsWith("/") &&
    /^([^/]+)\/([^/]+)(?:\/(.+)|@(.+))?$/.test(input)
  );
}

function parseFragmentRef(input: string): FragmentRefResult {
  const hashIndex = input.indexOf("#");
  if (hashIndex < 0) return { inputWithoutFragment: input };

  const inputWithoutFragment = input.slice(0, hashIndex);
  const fragment = input.slice(hashIndex + 1);

  if (!fragment || !looksLikeGitSource(inputWithoutFragment)) {
    return { inputWithoutFragment: input };
  }

  const atIndex = fragment.indexOf("@");
  if (atIndex === -1) {
    return { inputWithoutFragment, ref: decodeFragment(fragment) };
  }
  const ref = fragment.slice(0, atIndex);
  const skillFilter = fragment.slice(atIndex + 1);
  return {
    inputWithoutFragment,
    ref: ref ? decodeFragment(ref) : undefined,
    skillFilter: skillFilter ? decodeFragment(skillFilter) : undefined,
  };
}

function appendFragment(
  input: string,
  ref?: string,
  skillFilter?: string,
): string {
  if (!ref) return input;
  return `${input}#${ref}${skillFilter ? `@${skillFilter}` : ""}`;
}

export function parseSource(input: string): ParsedSource {
  if (input.startsWith("builtin:")) {
    const name = input.slice("builtin:".length);
    // builtinSkillPath validates the name and verifies the bundled skill exists,
    // throwing a helpful "Available: ..." error if not.
    const resolved = builtinSkillPath(name);
    return { type: "local", url: resolved, localPath: resolved };
  }

  if (isLocalPath(input)) {
    // Local bare repo (path ending in .git) is still cloneable as a git source.
    if (/\.git\/?$/.test(input)) {
      return { type: "git", url: path.resolve(input) };
    }
    const resolved = path.resolve(input);
    return { type: "local", url: resolved, localPath: resolved };
  }

  const {
    inputWithoutFragment,
    ref: fragmentRef,
    skillFilter: fragmentSkillFilter,
  } = parseFragmentRef(input);
  input = inputWithoutFragment;

  const githubPrefixMatch = input.match(/^github:(.+)$/);
  if (githubPrefixMatch) {
    return parseSource(
      appendFragment(githubPrefixMatch[1]!, fragmentRef, fragmentSkillFilter),
    );
  }

  const gitlabPrefixMatch = input.match(/^gitlab:(.+)$/);
  if (gitlabPrefixMatch) {
    return parseSource(
      appendFragment(
        `https://gitlab.com/${gitlabPrefixMatch[1]!}`,
        fragmentRef,
        fragmentSkillFilter,
      ),
    );
  }

  // GitHub URL with tree path: .../tree/<ref>/<subpath>
  const githubTreeWithPath = input.match(
    /github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)/,
  );
  if (githubTreeWithPath) {
    const [, owner, repo, ref, subpath] = githubTreeWithPath;
    return {
      type: "github",
      url: `https://github.com/${owner}/${repo}.git`,
      ref: ref || fragmentRef,
      ...(subpath ? { subpath: sanitizeSubpath(subpath) } : {}),
      ...(fragmentSkillFilter ? { skillFilter: fragmentSkillFilter } : {}),
    };
  }

  // GitHub URL with branch only
  const githubTree = input.match(
    /github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)$/,
  );
  if (githubTree) {
    const [, owner, repo, ref] = githubTree;
    return {
      type: "github",
      url: `https://github.com/${owner}/${repo}.git`,
      ref: ref || fragmentRef,
      ...(fragmentSkillFilter ? { skillFilter: fragmentSkillFilter } : {}),
    };
  }

  // GitHub plain repo URL
  const githubRepo = input.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (githubRepo) {
    const [, owner, repo] = githubRepo;
    const cleanRepo = repo!.replace(/\.git$/, "");
    return {
      type: "github",
      url: `https://github.com/${owner}/${cleanRepo}.git`,
      ...(fragmentRef ? { ref: fragmentRef } : {}),
      ...(fragmentSkillFilter ? { skillFilter: fragmentSkillFilter } : {}),
    };
  }

  // GitLab tree URL with subpath (any GitLab instance)
  const gitlabTreeWithPath = input.match(
    /^(https?):\/\/([^/]+)\/(.+?)\/-\/tree\/([^/]+)\/(.+)/,
  );
  if (gitlabTreeWithPath) {
    const [, protocol, hostname, repoPath, ref, subpath] = gitlabTreeWithPath;
    if (hostname !== "github.com" && repoPath) {
      return {
        type: "gitlab",
        url: `${protocol}://${hostname}/${repoPath.replace(/\.git$/, "")}.git`,
        ref: ref || fragmentRef,
        ...(subpath ? { subpath: sanitizeSubpath(subpath) } : {}),
        ...(fragmentSkillFilter ? { skillFilter: fragmentSkillFilter } : {}),
      };
    }
  }

  // GitLab tree URL with branch only
  const gitlabTree = input.match(
    /^(https?):\/\/([^/]+)\/(.+?)\/-\/tree\/([^/]+)$/,
  );
  if (gitlabTree) {
    const [, protocol, hostname, repoPath, ref] = gitlabTree;
    if (hostname !== "github.com" && repoPath) {
      return {
        type: "gitlab",
        url: `${protocol}://${hostname}/${repoPath.replace(/\.git$/, "")}.git`,
        ref: ref || fragmentRef,
      };
    }
  }

  // gitlab.com repo URL (supports subgroups)
  const gitlabRepo = input.match(/gitlab\.com\/(.+?)(?:\.git)?\/?$/);
  if (gitlabRepo) {
    const repoPath = gitlabRepo[1]!;
    if (repoPath.includes("/")) {
      return {
        type: "gitlab",
        url: `https://gitlab.com/${repoPath}.git`,
        ...(fragmentRef ? { ref: fragmentRef } : {}),
      };
    }
  }

  // Shorthand owner/repo@skill
  const atSkill = input.match(/^([^/]+)\/([^/@]+)@(.+)$/);
  if (
    atSkill &&
    !input.includes(":") &&
    !input.startsWith(".") &&
    !input.startsWith("/")
  ) {
    const [, owner, repo, skillFilter] = atSkill;
    return {
      type: "github",
      url: `https://github.com/${owner}/${repo}.git`,
      ...(fragmentRef ? { ref: fragmentRef } : {}),
      skillFilter: fragmentSkillFilter || skillFilter,
    };
  }

  // Shorthand owner/repo or owner/repo/subpath
  const shorthand = input.match(/^([^/]+)\/([^/]+)(?:\/(.+?))?\/?$/);
  if (
    shorthand &&
    !input.includes(":") &&
    !input.startsWith(".") &&
    !input.startsWith("/")
  ) {
    const [, owner, repo, subpath] = shorthand;
    return {
      type: "github",
      url: `https://github.com/${owner}/${repo}.git`,
      ...(fragmentRef ? { ref: fragmentRef } : {}),
      ...(subpath ? { subpath: sanitizeSubpath(subpath) } : {}),
      ...(fragmentSkillFilter ? { skillFilter: fragmentSkillFilter } : {}),
    };
  }

  // Fallback: direct git URL (e.g. git@github.com:owner/repo.git, https://*.git)
  return {
    type: "git",
    url: input,
    ...(fragmentRef ? { ref: fragmentRef } : {}),
    ...(fragmentSkillFilter ? { skillFilter: fragmentSkillFilter } : {}),
  };
}
