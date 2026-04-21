import type { FsEntry } from "../types";
import { invoke } from "@tauri-apps/api/core";
import { showContextMenu } from "./context-menu";
import { getCurrentWebview } from "@tauri-apps/api/webview";

const ICON_FILE = `<svg viewBox="0 0 16 16" fill="none" stroke="var(--color-icon-file)" stroke-width="1.2">
  <path d="M4 1.5h5.5L12.5 4.5V14a.5.5 0 01-.5.5H4a.5.5 0 01-.5-.5V2a.5.5 0 01.5-.5z"/>
  <path d="M9.5 1.5V5h3.5"/>
</svg>`;

export interface FileBrowserController {
  element: HTMLElement;
  setEntries(entries: FsEntry[], readonly?: boolean): void;
  setLoading(loading: boolean, message?: string): void;
  onAddFiles(handler: (files: FsEntry[]) => void): void;
  onRemoveEntry(handler: (name: string) => void): void;
  onBootableChange(handler: (name: string, bootable: boolean) => void): void;
  getSelectedEntries(): string[];
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function createFileBrowser(): FileBrowserController {
  const el = document.createElement("div");
  el.className = "file-browser";

  let currentEntries: FsEntry[] = [];
  let isReadonly = false;
  let selectedEntries = new Set<string>();
  let addFilesHandler: ((files: FsEntry[]) => void) | null = null;
  let removeEntryHandler: ((name: string) => void) | null = null;
  let bootableChangeHandler: ((name: string, bootable: boolean) => void) | null = null;

  // Column header
  const header = document.createElement("div");
  header.className = "file-list-header";
  header.innerHTML = `<span></span><span>Name</span><span>Size</span><span>Boot</span>`;
  el.appendChild(header);

  // File list container
  const fileList = document.createElement("div");
  fileList.className = "file-list";
  el.appendChild(fileList);

  // Drag and drop via Tauri API (gives real file paths)
  getCurrentWebview().onDragDropEvent(async (event) => {
    const payload = event.payload;
    if (payload.type === "over") {
      fileList.classList.add("file-list--dragover");
    } else if (payload.type === "drop") {
      fileList.classList.remove("file-list--dragover");
      const elfPaths = payload.paths.filter((p) => p.endsWith(".elf"));
      if (!addFilesHandler || !elfPaths.length) return;

      // Get file sizes from backend
      let sizes: number[] = [];
      try {
        sizes = await invoke<number[]>("get_file_sizes", { paths: elfPaths });
      } catch {
        sizes = elfPaths.map(() => 0);
      }

      const entries: FsEntry[] = elfPaths.map((p, i) => {
        const name = p.split("/").pop() || p.split("\\").pop() || p;
        return {
          name,
          kind: "file" as const,
          size: sizes[i] || 0,
          bootable: false,
          localPath: p,
        };
      });
      addFilesHandler(entries);
    } else {
      fileList.classList.remove("file-list--dragover");
    }
  });

  // Context menu on empty space
  fileList.addEventListener("contextmenu", (e) => {
    if ((e.target as HTMLElement).closest(".file-row")) return;
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, [
      {
        label: "Add File...",
        handler: () => {
          if (addFilesHandler) addFilesHandler([]);
        },
      },
    ]);
  });

  // Keyboard
  el.tabIndex = 0;
  el.addEventListener("keydown", (e) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      if (selectedEntries.size > 0 && removeEntryHandler) {
        for (const name of selectedEntries) {
          removeEntryHandler(name);
        }
      }
    }
  });

  function renderFileList() {
    fileList.innerHTML = "";

    if (currentEntries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "file-list-empty";
      empty.textContent = "Drop files here or right-click to add";
      fileList.appendChild(empty);
      return;
    }

    const sorted = [...currentEntries].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    for (const entry of sorted) {
      const row = document.createElement("div");
      row.className = "file-row";
      if (isReadonly) {
        row.classList.add("file-row--readonly");
      }
      if (selectedEntries.has(entry.name)) {
        row.classList.add("file-row--selected");
      }

      const icon = document.createElement("span");
      icon.className = "file-row-icon";
      icon.innerHTML = ICON_FILE;

      const name = document.createElement("span");
      name.className = "file-row-name";
      name.textContent = entry.name;
      if (entry.localPath) {
        name.title = entry.localPath;
      }

      const size = document.createElement("span");
      size.className = "file-row-size";
      size.textContent = formatSize(entry.size);

      const bootCell = document.createElement("span");
      bootCell.className = "file-row-boot";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = entry.bootable === true;
      checkbox.title = "Mark as bootable";
      checkbox.disabled = isReadonly;
      checkbox.addEventListener("click", (e) => {
        e.stopPropagation();
      });
      checkbox.addEventListener("change", () => {
        if (bootableChangeHandler) {
          bootableChangeHandler(entry.name, checkbox.checked);
        }
      });
      bootCell.appendChild(checkbox);

      row.appendChild(icon);
      row.appendChild(name);
      row.appendChild(size);
      row.appendChild(bootCell);

      if (isReadonly) {
        fileList.appendChild(row);
        continue;
      }

      // Click to select
      row.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).tagName === "INPUT") return;
        if (e.metaKey || e.ctrlKey) {
          if (selectedEntries.has(entry.name)) {
            selectedEntries.delete(entry.name);
          } else {
            selectedEntries.add(entry.name);
          }
        } else {
          selectedEntries.clear();
          selectedEntries.add(entry.name);
        }
        renderFileList();
      });

      // Right-click context menu
      row.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectedEntries.clear();
        selectedEntries.add(entry.name);
        renderFileList();

        showContextMenu(e.clientX, e.clientY, [
          {
            label: "Remove",
            danger: true,
            handler: () => {
              if (removeEntryHandler) removeEntryHandler(entry.name);
            },
          },
        ]);
      });

      fileList.appendChild(row);
    }
  }

  return {
    element: el,
    setEntries(entries, readonly = false) {
      currentEntries = entries;
      isReadonly = readonly;
      selectedEntries.clear();
      renderFileList();
    },
    setLoading(loading, message = "Loading filesystem...") {
      if (loading) {
        fileList.innerHTML = `<div class="progress-overlay">
          <div class="progress-bar progress-bar--indeterminate"><div class="progress-bar-fill"></div></div>
          <span>${message}</span>
        </div>`;
      } else {
        renderFileList();
      }
    },
    onAddFiles(handler) { addFilesHandler = handler; },
    onRemoveEntry(handler) { removeEntryHandler = handler; },
    onBootableChange(handler) { bootableChangeHandler = handler; },
    getSelectedEntries() { return [...selectedEntries]; },
  };
}
