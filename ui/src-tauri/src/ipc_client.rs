use serde_json::json;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::Duration;
use tauri::command;
use tokio::sync::Mutex as AsyncMutex;

const PIPE_NAME: &str = r"\\.\pipe\Graffiti";
const CREATE_NO_WINDOW: u32 = 0x08000000;

static WEB_WALLPAPER_PROCESS: Mutex<Option<Child>> = Mutex::new(None);
static RENDERER_PROCESS: Mutex<Option<Child>> = Mutex::new(None);
// The renderer currently serves one named-pipe client at a time. Serialize
// callers so status polling and click-triggered commands cannot block each
// other inside Windows named-pipe connection setup.
static IPC_SEND_MUTEX: AsyncMutex<()> = AsyncMutex::const_new(());

fn get_renderer_path() -> PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        let relative = exe
            .parent()
            .unwrap_or(Path::new("."))
            .join("GraffitiRenderer.exe");
        if relative.exists() {
            return relative;
        }
    }
    PathBuf::from(r"C:\My_Proj\InteractWall\renderer\build\Release\GraffitiRenderer.exe")
}

fn get_baked_wallpapers_dir_path() -> Result<PathBuf, String> {
    let app_data = std::env::var("APPDATA").map_err(|_| "Could not find APPDATA".to_string())?;
    Ok(PathBuf::from(app_data)
        .join("Graffiti")
        .join("baked_wallpapers"))
}

const ABOVE_NORMAL_PRIORITY_CLASS: u32 = 0x00008000;

fn ensure_renderer_running() -> Result<(), String> {
    let mut renderer = RENDERER_PROCESS.lock().unwrap_or_else(|e| e.into_inner());
    if renderer.is_some() {
        let process_status = renderer
            .as_mut()
            .expect("renderer process disappeared while locked")
            .try_wait();
        match process_status {
            Ok(None) => {
                // The process is alive but its named pipe is not ready yet.
                return Ok(());
            }
            Ok(Some(status)) => {
                println!(
                    "[IPC] Renderer exited with status {:?}; restarting.",
                    status
                );
                *renderer = None;
            }
            Err(err) => {
                println!(
                    "[IPC] Could not query renderer process: {}; restarting.",
                    err
                );
                *renderer = None;
            }
        }
    }

    println!("[IPC] Pipe not found, spawning renderer...");
    let renderer_path = get_renderer_path();
    let is_autostart = std::env::args().any(|a| a == "--autostart");
    let flags = if is_autostart {
        CREATE_NO_WINDOW | ABOVE_NORMAL_PRIORITY_CLASS
    } else {
        CREATE_NO_WINDOW
    };
    let child = Command::new(&renderer_path)
        .creation_flags(flags)
        .spawn()
        .map_err(|e| format!("Failed to spawn renderer at {:?}: {}", renderer_path, e))?;
    *renderer = Some(child);
    Ok(())
}

async fn send_ipc_message(msg: &serde_json::Value) -> Result<String, String> {
    let _send_guard = IPC_SEND_MUTEX.lock().await;
    crate::renderer_ipc::request(
        PIPE_NAME,
        msg,
        Some(ensure_renderer_running),
        Duration::from_secs(10),
        Duration::from_secs(2),
    )
    .await
}

async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|e| format!("Background file/process task failed: {}", e))?
}

#[command]
pub async fn apply(layer_a: String, layer_b: String) -> Result<(), String> {
    let msg = json!({
        "cmd": "apply_wallpaper",
        "layerA": layer_a.clone(),
        "layerB": layer_b
    });
    println!(
        "[ipc_client.rs] Sending apply_wallpaper. EXACT path: {}",
        layer_a
    );
    send_ipc_message(&msg).await?;
    Ok(())
}

#[command]
pub async fn set_effect(plugin: String) -> Result<(), String> {
    let msg = json!({
        "cmd": "set_effect",
        "plugin": plugin
    });
    send_ipc_message(&msg).await?;
    Ok(())
}

#[command]
pub async fn remove_effect() -> Result<(), String> {
    let msg = json!({
        "cmd": "remove_effect"
    });
    send_ipc_message(&msg).await?;
    Ok(())
}

#[command]
pub async fn set_setting(key: String, value: f32) -> Result<(), String> {
    let msg = json!({
        "cmd": "set_setting",
        "key": key,
        "value": value
    });
    send_ipc_message(&msg).await?;
    Ok(())
}

#[command]
pub async fn set_setting_str(key: String, value: String) -> Result<(), String> {
    let msg = json!({
        "cmd": "set_setting",
        "key": key,
        "valueStr": value
    });
    send_ipc_message(&msg).await?;
    Ok(())
}

#[command]
pub async fn set_fps_cap(fps: i32) -> Result<(), String> {
    let msg = json!({"cmd": "set_fps_cap", "fps": fps});
    send_ipc_message(&msg).await?;
    Ok(())
}

#[command]
pub async fn set_resolution_scale(scale: f32) -> Result<(), String> {
    let msg = json!({"cmd": "set_resolution_scale", "scale": scale});
    send_ipc_message(&msg).await?;
    Ok(())
}

#[command]
pub async fn set_quality_auto() -> Result<(), String> {
    let msg = json!({"cmd": "set_quality_auto"});
    send_ipc_message(&msg).await?;
    Ok(())
}

#[command]
pub async fn get_status() -> Result<serde_json::Value, String> {
    // Telemetry must neither launch the renderer nor queue behind an action.
    let _send_guard = IPC_SEND_MUTEX
        .try_lock()
        .map_err(|_| "Renderer is busy".to_string())?;
    let msg = json!({"cmd": "get_status"});
    let resp = crate::renderer_ipc::request(
        PIPE_NAME,
        &msg,
        None,
        Duration::from_millis(200),
        Duration::from_millis(500),
    )
    .await?;
    if resp.is_empty() {
        return Err("Empty response".to_string());
    }
    serde_json::from_str(&resp).map_err(|e| format!("Failed to parse status JSON: {}", e))
}

#[command]
pub async fn get_adapters() -> Result<Vec<String>, String> {
    let resp = send_ipc_message(&json!({"cmd": "get_adapters"})).await?;
    serde_json::from_str(&resp).map_err(|e| format!("Failed to parse adapter JSON: {}", e))
}

#[command]
pub async fn import_wallpaper(file_path: String) -> Result<String, String> {
    blocking(move || {
        let source = Path::new(&file_path);
        if !source.exists() {
            return Err("Source file does not exist".to_string());
        }

        let file_name = source.file_name().ok_or("Invalid file name")?;

        // Resolve %APPDATA%\Graffiti\wallpapers
        let app_data =
            std::env::var("APPDATA").map_err(|_| "Could not find APPDATA".to_string())?;
        let mut target_dir = PathBuf::from(app_data);
        target_dir.push("Graffiti");
        target_dir.push("wallpapers");

        if !target_dir.exists() {
            fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
        }

        let target_path = target_dir.join(file_name);
        fs::copy(source, &target_path).map_err(|e| e.to_string())?;

        println!("[IPC Stub] Imported wallpaper to {:?}", target_path);

        Ok(target_path.to_string_lossy().to_string())
    })
    .await
}

#[tauri::command]
pub async fn list_wallpapers() -> Result<Vec<String>, String> {
    blocking(move || {
        let target_dir = get_baked_wallpapers_dir_path()?;

        let mut wallpapers = Vec::new();
        if target_dir.exists() {
            if let Ok(entries) = fs::read_dir(&target_dir) {
                for entry in entries.flatten() {
                    if let Ok(file_type) = entry.file_type() {
                        if file_type.is_file() {
                            let file_name = entry.file_name().to_string_lossy().to_string();
                            if file_name != "active-collage.png"
                                && !file_name.ends_with("_depth.png")
                                && !file_name.ends_with(".project.json")
                            {
                                wallpapers.push(entry.path().to_string_lossy().to_string());
                            }
                        }
                    }
                }
            }
        }

        Ok(wallpapers)
    })
    .await
}

#[command(async)]
pub fn get_baked_wallpapers_dir() -> Result<String, String> {
    Ok(get_baked_wallpapers_dir_path()?
        .to_string_lossy()
        .to_string())
}
#[command]
pub async fn save_baked_wallpaper(filename: String, bytes: Vec<u8>) -> Result<String, String> {
    blocking(move || {
        let app_data =
            std::env::var("APPDATA").map_err(|_| "Could not find APPDATA".to_string())?;
        let mut target_dir = PathBuf::from(app_data);
        target_dir.push("Graffiti");
        target_dir.push("baked_wallpapers");

        if !target_dir.exists() {
            fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
        }

        let target_path = target_dir.join(&filename);

        let mut file = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&target_path)
            .map_err(|e| e.to_string())?;

        file.write_all(&bytes).map_err(|e| e.to_string())?;

        println!("[IPC Stub] Saved baked wallpaper to {:?}", target_path);

        Ok(target_path.to_string_lossy().to_string())
    })
    .await
}

#[command]
pub async fn delete_baked_wallpaper(path: String) -> Result<(), String> {
    blocking(move || {
        std::fs::remove_file(&path)
            .map_err(|e| format!("Failed to delete file {}: {}", path, e))?;
        let sidecar = PathBuf::from(format!("{}.project.json", path));
        let _ = fs::remove_file(sidecar);
        Ok(())
    })
    .await
}

#[command]
pub async fn save_baked_project(path: String, project: serde_json::Value) -> Result<(), String> {
    blocking(move || {
        let sidecar = PathBuf::from(format!("{}.project.json", path));
        let contents = serde_json::to_vec_pretty(&project)
            .map_err(|e| format!("Failed to serialize baked project: {}", e))?;
        fs::write(&sidecar, contents)
            .map_err(|e| format!("Failed to save baked project metadata: {}", e))?;
        Ok(())
    })
    .await
}

#[command]
pub async fn load_baked_project(path: String) -> Result<Option<serde_json::Value>, String> {
    blocking(move || {
        let sidecar = PathBuf::from(format!("{}.project.json", path));
        if !sidecar.exists() {
            return Ok(None);
        }
        let contents = fs::read_to_string(&sidecar)
            .map_err(|e| format!("Failed to read baked project metadata: {}", e))?;
        let project = serde_json::from_str(&contents)
            .map_err(|e| format!("Failed to parse baked project metadata: {}", e))?;
        Ok(Some(project))
    })
    .await
}

pub async fn send_quit_command() {
    let _send_guard = IPC_SEND_MUTEX.lock().await;
    let _ = crate::renderer_ipc::request(
        PIPE_NAME,
        &json!({"cmd": "quit"}),
        None,
        Duration::from_millis(500),
        Duration::from_millis(500),
    )
    .await;
}

#[command]
pub async fn clear_wallpaper() -> Result<(), String> {
    let msg = json!({"cmd": "clear_wallpaper"});
    send_ipc_message(&msg).await?;
    Ok(())
}

fn get_web_wallpaper_path() -> PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        let relative = exe
            .parent()
            .unwrap_or(Path::new("."))
            .join("web_wallpaper.exe");
        if relative.exists() {
            return relative;
        }
    }
    PathBuf::from(r"C:\My_Proj\InteractWall\web_wallpaper\web_wallpaper.exe")
}

fn resolve_web_assets_dir() -> Result<PathBuf, String> {
    let app_data = std::env::var("APPDATA").map_err(|_| "Could not find APPDATA".to_string())?;
    let dir = PathBuf::from(app_data).join("Graffiti").join("web_assets");
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(dir)
}

fn get_web_ready_path() -> Result<PathBuf, String> {
    let app_data = std::env::var("APPDATA").map_err(|_| "Could not find APPDATA".to_string())?;
    Ok(PathBuf::from(app_data)
        .join("Graffiti")
        .join("web_ready.lock"))
}

fn copy_bundled_web_assets() -> Result<(), String> {
    let assets_dir = resolve_web_assets_dir()?;

    let bundled_dir = if let Ok(exe) = std::env::current_exe() {
        exe.parent().unwrap_or(Path::new(".")).join("web_assets")
    } else {
        PathBuf::from(r"C:\My_Proj\InteractWall\web_wallpaper\assets")
    };

    if !bundled_dir.exists() {
        return Ok(());
    }

    for name in &[
        "index.html",
        "three.module.js",
        "GLTFLoader.js",
        "BufferGeometryUtils.js",
    ] {
        let src = bundled_dir.join(name);
        let dst = assets_dir.join(name);
        if src.exists() {
            fs::copy(&src, &dst).map_err(|e| format!("Failed to copy {}: {}", name, e))?;
        }
    }
    Ok(())
}

#[command]
pub async fn start_web_wallpaper(
    model: String,
    bg_type: String,
    bg_color: Option<String>,
    bg_image: Option<String>,
    rotation_factor: Option<f64>,
    zoom_factor: Option<f64>,
    offset_x: Option<f64>,
    offset_y: Option<f64>,
    enable_vertical_rotation: Option<bool>,
    initial_rotation_x: Option<f64>,
    initial_rotation_y: Option<f64>,
) -> Result<(), String> {
    send_ipc_message(&json!({"cmd": "remove_effect"})).await?;
    tauri::async_runtime::spawn_blocking(move || {
        start_web_wallpaper_blocking(
            model,
            bg_type,
            bg_color,
            bg_image,
            rotation_factor,
            zoom_factor,
            offset_x,
            offset_y,
            enable_vertical_rotation,
            initial_rotation_x,
            initial_rotation_y,
        )
    })
    .await
    .map_err(|e| format!("Web wallpaper startup task failed: {}", e))?
}

fn start_web_wallpaper_blocking(
    model: String,
    bg_type: String,
    bg_color: Option<String>,
    bg_image: Option<String>,
    rotation_factor: Option<f64>,
    zoom_factor: Option<f64>,
    offset_x: Option<f64>,
    offset_y: Option<f64>,
    enable_vertical_rotation: Option<bool>,
    initial_rotation_x: Option<f64>,
    initial_rotation_y: Option<f64>,
) -> Result<(), String> {
    // Hold the mutex for the entire lifecycle to prevent races from concurrent calls
    let mut guard = WEB_WALLPAPER_PROCESS
        .lock()
        .unwrap_or_else(|e| e.into_inner());

    // Kill any existing web wallpaper process
    if let Some(mut child) = guard.take() {
        println!(
            "[ipc_client.rs] Killing existing web_wallpaper.exe (PID {})",
            child.id()
        );
        let _ = child.kill();
        let _ = child.wait();
    }

    // Give the renderer time to process the queued remove_effect and hide.
    std::thread::sleep(std::time::Duration::from_millis(200));

    // Copy bundled web assets (index.html, three.js, etc.) to %APPDATA%\Graffiti\web_assets\
    copy_bundled_web_assets()?;

    // Write config file that web_wallpaper.exe reads on startup
    let app_data = std::env::var("APPDATA").map_err(|_| "Could not find APPDATA".to_string())?;
    let graffiti_dir = PathBuf::from(&app_data).join("Graffiti");
    let config_path = graffiti_dir.join("web_config.json");
    let tmp_config_path = graffiti_dir.join("web_config.json.tmp");

    let model_filename = Path::new(&model)
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default();

    let bg_image_filename = bg_image.as_ref().map(|p| {
        Path::new(p)
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_default()
    });

    let config = json!({
        "type": "config",
        "model": model_filename,
        "backgroundType": bg_type,
        "backgroundColor": bg_color.unwrap_or_else(|| "#000000".to_string()),
        "backgroundImage": bg_image_filename,
        "rotationFactor": rotation_factor.unwrap_or(0.2),
        "zoomFactor": zoom_factor.unwrap_or(1.0),
        "offsetX": offset_x.unwrap_or(0.0),
        "offsetY": offset_y.unwrap_or(0.0),
        "enableVerticalRotation": enable_vertical_rotation.unwrap_or(true),
        "initialRotationX": initial_rotation_x.unwrap_or(0.0),
        "initialRotationY": initial_rotation_y.unwrap_or(0.0),
    });

    // Atomic write: write to temp file then rename to avoid torn reads
    fs::write(&tmp_config_path, config.to_string())
        .map_err(|e| format!("Failed to write config: {}", e))?;
    fs::rename(&tmp_config_path, &config_path)
        .map_err(|e| format!("Failed to rename config: {}", e))?;

    // Delete stale ready lock
    let lock_path = get_web_ready_path()?;
    let _ = fs::remove_file(&lock_path);

    // Spawn web_wallpaper.exe with our PID so it self-terminates if the UI dies
    let exe_path = get_web_wallpaper_path();
    let pid = std::process::id().to_string();

    let child = Command::new(&exe_path)
        .arg(&pid)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("Failed to spawn web_wallpaper.exe at {:?}: {}", exe_path, e))?;

    println!(
        "[ipc_client.rs] Spawned web_wallpaper.exe (PID {})",
        child.id()
    );
    *guard = Some(child);

    Ok(())
}

#[command]
pub async fn stop_web_wallpaper() -> Result<(), String> {
    blocking(move || {
        let mut guard = WEB_WALLPAPER_PROCESS
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        if let Some(mut child) = guard.take() {
            println!(
                "[ipc_client.rs] Killing web_wallpaper.exe (PID {})",
                child.id()
            );
            let _ = child.kill();
            let _ = child.wait();
        }
        if let Ok(lock_path) = get_web_ready_path() {
            let _ = fs::remove_file(lock_path);
        }
        Ok(())
    })
    .await
}

#[command(async)]
pub fn is_web_wallpaper_ready() -> Result<bool, String> {
    Ok(get_web_ready_path()?.exists())
}

#[command]
pub async fn get_web_config() -> Result<Option<serde_json::Value>, String> {
    blocking(move || {
        let app_data =
            std::env::var("APPDATA").map_err(|_| "Could not find APPDATA".to_string())?;
        let config_path = PathBuf::from(&app_data)
            .join("Graffiti")
            .join("web_config.json");
        if !config_path.exists() {
            return Ok(None);
        }
        let contents = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read web_config.json: {}", e))?;
        let config: serde_json::Value = serde_json::from_str(&contents)
            .map_err(|e| format!("Failed to parse web_config.json: {}", e))?;
        Ok(Some(config))
    })
    .await
}

#[command(async)]
pub fn get_web_assets_dir() -> Result<String, String> {
    Ok(resolve_web_assets_dir()?.to_string_lossy().to_string())
}

#[command]
pub async fn import_web_asset(file_path: String) -> Result<String, String> {
    blocking(move || {
        let source = Path::new(&file_path);
        if !source.exists() {
            return Err("Source file does not exist".to_string());
        }

        let file_name = source.file_name().ok_or("Invalid file name")?;
        let target_dir = resolve_web_assets_dir()?;
        let target_path = target_dir.join(file_name);

        fs::copy(source, &target_path).map_err(|e| e.to_string())?;
        println!("[ipc_client.rs] Imported web asset to {:?}", target_path);

        Ok(target_path.to_string_lossy().to_string())
    })
    .await
}
