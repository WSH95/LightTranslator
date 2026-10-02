"""Run the shared popup interaction checks in an ephemeral WebKitGTK view."""
import json
import os
from pathlib import Path
import gi

gi.require_version('Gtk', '3.0')
gi.require_version('WebKit2', '4.1')
from gi.repository import Gtk, WebKit2, GLib

out = Path(os.environ.get('QUICK_MOVE_QA_OUTPUT', '/tmp/lighttranslator-quick-move'))
out.mkdir(parents=True, exist_ok=True)
win = Gtk.ApplicationWindow(title='Quick Move WebKit verification')
# Tao installs a client-side titlebar on Wayland before making its window
# frameless. Keep that structure here: a plain GtkWindow missed the first-result
# scrollbar/wrapping regression even with the same WebKit child.
if 'Wayland' in win.get_display().__gtype__.name:
    header = Gtk.HeaderBar(title='Quick Translate', show_close_button=True)
    event_box = Gtk.EventBox()
    event_box.set_above_child(True)
    event_box.set_visible(True)
    event_box.set_can_focus(False)
    event_box.add(header)
    win.set_titlebar(event_box)
win.set_app_paintable(True)
visual = win.get_screen().get_rgba_visual()
if visual:
    win.set_visual(visual)
if os.environ.get('QUICK_MOVE_QA_HIDDEN') == '1':
    Gtk.Widget.set_opacity(win, 0)
    win.set_skip_taskbar_hint(True)
    win.set_accept_focus(False)
    win.set_focus_on_map(False)
win.set_default_size(480, 220)
win.set_decorated(False)
win.set_resizable(False)
web = WebKit2.WebView.new_with_context(WebKit2.WebContext.new_ephemeral())
box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
win.add(box)
box.pack_start(web, True, True, 0)
manager = web.get_user_content_manager()
manager.register_script_message_handler('resize')
def resize(_manager, result):
    dimensions = json.loads(result.get_js_value().to_string())
    width, height = dimensions['width'], dimensions['height']
    win.set_size_request(width, height)
    win.resize(width, height)
manager.connect('script-message-received::resize', resize)
manager.add_script(WebKit2.UserScript.new(
    'window.nativeResize = dimensions => window.webkit.messageHandlers.resize.postMessage(JSON.stringify(dimensions));',
    WebKit2.UserContentInjectedFrames.TOP_FRAME, WebKit2.UserScriptInjectionTime.START, None, None))
code = 2

def fail(error):
    print(str(error))
    Gtk.main_quit()

def js(source, callback):
    def ready(view, result, *_):
        try:
            value = view.evaluate_javascript_finish(result).to_json(0)
            callback(json.loads(value) if value is not None else None)
        except Exception as error:
            fail(error)
    web.evaluate_javascript(source, -1, None, None, None, ready, None)

def poll():
    def received(result):
        global code
        if result is None:
            GLib.timeout_add(100, lambda: (poll(), False)[1])
        elif 'error' in result:
            fail(result['error'])
        else:
            report = {'engine': f'WebKitGTK {WebKit2.get_major_version()}.{WebKit2.get_minor_version()}.{WebKit2.get_micro_version()}', 'checks': result['checks']}
            (out / 'webkit.json').write_text(json.dumps(report, indent=2))
            print(json.dumps(report))
            code = 0 if all(c['pass'] for c in result['checks']) else 1
            def saved(view, snapshot, *_):
                try:
                    view.get_snapshot_finish(snapshot).write_to_png(str(out / 'webkit.png'))
                finally:
                    Gtk.main_quit()
            web.get_snapshot(WebKit2.SnapshotRegion.VISIBLE, WebKit2.SnapshotOptions.NONE, None, saved, None)
    js('window.qaResult ?? null', received)

def loaded(view, event):
    if event == WebKit2.LoadEvent.FINISHED:
        wait_ready()

def wait_ready():
    def checked(ready):
        if ready:
            js('window.qaResult = null; moveQa.run().then(checks => window.qaResult = {checks}, error => window.qaResult = {error: String(error)}); true', lambda _: poll())
        else:
            GLib.timeout_add(100, lambda: (wait_ready(), False)[1])
    js('!!window.moveQa', checked)

web.connect('load-changed', loaded)
web.load_uri('http://127.0.0.1:5178/tests/quick-move/fixture.html')
win.show_all()
GLib.timeout_add_seconds(60, lambda: (fail('QA timed out'), False)[1])
Gtk.main()
win.destroy()
raise SystemExit(code)
