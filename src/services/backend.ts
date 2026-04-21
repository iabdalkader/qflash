import { invoke } from "@tauri-apps/api/core";
import type { DeviceInfo, FsEntry } from "../types";

export async function listDevices(): Promise<DeviceInfo[]> {
  return invoke<DeviceInfo[]>("list_devices");
}

export async function loadFilesystem(vid: number, pid: number): Promise<FsEntry[]> {
  const files = await invoke<{ name: string; size: number }[]>("load_filesystem", { vid, pid });
  return files.map((f) => ({
    name: f.name,
    kind: "file" as const,
    size: f.size,
    bootable: false,
  }));
}

export async function saveFilesystem(
  device: DeviceInfo | null,
  tree: FsEntry[]
): Promise<void> {
  const files = tree.map((e) => ({
    name: e.name,
    size: e.size,
    bootable: e.bootable ?? false,
    localPath: e.localPath ?? null,
  }));
  return invoke("save_filesystem", {
    vid: device?.vid ?? 0,
    pid: device?.pid ?? 0,
    files,
  });
}
