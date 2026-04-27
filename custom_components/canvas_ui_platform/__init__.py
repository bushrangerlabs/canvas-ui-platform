"""
Canvas UI Platform — Companion HA Integration

Registers a native HA panel (embed_iframe=False) so the platform SPA runs
inside Home Assistant's own document context. This gives Lovelace card widgets
direct access to window.hass and the customElements registry — identical to
the HACS canvas-ui custom component, with no cross-realm iframe issues.

Install:
  Copy this custom_components/canvas_ui_platform/ folder into your HA
  config/custom_components/ directory and restart Home Assistant once.
  The "Canvas UI Platform" panel will appear in the sidebar automatically.
"""
import logging
import os
import time

from homeassistant.components import panel_custom
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType

_LOGGER = logging.getLogger(__name__)

DOMAIN = "canvas_ui_platform"
_PANEL_REGISTERED = False
_STATIC_REGISTERED = False


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up Canvas UI Platform companion integration."""
    _LOGGER.info("Canvas UI Platform companion integration starting up")
    await _register_static_files(hass)
    await _register_panel(hass)
    return True


async def async_setup_entry(hass, entry) -> bool:
    """Set up from a config entry (UI-configured)."""
    await _register_static_files(hass)
    await _register_panel(hass)
    return True


async def async_unload_entry(hass, entry) -> bool:
    """Unload a config entry."""
    return True


async def _register_static_files(hass: HomeAssistant) -> None:
    """Serve the panel JS from this component directory."""
    global _STATIC_REGISTERED
    if _STATIC_REGISTERED:
        return
    _STATIC_REGISTERED = True

    component_path = os.path.dirname(__file__)

    try:
        from homeassistant.components.http import StaticPathConfig
        await hass.http.async_register_static_paths([
            StaticPathConfig(
                "/canvas-ui-platform-static",
                component_path,
                cache_headers=False,
            )
        ])
        _LOGGER.info("Canvas UI Platform static files registered at /canvas-ui-platform-static")
    except (ImportError, AttributeError):
        hass.http.register_static_path(
            "/canvas-ui-platform-static",
            component_path,
            cache_headers=False,
        )
        _LOGGER.info("Canvas UI Platform static files registered (legacy)")


async def _register_panel(hass: HomeAssistant) -> None:
    """Register the Canvas UI Platform sidebar panel."""
    global _PANEL_REGISTERED
    if _PANEL_REGISTERED:
        return
    _PANEL_REGISTERED = True

    ts = int(time.time())
    module_url = f"/canvas-ui-platform-static/canvas-ui-platform-panel.js?v={ts}"

    try:
        await panel_custom.async_register_panel(
            hass,
            frontend_url_path="canvas-ui-platform",
            webcomponent_name="canvas-ui-platform-panel",
            sidebar_title="Canvas UI Platform",
            sidebar_icon="mdi:monitor-dashboard",
            module_url=module_url,
            # embed_iframe=False is critical — the panel element runs in HA's
            # own document so the SPA gets native window.hass and customElements
            embed_iframe=False,
            require_admin=False,
        )
        _LOGGER.info("Canvas UI Platform panel registered (embed_iframe=False)")
    except Exception as e:
        _LOGGER.warning("Canvas UI Platform panel registration: %s", e)
