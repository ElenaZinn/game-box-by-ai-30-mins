# DesktopPetPython

Two terminal-runnable macOS desktop cat scripts. The default look uses `assets/cat_3d.png` when present, otherwise a cropped PNG/emoji cat asset; the old drawn cat remains available from the right-click menu.

## PySide version

```bash
cd /private/tmp/DesktopPetPython
python3 -m venv .venv
.venv/bin/python -m pip install PySide6
.venv/bin/python render_emoji_asset.py
./run_pyside.sh
```

## No-install fallback

```bash
cd /private/tmp/DesktopPetPython
./run_tk.sh
```

## Controls

- Drag to move.
- Click for a happy reaction.
- Double-click or right-click `Jump` to jump.
- The face and pupils track your mouse cursor.
- Right-click for Nap, Wake Up, Pause/Resume Walk, optional Keep Above All Apps, and Quit.
- Right-click `Character` to switch between available local character assets.
- `Command-Q` or `Esc` quits the Tkinter fallback.
- Auto-walk is intentionally slow: about 0.75 px per frame.
- Keep Above All Apps is off by default so the pet does not block other apps.
- Walking uses `assets/cat_walk_0.png` through `assets/cat_walk_5.png` when present. They are generated from `cat_3d.png` by `generate_walk_frames.py`.
- These frames are local image warps from one source image; a real rigged 3D model would be needed for physically correct leg motion.

## Personal Assets

To use your own local character images, put transparent PNG files in `assets/`:

- `snoopy.png`, plus optional `snoopy_walk_0.png` through `snoopy_walk_5.png`
- `miffy.png`, plus optional `miffy_walk_0.png` through `miffy_walk_5.png`

Those entries appear in the right-click `Character` menu only when the local asset exists.
