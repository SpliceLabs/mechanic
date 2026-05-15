import { describe, it, expect } from "vitest";
import path from "node:path";
import { parseSource, sanitizeSubpath } from "../../src/lib/source-parser.js";

describe("parseSource — local paths", () => {
  it("resolves absolute path", () => {
    const r = parseSource("/tmp/foo");
    expect(r.type).toBe("local");
    expect(r.url).toBe(path.resolve("/tmp/foo"));
    expect(r.localPath).toBe(r.url);
  });

  it("resolves dot-relative path", () => {
    const r = parseSource("./foo");
    expect(r.type).toBe("local");
    expect(r.url).toBe(path.resolve("./foo"));
  });
});

describe("parseSource — github", () => {
  it("parses owner/repo shorthand", () => {
    expect(parseSource("vercel-labs/agent-skills")).toEqual({
      type: "github",
      url: "https://github.com/vercel-labs/agent-skills.git",
    });
  });

  it("parses owner/repo/subpath shorthand", () => {
    expect(parseSource("owner/repo/skills/web")).toEqual({
      type: "github",
      url: "https://github.com/owner/repo.git",
      subpath: "skills/web",
    });
  });

  it("parses owner/repo@skill filter", () => {
    expect(parseSource("owner/repo@my-skill")).toEqual({
      type: "github",
      url: "https://github.com/owner/repo.git",
      skillFilter: "my-skill",
    });
  });

  it("parses github URL with tree/ref/path", () => {
    expect(
      parseSource("https://github.com/owner/repo/tree/main/path/to/skill"),
    ).toEqual({
      type: "github",
      url: "https://github.com/owner/repo.git",
      ref: "main",
      subpath: "path/to/skill",
    });
  });

  it("parses github URL with branch only", () => {
    expect(parseSource("https://github.com/owner/repo/tree/main")).toEqual({
      type: "github",
      url: "https://github.com/owner/repo.git",
      ref: "main",
    });
  });

  it("parses plain github URL", () => {
    expect(parseSource("https://github.com/owner/repo")).toEqual({
      type: "github",
      url: "https://github.com/owner/repo.git",
    });
  });

  it("strips .git suffix", () => {
    expect(parseSource("https://github.com/owner/repo.git")).toEqual({
      type: "github",
      url: "https://github.com/owner/repo.git",
    });
  });

  it("parses shorthand with #ref fragment", () => {
    expect(parseSource("owner/repo#feature/x")).toEqual({
      type: "github",
      url: "https://github.com/owner/repo.git",
      ref: "feature/x",
    });
  });

  it("parses github: prefix", () => {
    expect(parseSource("github:owner/repo")).toEqual({
      type: "github",
      url: "https://github.com/owner/repo.git",
    });
  });

  it("ignores blob anchors as refs", () => {
    expect(
      parseSource("https://github.com/owner/repo/blob/main/README.md#L10"),
    ).toEqual({
      type: "github",
      url: "https://github.com/owner/repo.git",
    });
  });
});

describe("parseSource — gitlab", () => {
  it("parses gitlab.com plain URL", () => {
    expect(parseSource("https://gitlab.com/owner/repo")).toEqual({
      type: "gitlab",
      url: "https://gitlab.com/owner/repo.git",
    });
  });

  it("parses gitlab tree URL with subpath", () => {
    expect(
      parseSource("https://gitlab.com/group/sub/repo/-/tree/main/src"),
    ).toEqual({
      type: "gitlab",
      url: "https://gitlab.com/group/sub/repo.git",
      ref: "main",
      subpath: "src",
    });
  });

  it("parses custom gitlab domain tree URL", () => {
    expect(
      parseSource("https://git.corp.com/group/subgroup/project/-/tree/main/src"),
    ).toEqual({
      type: "gitlab",
      url: "https://git.corp.com/group/subgroup/project.git",
      ref: "main",
      subpath: "src",
    });
  });

  it("parses gitlab: prefix", () => {
    expect(parseSource("gitlab:owner/repo")).toEqual({
      type: "gitlab",
      url: "https://gitlab.com/owner/repo.git",
    });
  });
});

describe("parseSource — generic git", () => {
  it("treats custom domain .git URL as generic git", () => {
    expect(parseSource("https://git.example.com/group/repo.git")).toEqual({
      type: "git",
      url: "https://git.example.com/group/repo.git",
    });
  });

  it("preserves SSH URL with #ref", () => {
    expect(parseSource("git@github.com:owner/repo.git#feature/x")).toEqual({
      type: "git",
      url: "git@github.com:owner/repo.git",
      ref: "feature/x",
    });
  });
});

describe("sanitizeSubpath", () => {
  it("rejects .. traversal", () => {
    expect(() => sanitizeSubpath("foo/../etc")).toThrow(/traversal/);
  });

  it("allows normal subpaths", () => {
    expect(sanitizeSubpath("skills/web")).toBe("skills/web");
  });
});
