use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

/// Turn the display off using xset (Linux only)
#[tauri::command]
async fn screen_off(app: AppHandle) -> Result<(), String> {
    app.shell()
        .command("xset")
        .args(["dpms", "force", "off"])
        .output()
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Turn the display on using xset (Linux only)
#[tauri::command]
async fn screen_on(app: AppHandle) -> Result<(), String> {
    app.shell()
        .command("xset")
        .args(["dpms", "force", "on"])
        .output()
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Set display brightness using xrandr. brightness is 0.0–1.0.
/// Requires knowing the output name (e.g. HDMI-1, eDP-1).
/// Tries common output names until one works.
#[tauri::command]
async fn set_brightness(app: AppHandle, brightness: f32) -> Result<(), String> {
    let clamped = brightness.clamp(0.0, 1.0);
    let outputs = ["eDP-1", "HDMI-1", "HDMI-2", "DP-1", "DP-2", "VGA-1"];
    for output in &outputs {
        let result = app.shell()
            .command("xrandr")
            .args(["--output", output, "--brightness", &clamped.to_string()])
            .output()
            .await;
        if let Ok(out) = result {
            if out.status.success() {
                return Ok(());
            }
        }
    }
    Err("Failed to set brightness — no matching display output found".into())
}

/// Prevent display from sleeping (DPMS disable)
#[tauri::command]
async fn keep_screen_on(app: AppHandle) -> Result<(), String> {
    app.shell()
        .command("xset")
        .args(["s", "off", "-dpms"])
        .output()
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Get the app version from Cargo.toml
#[tauri::command]
fn app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            screen_off,
            screen_on,
            set_brightness,
            keep_screen_on,
            app_version,
        ])
        .setup(|app| {
            // Disable screen saver and DPMS on launch for kiosk mode
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let _ = keep_screen_on(app_handle).await;
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Canvas UI");
}
