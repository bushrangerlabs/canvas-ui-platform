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
/// Must run on the GTK main thread on Linux — same restriction as build().
#[tauri::command]
async fn navigate_webview(app: AppHandle, label: String, url: String) -> Result<(), String> {
    let parsed = url.parse::<tauri::Url>().map_err(|e| e.to_string())?;
    let app_handle = app.clone();
    app.run_on_main_thread(move || {
        if let Some(win) = app_handle.get_webview_window(&label) {
            if let Err(e) = win.navigate(parsed) {
                eprintln!("[navigate_webview] failed '{}': {}", label, e);
            }
        } else {
            eprintln!("[navigate_webview] no webview '{}'", label);
        }
    }).map_err(|e| e.to_string())
}

/// Close a WebviewWindow by label.
/// Must run on the GTK main thread on Linux.
#[tauri::command]
async fn close_webview(app: AppHandle, label: String) -> Result<(), String> {
    let app_handle = app.clone();
    app.run_on_main_thread(move || {
        if let Some(win) = app_handle.get_webview_window(&label) {
            if let Err(e) = win.close() {
                eprintln!("[close_webview] failed '{}': {}", label, e);
            }
        }
    }).map_err(|e| e.to_string())
}

/// Get the app version from Cargo.toml
#[tauri::command]
fn app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

/// Create a panel WebviewWindow, optionally injecting an ingress_session cookie
/// before the page loads so it passes HA ingress auth.
/// This enables Lovelace cards to access HA's custom element registry.
///
/// NOTE: WebviewWindowBuilder::build() must run on the main GTK/wry thread on
/// Linux. Sync Tauri commands run on a thread pool, so we dispatch via
/// run_on_main_thread to avoid a panic/crash.
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
    // Additional initialization script injected after the ingress cookie script.
    // Used by the kiosk to load the canvas view inside the HA frontend document.
    init_script: Option<String>,
) -> Result<(), String> {
    let parsed_url = url.parse::<tauri::Url>().map_err(|e| e.to_string())?;
    let app_handle = app.clone();

    app.run_on_main_thread(move || {
        let mut builder = tauri::WebviewWindowBuilder::new(
            &app_handle,
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

        if let Some(script) = init_script {
            builder = builder.initialization_script(&script);
        }

        match builder.build() {
            Err(e) => {
                eprintln!("[create_panel_webview] failed to build '{}': {}", label, e);
            }
            Ok(win) => {
                // Disable GPU/hardware acceleration for panel windows on Linux.
                // WebKitGTK GPU compositing crashes on many kiosk/embedded systems.
                #[cfg(target_os = "linux")]
                let _ = win.with_webview(|wv| {
                    use webkit2gtk::{SettingsExt, WebViewExt};
                    let wk = wv.inner();
                    if let Some(settings) = wk.settings() {
                        settings.set_hardware_acceleration_policy(
                            webkit2gtk::HardwareAccelerationPolicy::Never,
                        );
                    }
                });
            }
        }
    }).map_err(|e| e.to_string())
}

pub fn run() {
    // Set WebKit2GTK environment variables before anything initializes.
    // These must be set before the GTK/WebKit process tree starts.
    #[cfg(target_os = "linux")]
    {
        // Disable the WebKit network process sandbox — on many kiosk/embedded
        // Linux systems the sandbox prevents the WebProcess from loading any
        // resources, causing segfault + "internallyFailedLoadTimerFired" errors.
        unsafe { std::env::set_var("WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS", "1"); }
        // Disable GPU compositing — crashes on systems without proper DRI/DMA-buf.
        unsafe { std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1"); }
        // Force software rendering in the GPU process as a belt-and-suspenders.
        unsafe { std::env::set_var("LIBGL_ALWAYS_SOFTWARE", "1"); }
        // Disable JavaScriptCore JIT — JIT codegen crashes on some kiosk/embedded
        // Linux systems (seen as segfault deep in libjavascriptcoregtk-4.1.so.0).
        // JSC_useLLInt forces the stable bytecode interpreter path.
        unsafe { std::env::set_var("JSC_useLLInt", "true"); }
    }

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
            // Disable hardware acceleration for the main window on Linux.
            // WebKitGTK 2.44+ hardware compositing (GPU process + DMA-buf) crashes
            // on many kiosk/embedded systems. Software rendering is stable.
            #[cfg(target_os = "linux")]
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.with_webview(|wv| {
                    use webkit2gtk::{SettingsExt, WebViewExt};
                    let wk = wv.inner();
                    if let Some(settings) = wk.settings() {
                        settings.set_hardware_acceleration_policy(
                            webkit2gtk::HardwareAccelerationPolicy::Never,
                        );
                    }
                });
            }

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
