import type { BoardConfig, FsEntry } from "../types";

export const MOCK_BOARDS: BoardConfig[] = [
  {
    id: "esp32s3-devkitc",
    name: "ESP32-S3 DevKitC",
    partitionAddress: "0x290000",
    partitionSize: 1441792,
    flashSize: "4MB",
  },
  {
    id: "esp32-wroom",
    name: "ESP32-WROOM-32",
    partitionAddress: "0x110000",
    partitionSize: 983040,
    flashSize: "4MB",
  },
  {
    id: "esp32c3-mini",
    name: "ESP32-C3-MINI",
    partitionAddress: "0x210000",
    partitionSize: 2097152,
    flashSize: "8MB",
  },
];

export const MOCK_FS_TREE: FsEntry[] = [
  {
    name: "config",
    kind: "dir",
    size: 0,
    children: [
      { name: "wifi.json", kind: "file", size: 245 },
      { name: "mqtt.json", kind: "file", size: 189 },
      { name: "device.json", kind: "file", size: 312 },
    ],
  },
  {
    name: "www",
    kind: "dir",
    size: 0,
    children: [
      { name: "index.html", kind: "file", size: 1823 },
      { name: "style.css", kind: "file", size: 642 },
      { name: "app.js", kind: "file", size: 4210 },
      {
        name: "assets",
        kind: "dir",
        size: 0,
        children: [
          { name: "logo.png", kind: "file", size: 8432 },
          { name: "favicon.ico", kind: "file", size: 1150 },
        ],
      },
    ],
  },
  { name: "cert.pem", kind: "file", size: 1704 },
  { name: "key.pem", kind: "file", size: 1218 },
  { name: "README.md", kind: "file", size: 312 },
];
