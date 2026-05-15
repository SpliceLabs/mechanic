import { describe, it, expect } from "vitest";
import { stripTerminalEscapes, sanitizeMetadata } from "../../src/lib/sanitize.js";

describe("stripTerminalEscapes", () => {
  it("strips CSI color codes", () => {
    expect(stripTerminalEscapes("\x1b[31mred\x1b[0m")).toBe("red");
  });

  it("strips OSC window title", () => {
    expect(stripTerminalEscapes("\x1b]0;evil\x07text")).toBe("text");
  });

  it("strips OSC terminated by ST", () => {
    expect(stripTerminalEscapes("\x1b]8;;url\x1b\\link")).toBe("link");
  });

  it("strips simple ESC sequences", () => {
    expect(stripTerminalEscapes("\x1b7save")).toBe("save");
  });

  it("strips C1 control codes", () => {
    expect(stripTerminalEscapes("a\x9bb")).toBe("ab");
  });

  it("strips bare control chars but keeps tab/newline", () => {
    expect(stripTerminalEscapes("a\x07b\tc\nd")).toBe("ab\tc\nd");
  });
});

describe("sanitizeMetadata", () => {
  it("collapses newlines and trims", () => {
    expect(sanitizeMetadata("  hello\nworld  ")).toBe("hello world");
  });

  it("strips escapes from metadata", () => {
    expect(sanitizeMetadata("\x1b[31mname\x1b[0m\n")).toBe("name");
  });
});
