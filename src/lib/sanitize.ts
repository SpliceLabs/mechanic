/**
 * Strip terminal escape sequences and dangerous control chars from untrusted
 * strings (SKILL.md frontmatter, remote names/descriptions) before printing.
 * Defends against CWE-150 (terminal escape injection).
 */

// CSI: ESC[ params intermediates final
const CSI_RE = /\x1b\[[\x30-\x3f]*[\x20-\x2f]*[\x40-\x7e]/g;
// OSC: ESC] ... BEL | ESC\
const OSC_RE = /\x1b\][\s\S]*?(?:\x07|\x1b\\)/g;
// DCS / PM / APC
const DCS_PM_APC_RE = /\x1b[P^_][\s\S]*?(?:\x1b\\)/g;
// Simple ESC <char>
const SIMPLE_ESC_RE = /\x1b[\x20-\x7e]/g;
// C1 control codes (0x80-0x9F)
const C1_RE = /[\x80-\x9f]/g;
// Raw control chars except \t and \n
const CONTROL_RE = /[\x00-\x06\x07\x08\x0b\x0c\x0d-\x1a\x1c-\x1f\x7f]/g;

export function stripTerminalEscapes(s: string): string {
  return s
    .replace(OSC_RE, "")
    .replace(DCS_PM_APC_RE, "")
    .replace(CSI_RE, "")
    .replace(SIMPLE_ESC_RE, "")
    .replace(C1_RE, "")
    .replace(CONTROL_RE, "");
}

/**
 * Sanitize skill metadata for single-line terminal display. Strips escapes,
 * collapses newlines to spaces, and trims.
 */
export function sanitizeMetadata(s: string): string {
  return stripTerminalEscapes(s).replace(/[\r\n]+/g, " ").trim();
}
