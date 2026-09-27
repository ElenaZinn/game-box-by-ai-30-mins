import math
import os
import random
import tkinter as tk


class DesktopPet:
    def __init__(self):
        self.root = tk.Tk()
        self.root.overrideredirect(True)
        self.root.attributes("-topmost", False)
        self.root.attributes("-transparent", True)
        self.root.configure(bg="systemTransparent")

        self.width = 180
        self.height = 210
        self.canvas = tk.Canvas(
            self.root,
            width=self.width,
            height=self.height,
            highlightthickness=0,
            bg="systemTransparent",
        )
        self.canvas.pack()

        self.phase = 0.0
        self.direction = 1
        self.speed = 0.75
        self.walk_x = None
        self.walking = True
        self.mood = "idle"
        self.mood_ticks = 0
        self.drag_offset = None
        self.was_dragged = False
        self.jump_velocity = 0.0
        self.jump_offset = 0.0
        self.ground_y = None
        self.gaze_x = 0.0
        self.gaze_y = 0.0
        self.character_key = "cat"
        self.sprite = None
        self.walk_frames = []
        self.asset_mode = True
        self.keep_above = False
        self.topmost_tick = 0

        self._place_near_bottom()
        self.set_character("cat")
        self._bind_events()
        self._tick()

    def _asset_path(self, filename):
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", filename)

    def _character_defs(self):
        return [
            {"key": "cat", "label": "Cat", "idle": ("cat_3d.png", "cat_emoji.png"), "walk_prefix": "cat_walk"},
            {"key": "snoopy", "label": "Snoopy (local asset)", "idle": ("snoopy.png", "snoopy_idle.png"), "walk_prefix": "snoopy_walk"},
            {"key": "miffy", "label": "Miffy (local asset)", "idle": ("miffy.png", "miffy_idle.png"), "walk_prefix": "miffy_walk"},
        ]

    def _character_def(self, key):
        for definition in self._character_defs():
            if definition["key"] == key:
                return definition
        return self._character_defs()[0]

    def _has_sprite_asset(self, definition):
        return any(os.path.exists(self._asset_path(filename)) for filename in definition["idle"])

    def _load_sprite(self, filenames):
        for filename in filenames:
            path = self._asset_path(filename)
            if not os.path.exists(path):
                continue
            try:
                image = tk.PhotoImage(file=path)
                factor = max(1, round(image.width() / 170))
                return image.subsample(factor, factor)
            except tk.TclError:
                continue
        return None

    def _load_walk_frames(self, prefix):
        frames = []
        for i in range(6):
            path = self._asset_path(f"{prefix}_{i}.png")
            if not os.path.exists(path):
                return []
            try:
                image = tk.PhotoImage(file=path)
                factor = max(1, round(image.width() / 170))
                frames.append(image.subsample(factor, factor))
            except tk.TclError:
                return []
        return frames

    def set_character(self, key):
        definition = self._character_def(key)
        if not self._has_sprite_asset(definition):
            return
        self.character_key = definition["key"]
        self.sprite = self._load_sprite(definition["idle"])
        self.walk_frames = self._load_walk_frames(definition["walk_prefix"])
        self.asset_mode = True

    def _place_near_bottom(self):
        self.root.update_idletasks()
        screen_w = self.root.winfo_screenwidth()
        screen_h = self.root.winfo_screenheight()
        x = screen_w // 2 - self.width // 2
        y = screen_h - self.height - 80
        self.ground_y = y
        self.walk_x = float(x)
        self.root.geometry(f"{self.width}x{self.height}+{x}+{y}")

    def _bind_events(self):
        self.canvas.bind("<ButtonPress-1>", self._mouse_down)
        self.canvas.bind("<B1-Motion>", self._mouse_drag)
        self.canvas.bind("<ButtonRelease-1>", self._mouse_up)
        self.canvas.bind("<Double-Button-1>", lambda event: self.jump())
        self.canvas.bind("<Button-2>", self._show_menu)
        self.canvas.bind("<Button-3>", self._show_menu)
        self.root.bind("<Command-q>", lambda event: self.root.destroy())
        self.root.bind("<Escape>", lambda event: self.root.destroy())

    def _tick(self):
        self.phase += 0.14
        self.topmost_tick += 1
        self._update_gaze()
        if self.mood_ticks > 0:
            self.mood_ticks -= 1
            if self.mood_ticks == 0:
                self.mood = "idle"

        if self.jump_velocity or self.jump_offset:
            self.jump_offset += self.jump_velocity
            self.jump_velocity += 1.25
            if self.jump_offset >= 0:
                self.jump_offset = 0
                self.jump_velocity = 0
                self.set_mood("happy", 22)
            self.root.geometry(f"+{self.root.winfo_x()}+{int(self.ground_y + self.jump_offset)}")
        elif self.walking and self.mood != "sleepy" and self.drag_offset is None:
            self._walk()

        self._draw()
        if self.keep_above and self.topmost_tick % 5 == 0:
            self.root.attributes("-topmost", True)
            self.root.lift()
        self.root.after(33, self._tick)

    def _update_gaze(self):
        center_x = self.root.winfo_x() + self.width / 2
        center_y = self.root.winfo_y() + self.height / 2
        dx = self.root.winfo_pointerx() - center_x
        dy = self.root.winfo_pointery() - center_y
        distance = max(1.0, math.hypot(dx, dy))
        target_x = max(-1.0, min(1.0, dx / distance))
        target_y = max(-1.0, min(1.0, dy / distance))
        self.gaze_x += (target_x - self.gaze_x) * 0.18
        self.gaze_y += (target_y - self.gaze_y) * 0.18

    def _walk(self):
        if self.walk_x is None:
            self.walk_x = float(self.root.winfo_x())
        x = self.walk_x + self.speed * self.direction
        screen_w = self.root.winfo_screenwidth()
        if x <= 8:
            x = 8
            self.direction = 1
        elif x + self.width >= screen_w - 8:
            x = screen_w - self.width - 8
            self.direction = -1
        self.walk_x = x
        self.root.geometry(f"+{round(x)}+{self.root.winfo_y()}")

    def set_mood(self, mood, ticks=50):
        self.mood = mood
        self.mood_ticks = ticks

    def jump(self):
        if self.jump_velocity or self.jump_offset:
            return
        self.ground_y = self.root.winfo_y()
        self.jump_velocity = -17
        self.jump_offset = -1
        self.set_mood("happy", 70)

    def nap(self):
        self.set_mood("sleepy", 10**9)

    def wake_up(self):
        self.set_mood("happy", 50)

    def toggle_walk(self):
        self.walking = not self.walking

    def _mouse_down(self, event):
        self.drag_offset = (event.x_root - self.root.winfo_x(), event.y_root - self.root.winfo_y())
        self.was_dragged = False

    def _mouse_drag(self, event):
        if self.drag_offset is None:
            return
        x = event.x_root - self.drag_offset[0]
        y = event.y_root - self.drag_offset[1]
        if abs(x - self.root.winfo_x()) + abs(y - self.root.winfo_y()) > 4:
            self.was_dragged = True
        self.root.geometry(f"+{x}+{y}")
        self.walk_x = float(x)
        if not self.jump_velocity:
            self.ground_y = y

    def _mouse_up(self, event):
        if not self.was_dragged:
            self.set_mood("happy", 42)
        self.drag_offset = None
        self.was_dragged = False

    def _show_menu(self, event):
        menu = tk.Menu(self.root, tearoff=0)
        menu.add_command(label="Jump", command=self.jump)
        menu.add_command(label="Nap", command=self.nap)
        menu.add_command(label="Wake Up", command=self.wake_up)
        menu.add_separator()
        menu.add_command(label="Pause Walk" if self.walking else "Resume Walk", command=self.toggle_walk)
        menu.add_checkbutton(label="Keep Above All Apps", command=self.toggle_keep_above, onvalue=True, offvalue=False)
        menu.add_command(label="Classic Drawn Cat" if self.asset_mode else "Image Cat", command=self.toggle_style)
        character_menu = tk.Menu(menu, tearoff=0)
        for definition in self._character_defs():
            available = self._has_sprite_asset(definition)
            label = definition["label"] if available else f"{definition['label']} - add asset"
            character_menu.add_command(
                label=label,
                state=tk.NORMAL if available else tk.DISABLED,
                command=lambda selected=definition["key"]: self.set_character(selected),
            )
        menu.add_cascade(label="Character", menu=character_menu)
        menu.add_separator()
        menu.add_command(label="Quit", command=self.root.destroy)
        menu.tk_popup(event.x_root, event.y_root)

    def toggle_keep_above(self):
        self.keep_above = not self.keep_above
        self.root.attributes("-topmost", self.keep_above)
        if self.keep_above:
            self.root.lift()

    def toggle_style(self):
        self.asset_mode = not self.asset_mode

    def _draw(self):
        c = self.canvas
        c.delete("all")
        bounce = math.sin(self.phase) * 5 if self.mood != "sleepy" else 0
        ear = math.sin(self.phase * 1.5) * 4
        asset_step = abs(math.sin(self.phase * 2.2)) if self.walking and self.mood != "sleepy" else 0

        if self.asset_mode:
            shadow_width = 104 + asset_step * 10
            c.create_oval(90 - shadow_width / 2, 188, 90 + shadow_width / 2, 200, fill="#000000", outline="", stipple="gray50")
        else:
            c.create_oval(36, 172 - bounce * 0.25, 144, 191 - bounce * 0.25, fill="#000000", outline="", stipple="gray50")

        if self.asset_mode:
            c.create_oval(36, 184, 66, 191, fill="#3c2d2a", outline="", stipple="gray50")
            c.create_oval(114, 184, 144, 191, fill="#3c2d2a", outline="", stipple="gray50")
            sprite = self.sprite
            if self.walk_frames and self.walking and self.mood != "sleepy" and self.drag_offset is None and not self.jump_velocity:
                sprite = self.walk_frames[int(self.phase * 2.2) % len(self.walk_frames)]
            if sprite:
                c.create_image(90, 108, image=sprite)
            else:
                c.create_text(90, 108, text="🐈", font=("Apple Color Emoji", 110))
            self._bubble()
            return

        self._tail(bounce)
        self._ear(54, 60 + bounce, -18 - ear)
        self._ear(126, 60 + bounce, 18 + ear)

        c.create_oval(32, 42 + bounce, 148, 168 + bounce, fill="#ffd2b5", outline="#d5978b", width=2)
        c.create_oval(61, 106 + bounce, 119, 154 + bounce, fill="#fff3ea", outline="")
        c.create_oval(44, 153 + bounce * 0.3, 78, 176 + bounce * 0.3, fill="#ee9484", outline="")
        c.create_oval(102, 153 - bounce * 0.15, 136, 176 - bounce * 0.15, fill="#ee9484", outline="")
        self._face(bounce)
        self._bubble()

    def _ear(self, x, y, degrees):
        offset = degrees / 3
        self.canvas.create_polygon(
            x,
            y - 35,
            x - 25 + offset,
            y + 17,
            x + 25 + offset,
            y + 17,
            fill="#efa692",
            outline="#d5978b",
            width=2,
        )
        self.canvas.create_polygon(
            x,
            y - 19,
            x - 13 + offset,
            y + 10,
            x + 13 + offset,
            y + 10,
            fill="#ffbeb8",
            outline="",
        )

    def _tail(self, bounce):
        coords = (
            134,
            130 + bounce,
            171,
            123 + bounce,
            164,
            80 + bounce,
            137,
            92 + bounce,
        )
        self.canvas.create_line(*coords, smooth=True, width=17, fill="#d5978b", capstyle=tk.ROUND)
        self.canvas.create_line(*coords, smooth=True, width=13, fill="#ffd2b5", capstyle=tk.ROUND)

    def _face(self, bounce):
        closed = self.mood == "sleepy" or int(self.phase * 2) % 45 == 0
        face_dx = self.gaze_x * 4
        face_dy = self.gaze_y * 3
        for x in (65, 115):
            if closed:
                self.canvas.create_arc(
                    x - 10 + face_dx,
                    91 + bounce + face_dy,
                    x + 10 + face_dx,
                    103 + bounce + face_dy,
                    start=200,
                    extent=140,
                    style=tk.ARC,
                    outline="#462c2d",
                    width=3,
                )
            else:
                self.canvas.create_oval(x - 8 + face_dx, 88 + bounce + face_dy, x + 8 + face_dx, 106 + bounce + face_dy, fill="#fff8da", outline="")
                self.canvas.create_oval(
                    x - 5 + face_dx + self.gaze_x * 3,
                    91 + bounce + face_dy + self.gaze_y * 3,
                    x + 5 + face_dx + self.gaze_x * 3,
                    104 + bounce + face_dy + self.gaze_y * 3,
                    fill="#79ab60",
                    outline="",
                )
                self.canvas.create_oval(
                    x - 2 + face_dx + self.gaze_x * 4,
                    91 + bounce + face_dy + self.gaze_y * 3.5,
                    x + 2 + face_dx + self.gaze_x * 4,
                    104 + bounce + face_dy + self.gaze_y * 3.5,
                    fill="#23181a",
                    outline="",
                )
                self.canvas.create_oval(
                    x + 1 + face_dx + self.gaze_x * 2,
                    92 + bounce + face_dy + self.gaze_y * 2,
                    x + 5 + face_dx + self.gaze_x * 2,
                    97 + bounce + face_dy + self.gaze_y * 2,
                    fill="#ffffff",
                    outline="",
                )

        self.canvas.create_oval(84 + face_dx, 113 + bounce + face_dy, 96 + face_dx, 121 + bounce + face_dy, fill="#462c2d", outline="")
        if self.mood == "sleepy":
            self.canvas.create_line(78 + face_dx, 134 + bounce + face_dy, 102 + face_dx, 134 + bounce + face_dy, fill="#462c2d", width=3, capstyle=tk.ROUND)
        else:
            self.canvas.create_line(90 + face_dx, 121 + bounce + face_dy, 90 + face_dx, 127 + bounce + face_dy, fill="#462c2d", width=3, capstyle=tk.ROUND)
            self.canvas.create_line(90 + face_dx, 127 + bounce + face_dy, 84 + face_dx, 137 + bounce + face_dy, 76 + face_dx, 130 + bounce + face_dy, smooth=True, fill="#462c2d", width=3, capstyle=tk.ROUND)
            self.canvas.create_line(90 + face_dx, 127 + bounce + face_dy, 96 + face_dx, 137 + bounce + face_dy, 104 + face_dx, 130 + bounce + face_dy, smooth=True, fill="#462c2d", width=3, capstyle=tk.ROUND)

        for y, lift in ((115, -1), (123, 0), (131, 1)):
            self.canvas.create_line(40 + face_dx, y + bounce + face_dy + lift, 75 + face_dx, y + bounce + face_dy, fill="#462c2d", width=2, capstyle=tk.ROUND)
            self.canvas.create_line(105 + face_dx, y + bounce + face_dy, 140 + face_dx, y + bounce + face_dy + lift, fill="#462c2d", width=2, capstyle=tk.ROUND)

        self.canvas.create_oval(42 + face_dx * 0.7, 124 + bounce + face_dy * 0.7, 63 + face_dx * 0.7, 134 + bounce + face_dy * 0.7, fill="#ff8f99", outline="")
        self.canvas.create_oval(117 + face_dx * 0.7, 124 + bounce + face_dy * 0.7, 138 + face_dx * 0.7, 134 + bounce + face_dy * 0.7, fill="#ff8f99", outline="")

    def _bubble(self):
        if self.mood == "happy":
            text = random.choice(("Hi!", "Yay!", "Boing!")) if self.jump_velocity else "Hi!"
        elif self.mood == "sleepy":
            text = "Zzz"
        else:
            return
        self.canvas.create_oval(118, 24, 168, 52, fill="#ffffff", outline="#eeeeee")
        self.canvas.create_text(143, 38, text=text, fill="#462c2d", font=("Helvetica", 12, "bold"))

    def run(self):
        self.root.mainloop()


if __name__ == "__main__":
    DesktopPet().run()
