import type { FsEntry } from "../types";

export interface StatusBarController {
  element: HTMLElement;
  update(entries: FsEntry[], partitionSize: number, selectedCount: number): void;
  setDevice(name: string, part: number, size: number): void;
}

function calcTotalSize(entries: FsEntry[]): number {
  let total = 0;
  for (const entry of entries) {
    if (entry.kind === "file") {
      total += entry.size;
    }
  }
  return total;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function createStatusBar(): StatusBarController {
  const el = document.createElement("div");
  el.className = "status-bar";

  const left = document.createElement("span");
  left.className = "status-bar-left";

  const center = document.createElement("span");
  center.className = "status-bar-center";

  const right = document.createElement("span");
  right.className = "status-bar-right";

  el.appendChild(left);
  el.appendChild(center);
  el.appendChild(right);

  let currentPartSize = 0;

  return {
    element: el,
    setDevice(name, part, size) {
      currentPartSize = size;
      left.textContent = part ? `${name} @ 0x${part.toString(16)} (${formatSize(size)})` : "";
    },
    update(entries, _partitionSize, selectedCount) {
      const count = entries.length;
      const selText = selectedCount > 0 ? ` (${selectedCount} selected)` : "";
      center.textContent = `${count} item${count !== 1 ? "s" : ""}${selText}`;

      if (currentPartSize > 0) {
        const used = calcTotalSize(entries);
        const pct = Math.min(100, (used / currentPartSize) * 100);
        right.innerHTML = `<span class="status-fill-bar"><span class="status-fill-bar-inner" style="width:${pct}%"></span></span> ${formatSize(used)}/${formatSize(currentPartSize)}`;
      } else {
        right.innerHTML = "";
      }
    },
  };
}
