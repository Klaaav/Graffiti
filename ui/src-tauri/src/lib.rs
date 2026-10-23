mod depth;
mod ipc_client;
mod renderer_ipc;

use tauri::Manager;
use std::path::Path;

#[cfg(windows)]
fn acquire_single_instance() -> bool {
    use std::ptr::null_mut;
    use std::os::windows::ffi::OsStrExt;

    #[link(name = "kernel32")]
    extern "system" {
        fn CreateMutexW(
            lp_mutex_attributes: *mut std::ffi::c_void,
            b_initial_owner: i32,
            lp_name: *const u16,
        ) -> *mut std::ffi::c_void;
        fn GetLastError() -> u32;
        fn CloseHandle(handle: *mut std::ffi::c_void) -> i32;
    }

    const ERROR_ALREADY_EXISTS: u32 = 183;
    let name: Vec<u16> = std::ffi::OsStr::new("Local\\GraffitiDesktopInstance")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let handle = unsafe { CreateMutexW(null_mut(), 1, name.as_ptr()) };
    if handle.is_null() {
        return true;
    }
    if unsafe { GetLastError() } == ERROR_ALREADY_EXISTS {
        unsafe { CloseHandle(handle); }
        return false;
    }

    // Keep the named mutex alive for the lifetime of this process.
    std::mem::forget(handle);
    true
}

#[cfg(not(windows))]
fn acquire_single_instance() -> bool { true }

#[cfg(windows)]
fn boost_startup_priority() {
    use std::os::raw::c_void;
    #[link(name = "kernel32")]
    extern "system" {
        fn GetCurrentProcess() -> *mut c_void;
        fn SetPriorityClass(hProcess: *mut c_void, dwPriorityClass: u32) -> i32;
    }
    const ABOVE_NORMAL_PRIORITY_CLASS: u32 = 0x00008000;
    unsafe {
        let handle = GetCurrentProcess();
        SetPriorityClass(handle, ABOVE_NORMAL_PRIORITY_CLASS);
    }
    println!("[Startup] Process priority set to AboveNormal");
}

#[tauri::command]
fn is_autostart() -> bool {
    std::env::args().any(|arg| arg == "--autostart")
}

#[tauri::command]
async fn file_exists(path: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || Path::new(&path).exists())
        .await
        .map_err(|e| format!("File existence check failed: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if !acquire_single_instance() {
        eprintln!("[Startup] Graffiti is already running; exiting duplicate launch.");
        return;
    }

    // 1-TIME MIGRATION: Rename %APPDATA%\InteractWall to %APPDATA%\Graffiti
    if let Some(appdata) = std::env::var_os("APPDATA") {
        let old_path = std::path::Path::new(&appdata).join("InteractWall");
        let new_path = std::path::Path::new(&appdata).join("Graffiti");
        
        if old_path.exists() && !new_path.exists() {
            println!("[Migration] Renaming legacy 'InteractWall' data folder to 'Graffiti'...");
            if let Err(e) = std::fs::rename(&old_path, &new_path) {
                eprintln!("[Migration] FAILED to rename data folder: {}", e);
            } else {
                println!("[Migration] Successfully migrated data folder.");
            }
        } else if new_path.exists() {
            println!("[Migration] Skipped (already migrated or fresh install).");
        } else {
            println!("[Migration] Skipped (fresh install, no old data found).");
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_autostart::Builder::new().args(vec!["--autostart"]).build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let quit_i = tauri::menu::MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i =
                tauri::menu::MenuItem::with_id(app, "show", "Show Settings", true, None::<&str>)?;
            let menu = tauri::menu::Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = tauri::tray::TrayIconBuilder::new()
                .icon(tauri::include_image!("icons/32x32.png"))
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        let app = app.clone();
                        tauri::async_runtime::spawn(async move {
                            let _ = ipc_client::stop_web_wallpaper().await;
                            ipc_client::send_quit_command().await;
                            app.exit(0);
                        });
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::DoubleClick { .. } = event {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            if std::env::args().any(|arg| arg == "--autostart") {
                #[cfg(windows)]
                boost_startup_priority();
            } else {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.set_icon(tauri::include_image!("icons/128x128.png"));
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Closing the settings window hides Graffiti in the tray. The
                // renderer and web wallpaper must stay alive so the desktop
                // effect continues running. Full shutdown is reserved for
                // the tray menu's explicit Quit action above.
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            ipc_client::apply,
            ipc_client::set_effect,
            ipc_client::remove_effect,
            ipc_client::set_setting,
            ipc_client::set_setting_str,
            ipc_client::set_fps_cap,
            ipc_client::set_resolution_scale,
            ipc_client::set_quality_auto,
            ipc_client::get_status,
            ipc_client::get_adapters,
            ipc_client::import_wallpaper,
            ipc_client::list_wallpapers,
            ipc_client::get_baked_wallpapers_dir,
            ipc_client::save_baked_wallpaper,
            ipc_client::save_baked_project,
            ipc_client::load_baked_project,
            ipc_client::delete_baked_wallpaper,
            ipc_client::clear_wallpaper,
            ipc_client::start_web_wallpaper,
            ipc_client::stop_web_wallpaper,
            ipc_client::is_web_wallpaper_ready,
            ipc_client::get_web_config,
            ipc_client::get_web_assets_dir,
            ipc_client::import_web_asset,
            depth::generate_depth_map,
            is_autostart,
            file_exists,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
