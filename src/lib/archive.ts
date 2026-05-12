import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";

/**
 * Extract a `.skill` zip archive into `destDir`. Accepts either layout:
 * - SKILL.md at the zip root, or
 * - A single top-level directory holding SKILL.md (unwrapped on extract).
 *
 * Throws if no SKILL.md is found, or if the archive contains entries that
 * would escape `destDir` (zip-slip guard).
 */
export function extractSkillArchive(zipPath: string, destDir: string): void {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  if (entries.length === 0) throw new Error(`Empty archive: ${zipPath}`);

  // Find SKILL.md and figure out the prefix to strip.
  const skillEntry = entries.find((e) => {
    const name = e.entryName.replace(/\\/g, "/");
    const parts = name.split("/").filter(Boolean);
    return (
      !e.isDirectory &&
      (parts.length === 1 || parts.length === 2) &&
      parts[parts.length - 1] === "SKILL.md"
    );
  });
  if (!skillEntry) {
    throw new Error(`No SKILL.md found at archive root or one level deep: ${zipPath}`);
  }
  const skillName = skillEntry.entryName.replace(/\\/g, "/");
  const skillParts = skillName.split("/").filter(Boolean);
  const stripPrefix = skillParts.length === 2 ? skillParts[0] + "/" : "";

  fs.mkdirSync(destDir, { recursive: true });
  const destRoot = path.resolve(destDir);

  for (const e of entries) {
    let rel = e.entryName.replace(/\\/g, "/");
    if (stripPrefix) {
      if (rel === stripPrefix.slice(0, -1)) continue; // the wrapper dir itself
      if (!rel.startsWith(stripPrefix)) continue; // unrelated junk
      rel = rel.slice(stripPrefix.length);
    }
    if (!rel || rel.endsWith("/")) {
      if (rel) fs.mkdirSync(path.join(destRoot, rel), { recursive: true });
      continue;
    }
    const outPath = path.resolve(destRoot, rel);
    if (!outPath.startsWith(destRoot + path.sep) && outPath !== destRoot) {
      throw new Error(`Unsafe path in archive: ${e.entryName}`);
    }
    if (e.isDirectory) {
      fs.mkdirSync(outPath, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, e.getData());
  }
}

export function isSkillArchive(p: string): boolean {
  return p.toLowerCase().endsWith(".skill");
}
