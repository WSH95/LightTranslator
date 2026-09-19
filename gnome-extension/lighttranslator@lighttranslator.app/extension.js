/**
 * LightTranslator Quick Translate — window placement helper.
 *
 * Wayland deliberately hides global pointer coordinates from applications and
 * refuses to let them position their own toplevels, so the app cannot open its
 * quick-translate popup where the mouse is. A shell extension runs inside the
 * compositor, which knows both, so this moves the popup for it.
 *
 * Nothing else: no keybinding (GNOME's own custom shortcut starts the app), no
 * settings, no D-Bus, no panel item. On X11 the app positions the popup itself,
 * so this does nothing at all there.
 */

import Meta from 'gi://Meta';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const POPUP_TITLE = 'Quick Translate';
const WM_CLASS_FRAGMENT = 'lighttranslator';

export default class QuickTranslatePlacement extends Extension {
    enable() {
        this._sizeHandlers = new Map();

        if (!Meta.is_wayland_compositor())
            return;

        // 'map' fires for a freshly created Wayland surface and for an X11
        // window that is shown again, which is what every later hotkey press
        // produces.
        this._mapId = global.window_manager.connect('map',
            (_wm, actor) => this._onMap(actor));
    }

    disable() {
        if (this._mapId) {
            global.window_manager.disconnect(this._mapId);
            this._mapId = 0;
        }
        for (const [window, id] of this._sizeHandlers)
            window.disconnect(id);
        this._sizeHandlers.clear();
        this._sizeHandlers = null;
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

        this._moveToPointer(window);

        // The popup resizes itself once the translation arrives; keep it on
        // screen without dragging it away from the pointer.
        if (!this._sizeHandlers.has(window)) {
            const id = window.connect('size-changed', () => this._keepOnScreen(window));
            this._sizeHandlers.set(window, id);
            window.connect('unmanaging', () => this._forget(window));
        }
    }

    _forget(window) {
        const id = this._sizeHandlers?.get(window);
        if (!id)
            return;
        window.disconnect(id);
        this._sizeHandlers.delete(window);
    }

    /** Work area of the monitor the pointer is on. */
    _workArea(window) {
        return window.get_work_area_for_monitor(global.display.get_current_monitor());
    }

    _moveToPointer(window) {
        const [pointerX, pointerY] = global.get_pointer();
        const work = this._workArea(window);
        const frame = window.get_frame_rect();

        const x = Math.min(Math.max(pointerX, work.x), work.x + work.width - frame.width);
        const y = Math.min(Math.max(pointerY, work.y), work.y + work.height - frame.height);

        window.move_frame(true, Math.round(x), Math.round(y));
        window.activate(global.get_current_time());
    }

    _keepOnScreen(window) {
        const work = this._workArea(window);
        const frame = window.get_frame_rect();

        const x = Math.min(Math.max(frame.x, work.x), work.x + work.width - frame.width);
        const y = Math.min(Math.max(frame.y, work.y), work.y + work.height - frame.height);

        if (x !== frame.x || y !== frame.y)
            window.move_frame(true, Math.round(x), Math.round(y));
    }
}
