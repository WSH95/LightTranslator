/**
 * LightTranslator Quick Translate — window placement and stacking helper.
 *
 * Wayland deliberately hides global pointer coordinates from applications and
 * refuses to let them position their own toplevels, so the app cannot open its
 * quick-translate popup where the mouse is. A shell extension runs inside the
 * compositor, which knows both, so this moves the popup and keeps it above
 * ordinary app windows.
 *
 * No keybinding (GNOME's own custom shortcut starts the app), no
 * settings, no D-Bus, no panel item. On X11 the app positions the popup itself,
 * so this does nothing at all there.
 */

import Meta from 'gi://Meta';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const POPUP_TITLE = 'Quick Translate';
const WM_CLASS_FRAGMENT = 'lighttranslator';

export default class QuickTranslatePlacement extends Extension {
    enable() {
        this._windowHandlers = new Map();

        if (!Meta.is_wayland_compositor())
            return;

        // 'map' fires for a freshly created Wayland surface and for an X11
        // window that is shown again, which is what every later hotkey press
        // produces.
        this._mapId = global.window_manager.connect('map',
            (_wm, actor) => this._onMap(actor));

        // Attaching after startup must not disturb an already moved popup.
        for (const actor of global.get_window_actors()) {
            const window = actor?.meta_window;
            if (this._isPopup(window))
                this._attach(window);
        }
    }

    disable() {
        if (this._mapId) {
            global.window_manager.disconnect(this._mapId);
            this._mapId = 0;
        }
        for (const window of this._windowHandlers.keys())
            this._forget(window);
        this._windowHandlers.clear();
        this._windowHandlers = null;
    }

    _isPopup(window) {
        if (!window)
            return false;
        const wmClass = (window.get_wm_class() ?? '').toLowerCase();
        return window.get_title() === POPUP_TITLE && wmClass.includes(WM_CLASS_FRAGMENT);
    }

    _onMap(actor) {
        const window = actor?.meta_window;
        if (!this._isPopup(window))
            return;

        this._attach(window);
        this._moveToPointer(window);
    }

    _attach(window) {
        // GTK's above hint is advisory on Wayland; set the compositor layer.
        window.make_above();

        // The popup resizes itself once the translation arrives; keep it on
        // screen on its current monitor, including after a manual move.
        if (!this._windowHandlers.has(window)) {
            const sizeId = window.connect('size-changed', () => this._keepOnScreen(window));
            const unmanageId = window.connect('unmanaging', () => this._forget(window));
            this._windowHandlers.set(window, [sizeId, unmanageId]);
        }
    }

    _forget(window) {
        const ids = this._windowHandlers?.get(window);
        if (!ids)
            return;
        for (const id of ids)
            window.disconnect(id);
        this._windowHandlers.delete(window);
    }

    _moveToPointer(window) {
        const [pointerX, pointerY] = global.get_pointer();
        const work = window.get_work_area_for_monitor(global.display.get_current_monitor());
        const frame = window.get_frame_rect();

        const x = Math.min(Math.max(pointerX, work.x), work.x + work.width - frame.width);
        const y = Math.min(Math.max(pointerY, work.y), work.y + work.height - frame.height);

        window.move_frame(true, Math.round(x), Math.round(y));
        window.activate(global.get_current_time());
    }

    _keepOnScreen(window) {
        const monitor = window.get_monitor();
        const work = window.get_work_area_for_monitor(
            monitor >= 0 ? monitor : global.display.get_current_monitor());
        const frame = window.get_frame_rect();

        const x = Math.min(Math.max(frame.x, work.x), work.x + work.width - frame.width);
        const y = Math.min(Math.max(frame.y, work.y), work.y + work.height - frame.height);

        if (x !== frame.x || y !== frame.y)
            window.move_frame(true, Math.round(x), Math.round(y));
    }
}
