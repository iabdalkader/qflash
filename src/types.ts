export interface FsEntry {
  name: string;
  kind: "file" | "dir";
  size: number;
  bootable?: boolean;
  localPath?: string;
  children?: FsEntry[];
}

export interface DeviceInfo {
  device: string;
  pid: number;
  vid: number;
  part: number;
  size: number;
}

export interface BoardConfig {
  id: string;
  name: string;
  partitionAddress: string;
  partitionSize: number;
  flashSize: string;
}

export type FsType = "littlefs";

export interface AppState {
  boards: BoardConfig[];
  selectedBoard: BoardConfig | null;
  selectedFsType: FsType;
  fsTree: FsEntry[];
  currentPath: string[];
  selectedEntries: Set<string>;
  dirty: boolean;
}
