import type { DeviceInfo } from "../types";

const ICON_LOAD = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
  <path d="M2 11v2.5a1 1 0 001 1h10a1 1 0 001-1V11"/>
  <path d="M8 2v8M5 7l3 3 3-3"/>
</svg>`;

const ICON_SAVE = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
  <path d="M2 11v2.5a1 1 0 001 1h10a1 1 0 001-1V11"/>
  <path d="M8 10V2M5 5l3-3 3 3"/>
</svg>`;

const ICON_REFRESH = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
  <path d="M13.5 8a5.5 5.5 0 11-1.3-3.5M13.5 2v3h-3"/>
</svg>`;

export interface ToolbarController {
  element: HTMLElement;
  onLoad(handler: () => void): void;
  onSave(handler: () => void): void;
  onRefreshDevices(handler: () => void): void;
  onDeviceChange(handler: (device: DeviceInfo) => void): void;
  setDevices(devices: DeviceInfo[]): void;
  setDirty(dirty: boolean): void;
  setLoading(loading: boolean): void;
  setSaving(saving: boolean): void;
  getSelectedDevice(): DeviceInfo | null;
}

export function createToolbar(): ToolbarController {
  const el = document.createElement("div");
  el.className = "toolbar";

  let devices: DeviceInfo[] = [];
  let loadHandler: (() => void) | null = null;
  let saveHandler: (() => void) | null = null;
  let refreshHandler: (() => void) | null = null;
  let deviceChangeHandler: ((device: DeviceInfo) => void) | null = null;

  // Device select
  const deviceSelect = document.createElement("select");
  deviceSelect.title = "Select device";
  populateDevices();
  el.appendChild(deviceSelect);

  // Refresh button
  const refreshBtn = document.createElement("button");
  refreshBtn.className = "toolbar-btn";
  refreshBtn.innerHTML = ICON_REFRESH;
  refreshBtn.title = "Refresh device list";
  el.appendChild(refreshBtn);

  // Spacer
  const spacer = document.createElement("div");
  spacer.className = "toolbar-spacer";
  el.appendChild(spacer);

  // Load button
  const loadBtn = document.createElement("button");
  loadBtn.className = "toolbar-btn";
  loadBtn.innerHTML = `${ICON_LOAD} Load`;
  loadBtn.title = "Load filesystem from device";
  loadBtn.disabled = true;
  el.appendChild(loadBtn);

  // Save button
  const saveBtn = document.createElement("button");
  saveBtn.className = "toolbar-btn";
  saveBtn.innerHTML = `${ICON_SAVE} Save`;
  saveBtn.title = "Save filesystem to device";
  saveBtn.disabled = true;
  el.appendChild(saveBtn);

  // Events
  deviceSelect.addEventListener("change", () => {
    const dev = devices[deviceSelect.selectedIndex - 1] || null;
    loadBtn.disabled = !dev;
    if (dev && deviceChangeHandler) {
      deviceChangeHandler(dev);
    }
  });

  refreshBtn.addEventListener("click", () => {
    if (refreshHandler) refreshHandler();
  });

  loadBtn.addEventListener("click", () => {
    if (loadHandler) loadHandler();
  });

  saveBtn.addEventListener("click", () => {
    if (saveHandler) saveHandler();
  });

  function deviceKey(d: DeviceInfo): string {
    return `${d.vid}:${d.pid}`;
  }

  function populateDevices() {
    deviceSelect.innerHTML = `<option value="" disabled selected>Select device...</option>`;
    for (const dev of devices) {
      const opt = document.createElement("option");
      opt.value = deviceKey(dev);
      opt.textContent = dev.device;
      deviceSelect.appendChild(opt);
    }
  }

  return {
    element: el,
    onLoad(handler) { loadHandler = handler; },
    onSave(handler) { saveHandler = handler; },
    onRefreshDevices(handler) { refreshHandler = handler; },
    onDeviceChange(handler) { deviceChangeHandler = handler; },
    setDevices(newDevices) {
      devices = newDevices;
      populateDevices();
      if (devices.length > 0) {
        deviceSelect.value = deviceKey(devices[0]);
        loadBtn.disabled = false;
        if (deviceChangeHandler) deviceChangeHandler(devices[0]);
      }
    },
    setDirty(dirty) {
      saveBtn.disabled = !dirty;
    },
    setLoading(loading) {
      loadBtn.disabled = loading;
      if (loading) {
        loadBtn.innerHTML = `<span class="spinner"></span> Loading`;
      } else {
        loadBtn.innerHTML = `${ICON_LOAD} Load`;
        loadBtn.disabled = !deviceSelect.value;
      }
    },
    setSaving(saving) {
      saveBtn.disabled = saving;
      if (saving) {
        saveBtn.innerHTML = `<span class="spinner"></span> Saving`;
      } else {
        saveBtn.innerHTML = `${ICON_SAVE} Save`;
      }
    },
    getSelectedDevice() {
      if (!deviceSelect.value) return null;
      return devices.find((d) => deviceKey(d) === deviceSelect.value) || null;
    },
  };
}
