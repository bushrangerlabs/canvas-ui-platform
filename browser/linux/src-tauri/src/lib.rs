use tauri::{AppHandle, Manager};
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

/// Navigate an existing WebviewWindow to a new URL.
/// Used by KioskScreen to implement navigate_panel without closing/reopening.
#[tauri::command]
async fn navigate_webview(app: AppHandle, label: String, url: String) -> Result<(), String> {
    let win = app.get_webview_window(&label)
        .ok_or_else(|| format!("No webview with label '{}'", label))?;
    let parsed = url.parse::<tauri::Url>().map_err(|e| e.to_string())?;
    win.navigate(parsed).map_err(|e| e.to_string())
}

/// Close a WebviewWindow by label.
#[tauri::command]
fn close_webview(app: AppHandle, label: String) -> Result<(), String> {
    if let Some(win) = app.get_webview_window(&label) {
        win.close().map_err(|e| e.to_string())
    } else {
        Ok(()) // already gone
    }
}

/// Get the app version from Cargo.toml
#[tauri::command]
fn app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

/// Create a panel WebviewWindow, optionally injecting an ingress_session cookie
/// before the page loads so it passes HA ingress auth.
/// This enables Lovelace cards to access HA's custom element registry.
#[tauri::command]
fn create_panel_webview(
    app: AppHandle,
    label: String,
    url: String,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    title: String,
    visible: bool,
    ingress_session: Option<String>,
) -> Result<(), String> {
    let parsed_url = url.parse::<tauri::Url>().map_err(|e| e.to_string())?;

    let mut builder = tauri::WebviewWindowBuilder::new(
        &app,
        &label,
        tauri::WebviewUrl::External(parsed_url),
    )
    .position(x as f64, y as f64)
    .inner_size(width as f64, height as f64)
    .decorations(false)
    .resizable(false)
    .skip_taskbar(true)
    .visible(visible)
    .title(&title);

    // Inject ingress_session cookie BEFORE any page script runs.
    // The initialization script executes in the context of the loaded origin
    // (ha:8123) so document.cookie sets it for that domain.
    if let Some(session) = ingress_session {
        // Sanitize: strip any chars that could break out of the JS string
        let safe_session: String = session.chars()
            .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
            .collect();
        let script = format!(
            r#"document.cookie = "ingress_session={}; path=/; max-age=3600";"#,
            safe_session
        );
        builder = builder.initialization_script(&script);
    }

    builder.build().map_err(|e| e.to_string())?;
    Ok(())
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
            navigate_webview,
            close_webview,
            create_panel_webview,
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
