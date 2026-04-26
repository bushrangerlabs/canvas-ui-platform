// Prevents additional console window on Windows in release — not needed on Linux
// but keeping for cross-platform consistency.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // WebKitGTK workarounds for Linux kiosk environments.
    //
    // JSC JIT can crash if the process sandbox blocks mmap(PROT_EXEC) — common
    // on embedded systems, containers, or restricted seccomp profiles.
    // WEBKIT_DISABLE_DMABUF_RENDERER=1 prevents DMA-buf renderer crashes on
    // systems where hardware acceleration isn't fully supported.
    // WEBKIT_FORCE_SANDBOX=0 disables the WebKit process sandbox so JIT can
    // allocate executable memory without being blocked.
    //
    // These must be set BEFORE the GTK/WebKit libraries initialize.
    #[cfg(target_os = "linux")]
    {
        // Safety: called before any threads are spawned (single-threaded at this point)
        unsafe {
            // Disable DMA-buf renderer — crashes on many kiosk/embedded systems
            // with WebKitGTK 2.44+ where DMA-buf support is incomplete.
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");

            // Disable JSC JIT compiler. WebKitGTK 2.44–2.50 has a known crash
            // in the JIT when compiling large bundles (e.g. HA frontend) on
            // systems where executable-memory allocation is constrained.
            // The interpreter is slower but fully stable for kiosk use.
            std::env::set_var("JSC_useJIT", "0");
            std::env::set_var("JSC_useDFGJIT", "0");
            std::env::set_var("JSC_useFTLJIT", "0");
        }
    }

    canvas_ui_browser_linux_lib::run();
}
