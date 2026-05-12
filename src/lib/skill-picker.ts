import {
  createPrompt,
  isBackspaceKey,
  isDownKey,
  isEnterKey,
  isSpaceKey,
  isUpKey,
  useKeypress,
  usePagination,
  useState,
} from "@inquirer/core";
import pc from "picocolors";

export interface PickerItem {
  value: number;
  label: string;
  searchKey: string;
}

export interface PickerConfig {
  message: string;
  items: PickerItem[];
  pageSize?: number;
}

// Node readline emits more fields than @inquirer/core's KeypressEvent type
// exposes. We need `sequence` to recognize printable characters.
interface ExtendedKey {
  name: string;
  ctrl: boolean;
  sequence?: string;
  meta?: boolean;
  shift?: boolean;
}

function isPrintable(seq: string | undefined): boolean {
  return !!seq && seq.length === 1 && seq >= " " && seq <= "~";
}

const HELP_IDLE = pc.dim(
  "↑/↓ move · space toggle · type to search · enter confirm · esc quit",
);

const helpSearch = (q: string) =>
  pc.dim(`search: ${q}${pc.bold("_")}   esc cancel · enter confirm`);

export const skillPicker = createPrompt<number[], PickerConfig>(
  (config, done) => {
    const [query, setQuery] = useState<string>("");
    const [searching, setSearching] = useState<boolean>(false);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [cursor, setCursor] = useState<number>(0);
    const [status, setStatus] = useState<"idle" | "done" | "quit">("idle");

    const lowerQuery = query.toLowerCase();
    const filtered = query
      ? config.items.filter((i) =>
          i.searchKey.toLowerCase().includes(lowerQuery),
        )
      : config.items;

    const activeIndex = Math.min(cursor, Math.max(0, filtered.length - 1));

    function toggleAtCursor(): void {
      const item = filtered[activeIndex];
      if (!item) return;
      const next = new Set(selected);
      if (next.has(item.value)) next.delete(item.value);
      else next.add(item.value);
      setSelected(next);
    }

    function clampCursor(n: number): number {
      return Math.max(0, Math.min(Math.max(0, filtered.length - 1), n));
    }

    useKeypress((rawKey) => {
      if (status !== "idle") return;
      const key = rawKey as ExtendedKey;
      const seq = key.sequence;

      if (searching) {
        if (key.name === "escape") {
          setSearching(false);
          setQuery("");
          setCursor(0);
          return;
        }
        if (isEnterKey(key)) {
          setStatus("done");
          done(Array.from(selected));
          return;
        }
        if (isBackspaceKey(key)) {
          setQuery(query.slice(0, -1));
          setCursor(0);
          return;
        }
        if (isUpKey(key)) {
          setCursor(clampCursor(cursor - 1));
          return;
        }
        if (isDownKey(key)) {
          setCursor(clampCursor(cursor + 1));
          return;
        }
        if (isSpaceKey(key)) {
          toggleAtCursor();
          return;
        }
        if (isPrintable(seq) && !key.ctrl && !key.meta) {
          setQuery(query + seq);
          setCursor(0);
        }
        return;
      }

      // idle (non-search)
      if (key.name === "escape") {
        setStatus("quit");
        done([]);
        return;
      }
      if (isEnterKey(key)) {
        setStatus("done");
        done(Array.from(selected));
        return;
      }
      if (isSpaceKey(key)) {
        toggleAtCursor();
        return;
      }
      if (isUpKey(key)) {
        setCursor(clampCursor(cursor - 1));
        return;
      }
      if (isDownKey(key)) {
        setCursor(clampCursor(cursor + 1));
        return;
      }
      if (isPrintable(seq) && !key.ctrl && !key.meta) {
        setSearching(true);
        setQuery(seq!.toLowerCase());
        setCursor(0);
      }
    });

    if (status === "done") {
      return `${config.message} ${pc.dim(`(${selected.size} selected)`)}`;
    }
    if (status === "quit") {
      return `${config.message} ${pc.dim("(quit)")}`;
    }

    const body =
      filtered.length === 0
        ? pc.dim("  (no matches)")
        : usePagination({
            items: filtered,
            active: activeIndex,
            renderItem: ({ item, isActive }) => {
              const mark = selected.has(item.value) ? pc.green("[x]") : "[ ]";
              const ptr = isActive ? pc.cyan(">") : " ";
              return `${ptr} ${mark} ${item.label}`;
            },
            pageSize: config.pageSize ?? 12,
            loop: false,
          });

    const counts =
      filtered.length === config.items.length
        ? `${config.items.length} items`
        : `${filtered.length} of ${config.items.length}`;
    const header = `${config.message} ${pc.dim(`(${counts}, ${selected.size} selected)`)}`;
    const help = searching ? helpSearch(query) : HELP_IDLE;

    return `${header}\n${body}\n${help}`;
  },
);
