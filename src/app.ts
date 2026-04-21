import type { AppState } from "./types";
import { createToolbar } from "./components/toolbar";
import { createFileBrowser } from "./components/file-browser";
import { createStatusBar } from "./components/status-bar";
import { createConsole } from "./components/console";
import * as backend from "./services/backend";

export function createApp(root: HTMLElement) {
  const state: AppState = {
    boards: [],
    selectedBoard: null,
    selectedFsType: "littlefs",
    fsTree: [],
    currentPath: [],
    selectedEntries: new Set(),
    dirty: false,
  };

  // Create components
  const toolbar = createToolbar();
  const fileBrowser = createFileBrowser();
  const consolePanel = createConsole();
  const statusBar = createStatusBar();

  // Mount
  root.appendChild(toolbar.element);
  root.appendChild(fileBrowser.element);
  root.appendChild(consolePanel.element);
  root.appendChild(statusBar.element);

  function refreshView() {
    fileBrowser.setEntries(state.fsTree);
    statusBar.update(state.fsTree, state.selectedBoard?.partitionSize || 0, state.selectedEntries.size);
  }

  function markDirty() {
    state.dirty = true;
    toolbar.setDirty(true);
  }

  // Refresh device list
  async function refreshDevices() {
    try {
      const devices = await backend.listDevices();
      toolbar.setDevices(devices);
    } catch (err) {
      console.error("Failed to list devices:", err);
    }
  }

  // Wire toolbar events
  toolbar.onRefreshDevices(() => {
    refreshDevices();
  });

  toolbar.onDeviceChange((device) => {
    statusBar.setDevice(device.device, device.part, device.size);
  });


  toolbar.onLoad(async () => {
    const device = toolbar.getSelectedDevice();
    if (!device) return;

    toolbar.setLoading(true);
    fileBrowser.setLoading(true);
    consolePanel.clear();
    try {
      state.fsTree = await backend.loadFilesystem(device.vid, device.pid);
      state.dirty = false;
      toolbar.setDirty(false);
      fileBrowser.setEntries(state.fsTree, true);
    } catch (err) {
      consolePanel.log(`Error: ${err}`);
    } finally {
      toolbar.setLoading(false);
      fileBrowser.setLoading(false);
    }
  });

  toolbar.onSave(async () => {
    const device = toolbar.getSelectedDevice();
    if (!state.dirty) return;
    toolbar.setSaving(true);
    fileBrowser.setLoading(true, "Writing filesystem...");
    consolePanel.clear();
    try {
      await backend.saveFilesystem(device, state.fsTree);
      state.dirty = false;
      toolbar.setDirty(false);
    } catch (err) {
      consolePanel.log(`Error: ${err}`);
    } finally {
      toolbar.setSaving(false);
      fileBrowser.setLoading(false);
    }
  });

  // Wire file browser events
  fileBrowser.onAddFiles((files) => {
    const device = toolbar.getSelectedDevice();
    if (!device) return;
    // Clear readonly loaded entries on first drop
    if (state.fsTree.length > 0 && !state.dirty) {
      state.fsTree = [];
    }
    const partSize = device.size;
    let added = false;
    for (const file of files) {
      if (state.fsTree.some((e) => e.name === file.name)) continue;
      if (partSize > 0) {
        const used = state.fsTree.reduce((s, e) => s + e.size, 0);
        if (used + file.size > partSize) {
          consolePanel.log(`Skipped ${file.name}: exceeds partition size`);
          continue;
        }
      }
      state.fsTree.push(file);
      added = true;
    }
    if (added) {
      markDirty();
      refreshView();
    }
  });

  fileBrowser.onBootableChange((name, bootable) => {
    const entry = state.fsTree.find((e) => e.name === name);
    if (entry) {
      entry.bootable = bootable;
      markDirty();
    }
  });

  fileBrowser.onRemoveEntry((name) => {
    const idx = state.fsTree.findIndex((e) => e.name === name);
    if (idx >= 0) {
      state.fsTree.splice(idx, 1);
      markDirty();
      refreshView();
    }
  });

  // Initialize: load device list
  refreshDevices();

  // Show empty state initially
  refreshView();
}
