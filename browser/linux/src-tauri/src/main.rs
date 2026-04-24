// Prevents additional console window on Windows in release — not needed on Linux
// but keeping for cross-platform consistency.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod lib;

fn main() {
    lib::run();
}
