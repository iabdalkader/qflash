// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use adb_client::usb;
use adb_client::ADBDeviceExt;
use littlefs2::fs::Filesystem;
use serde::{Deserialize, Serialize};
use tauri::{path::BaseDirectory, Emitter, Manager};

mod storage;
use storage::FlashStorage;

#[derive(Debug, Serialize, Deserialize)]
struct FileEntry {
    name: String,
    size: u64,
    #[serde(default)]
    bootable: bool,
    #[serde(default, rename = "localPath")]
    local_path: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Board {
    #[serde(deserialize_with = "deserialize_hex")]
    vid: u32,
    #[serde(deserialize_with = "deserialize_hex")]
    pid: u32,
    name: String,
    #[serde(deserialize_with = "deserialize_hex")]
    part: u32,
    #[serde(deserialize_with = "deserialize_hex")]
    size: u32,
    bank: u32,
    #[serde(deserialize_with = "deserialize_hex")]
    offset: u32,
}

struct AppBoards(Vec<Board>);

impl AppBoards {
    fn find(&self, vid: u16, pid: u16) -> Result<&Board, String> {
        self.0.iter()
            .find(|b| b.vid == vid as u32 && b.pid == pid as u32)
            .ok_or_else(|| format!("unknown device {:04x}:{:04x}", vid, pid))
    }
}

fn deserialize_hex<'de, D: serde::Deserializer<'de>>(d: D) -> Result<u32, D::Error> {
    let s = String::deserialize(d)?;
    u32::from_str_radix(s.trim_start_matches("0x"), 16).map_err(serde::de::Error::custom)
}

#[tauri::command]
fn get_file_sizes(paths: Vec<String>) -> Vec<u64> {
    paths
        .iter()
        .map(|p| std::fs::metadata(p).map(|m| m.len()).unwrap_or(0))
        .collect()
}

#[tauri::command]
fn list_devices(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let boards = &app.state::<AppBoards>().0;

    Ok(usb::find_all_connected_adb_devices()
        .into_iter()
        .flatten()
        .filter_map(|d| {
            boards
                .iter()
                .find(|b| b.vid == d.vendor_id as u32 && b.pid == d.product_id as u32)
                .map(|b| {
                    serde_json::json!({
                        "vid": b.vid,
                        "pid": b.pid,
                        "part": b.part,
                        "size": b.size,
                        "device": b.name,
                    })
                })
        })
        .collect())
}

#[tauri::command]
async fn load_filesystem(app: tauri::AppHandle, vid: u16, pid: u16) -> Result<Vec<FileEntry>, String> {
    let boards = app.state::<AppBoards>();
    let board = boards.find(vid, pid)?;
    let bank = board.bank;
    let offset = board.offset;
    let size = board.size;

    tauri::async_runtime::spawn_blocking(move || {
        let cmd = format!(
            "/opt/openocd/bin/openocd -s /opt/openocd/ -f openocd_gpiod.cfg \
            -c 'init; reset halt; flash read_bank {} /tmp/storage.img 0x{:x} 0x{:x}; \
            reset run; shutdown'",
            bank, offset, size
        );

        let _ = app.emit("console-log", "Connecting to device...");
        let mut device = usb::ADBUSBDevice::new(vid, pid).map_err(|e| e.to_string())?;

        let mut stdout = Vec::new();
        let mut stderr = Vec::new();
        let _ = app.emit("console-log", "Reading flash...");
        device.shell_command(&cmd, Some(&mut stdout), Some(&mut stderr)).map_err(|e| e.to_string())?;
        if !stdout.is_empty() {
            let _ = app.emit("console-log", String::from_utf8_lossy(&stdout).to_string());
        }
        if !stderr.is_empty() {
            let _ = app.emit("console-log", String::from_utf8_lossy(&stderr).to_string());
        }

        let _ = app.emit("console-log", "Pulling image...");
        let tmp = std::env::temp_dir().join("qflash_storage.img");
        let mut file = std::fs::File::create(&tmp).map_err(|e| e.to_string())?;
        device.pull(&"/tmp/storage.img", &mut file).map_err(|e| e.to_string())?;

        let data = std::fs::read(&tmp).map_err(|e| e.to_string())?;
        let _ = app.emit("console-log", format!("Mounting filesystem ({} bytes)...", data.len()));

        let mut storage = FlashStorage::new(data);
        let mut alloc = Filesystem::allocate();
        let fs = Filesystem::mount(&mut alloc, &mut storage)
            .map_err(|e| format!("mount failed (error code {})", e.code()))?;

        let mut entries = Vec::new();
        fs.read_dir_and_then(b"/\0".try_into().unwrap(), |dir| {
            while let Some(Ok(entry)) = dir.next() {
                let name: &str = entry.file_name().as_ref();
                if name == "." || name == ".." {
                    continue;
                }
                entries.push(FileEntry {
                    name: name.to_string(),
                    size: entry.metadata().len() as u64,
                    bootable: false,
                    local_path: None,
                });
            }
            Ok(())
        }).map_err(|e| format!("readdir failed (error code {})", e.code()))?;

        let _ = app.emit("console-log", format!("Found {} files.", entries.len()));
        Ok(entries)
    }).await.map_err(|e| e.to_string())?
}

fn build_manifest(files: &[FileEntry]) -> Result<Vec<u8>, String> {
    let manifest: Vec<serde_json::Value> = files.iter().map(|f| {
        let name = f.name.trim_end_matches(".ino.elf")
            .trim_end_matches(".elf");
        serde_json::json!({
            "name": name,
            "path": format!("/storage/{}", f.name),
            "flags": if f.bootable { 1 } else { 0 },
        })
    }).collect();
    serde_json::to_vec_pretty(&manifest)
        .map_err(|e| format!("failed to serialize manifest: {e}"))
}

#[tauri::command]
async fn save_filesystem(app: tauri::AppHandle, vid: u16, pid: u16, files: Vec<FileEntry>) -> Result<(), String> {
    let boards = app.state::<AppBoards>();
    let board = boards.find(vid, pid)?;
    let part = board.part;

    tauri::async_runtime::spawn_blocking(move || {
        let _ = app.emit("console-log", format!("Building image ({} files)...", files.len()));

        let mut storage = FlashStorage::new(Vec::new());
        Filesystem::format(&mut storage).map_err(|e| format!("format failed (error code {})", e.code()))?;

        {
            let mut alloc = Filesystem::allocate();
            let fs = Filesystem::mount(&mut alloc, &mut storage)
                .map_err(|e| format!("mount failed (error code {})", e.code()))?;

            for f in &files {
                let path = f.local_path.as_deref()
                    .ok_or_else(|| format!("no local path for {}", f.name))?;
                let data = std::fs::read(path)
                    .map_err(|e| format!("failed to read {}: {e}", f.name))?;
                let lfs_path: littlefs2::path::PathBuf = f.name.as_str().try_into()
                    .map_err(|e| format!("invalid filename {}: {e:?}", f.name))?;
                fs.open_file_with_options_and_then(
                    |opts| opts.write(true).create(true).truncate(true),
                    &lfs_path,
                    |file| { file.write(&data)?; Ok(()) },
                ).map_err(|e| format!("failed to write {}: error code {}", f.name, e.code()))?;
                let _ = app.emit("console-log", format!("  + {} ({} bytes)", f.name, data.len()));
            }

            let manifest_data = build_manifest(&files)?;
            fs.open_file_with_options_and_then(
                |opts| opts.write(true).create(true).truncate(true),
                littlefs2::path!("manifest.json"),
                |file| { file.write(&manifest_data)?; Ok(()) },
            ).map_err(|e| format!("failed to write manifest: error code {}", e.code()))?;
            let _ = app.emit("console-log", format!("  + manifest.json ({} bytes)", manifest_data.len()));
        }

        let tmp = std::env::temp_dir().join("qflash_storage.img");
        std::fs::write(&tmp, &storage.buf).map_err(|e| format!("failed to write image: {e}"))?;

        let _ = app.emit("console-log", "Connecting to device...");
        let mut device = usb::ADBUSBDevice::new(vid, pid).map_err(|e| e.to_string())?;

        let _ = app.emit("console-log", "Pushing image...");
        let mut img = std::fs::File::open(&tmp).map_err(|e| e.to_string())?;
        device.push(&mut img, &"/tmp/storage.img").map_err(|e| e.to_string())?;

        let _ = app.emit("console-log", "Writing flash...");
        let cmd = format!(
            "/opt/openocd/bin/openocd -s /opt/openocd/ -f openocd_gpiod.cfg \
            -c 'init; reset halt; flash write_image erase /tmp/storage.img 0x{:x}; \
            reset run; shutdown'",
            part
        );

        let mut stdout = Vec::new();
        let mut stderr = Vec::new();
        device.shell_command(&cmd, Some(&mut stdout), Some(&mut stderr)).map_err(|e| e.to_string())?;
        if !stdout.is_empty() {
            let _ = app.emit("console-log", String::from_utf8_lossy(&stdout).to_string());
        }
        if !stderr.is_empty() {
            let _ = app.emit("console-log", String::from_utf8_lossy(&stderr).to_string());
        }

        let _ = app.emit("console-log", "Done.");
        Ok(())
    }).await.map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            list_devices,
            get_file_sizes,
            load_filesystem,
            save_filesystem,
        ])
        .setup(|app| {
            let path = app
                .path()
                .resolve("resources/boards.json", BaseDirectory::Resource)?;
            let data = std::fs::read_to_string(&path)?;
            app.manage(AppBoards(serde_json::from_str(&data)?));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
