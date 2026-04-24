// Prevents additional console window on Windows in release — not needed on Linux
// but keeping for cross-platform consistency.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    canvas_ui_browser_linux_lib::run();
}
