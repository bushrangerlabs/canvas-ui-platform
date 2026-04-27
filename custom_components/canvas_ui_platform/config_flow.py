"""Config flow for Canvas UI Platform companion integration."""
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback

DOMAIN = "canvas_ui_platform"


class CanvasUIPlatformConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Single-step config flow — no user input needed."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        if user_input is not None:
            return self.async_create_entry(title="Canvas UI Platform", data={})
        return self.async_show_form(step_id="user", data_schema=vol.Schema({}))

    async def async_step_import(self, _):
        """Handle YAML import."""
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        return self.async_create_entry(title="Canvas UI Platform", data={})
