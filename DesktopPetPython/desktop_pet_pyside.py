import math
import os
import random
import sys
import ctypes
import ctypes.util

from PySide6.QtCore import QRectF, Qt, QTimer
from PySide6.QtGui import QAction, QColor, QCursor, QFont, QPainter, QPainterPath, QPen, QPixmap
from PySide6.QtWidgets import QApplication, QMenu, QWidget


class DesktopPet(QWidget):
    def __init__(self):
        super().__init__()
        self.phase = 0.0
        self.direction = 1
        self.speed = 0.75
        self.walk_x = None
        self.walking = True
        self.mood = "idle"
        self.mood_ticks = 0
        self.drag_offset = None
        self.was_dragged = False
        self.scale_factor = 1.0
        self.jump_velocity = 0.0
        self.jump_offset = 0.0
        self.on_ground_y = None
        self.gaze_x = 0.0
        self.gaze_y = 0.0
        self.character_key = "cat"
        self.sprite = QPixmap()
        self.walk_frames = []
        self.asset_mode = True
        self.keep_above = False
        self.topmost_tick = 0
        self.macos_level_applied = False

        self.setWindowFlags(
            Qt.FramelessWindowHint
            | Qt.Tool
            | Qt.NoDropShadowWindowHint
        )
        self.setAttribute(Qt.WA_ShowWithoutActivating, True)
        self.setAttribute(Qt.WA_TranslucentBackground, True)
        self.setMouseTracking(True)
        self.resize(180, 210)
        self._place_near_bottom()
        self.set_character("cat")

        self.timer = QTimer(self)
        self.timer.timeout.connect(self.tick)
        self.timer.start(33)

    def _place_near_bottom(self):
        screen = QApplication.primaryScreen().availableGeometry()
        x = screen.center().x() - self.width() // 2
        y = screen.bottom() - self.height() - 36
        self.on_ground_y = y
        self.walk_x = float(x)
        self.move(x, y)

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
            sprite = QPixmap(self._asset_path(filename))
            if not sprite.isNull():
                return sprite
        return QPixmap()

    def _load_walk_frames(self, prefix):
        frames = []
        for i in range(6):
            sprite = QPixmap(self._asset_path(f"{prefix}_{i}.png"))
            if sprite.isNull():
                return []
            frames.append(sprite)
        return frames

    def set_character(self, key):
        definition = self._character_def(key)
        if not self._has_sprite_asset(definition):
            return
        self.character_key = definition["key"]
        self.sprite = self._load_sprite(definition["idle"])
        self.walk_frames = self._load_walk_frames(definition["walk_prefix"])
        self.asset_mode = True
        self.update()

    def tick(self):
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
                self.mood = "happy"
                self.mood_ticks = 24
            self.move(self.x(), int(self.on_ground_y + self.jump_offset))
        elif self.walking and self.mood != "sleepy" and not self.drag_offset:
            self._walk()

        self.update()
        if self.topmost_tick % 5 == 0:
            self._keep_window_above()

    def _keep_window_above(self):
        if not self.keep_above:
            return
        if sys.platform == "darwin" and not self.macos_level_applied:
            self.macos_level_applied = self._apply_macos_window_level(25)
        self.raise_()

    def _apply_macos_window_level(self, level):
        try:
            objc_path = ctypes.util.find_library("objc")
            if not objc_path:
                return False
            objc = ctypes.cdll.LoadLibrary(objc_path)
            objc.sel_registerName.argtypes = [ctypes.c_char_p]
            objc.sel_registerName.restype = ctypes.c_void_p

            def selector(name):
                return objc.sel_registerName(name.encode("utf-8"))

            send_id = ctypes.CFUNCTYPE(
                ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p
            )(("objc_msgSend", objc))
            send_void_long = ctypes.CFUNCTYPE(
                None, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_long
            )(("objc_msgSend", objc))
            send_void_bool = ctypes.CFUNCTYPE(
                None, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_bool
            )(("objc_msgSend", objc))

            view = ctypes.c_void_p(int(self.winId()))
            window = send_id(view, selector("window"))
            if not window:
                return False

            can_join_all_spaces = 1
            stationary = 16
            fullscreen_auxiliary = 256
            send_void_long(window, selector("setLevel:"), level)
            send_void_long(
                window,
                selector("setCollectionBehavior:"),
                can_join_all_spaces | stationary | fullscreen_auxiliary,
            )
            send_void_bool(window, selector("setHidesOnDeactivate:"), False)
            return True
        except Exception:
            return False

    def _update_gaze(self):
        cursor = QCursor.pos()
        center = self.frameGeometry().center()
        dx = cursor.x() - center.x()
        dy = cursor.y() - center.y()
        distance = max(1.0, math.hypot(dx, dy))
        target_x = max(-1.0, min(1.0, dx / distance))
        target_y = max(-1.0, min(1.0, dy / distance))
        self.gaze_x += (target_x - self.gaze_x) * 0.18
        self.gaze_y += (target_y - self.gaze_y) * 0.18

    def _walk(self):
        screen = QApplication.screenAt(self.frameGeometry().center()) or QApplication.primaryScreen()
        area = screen.availableGeometry()
        if self.walk_x is None:
            self.walk_x = float(self.x())
        next_x = self.walk_x + self.speed * self.direction
        if next_x <= area.left() + 8:
            next_x = area.left() + 8
            self.direction = 1
        elif next_x + self.width() >= area.right() - 8:
            next_x = area.right() - self.width() - 8
            self.direction = -1
        self.walk_x = next_x
        self.move(round(next_x), self.y())

    def set_mood(self, mood, ticks=50):
        self.mood = mood
        self.mood_ticks = ticks
        self.update()

    def jump(self):
        if self.jump_velocity or self.jump_offset:
            return
        self.on_ground_y = self.y()
        self.jump_velocity = -17
        self.jump_offset = -1
        self.set_mood("happy", ticks=70)

    def nap(self):
        self.set_mood("sleepy", ticks=10**9)

    def wake_up(self):
        self.set_mood("happy", ticks=50)

    def toggle_walk(self):
        self.walking = not self.walking

    def resize_pet(self, delta):
        self.scale_factor = min(1.5, max(0.72, self.scale_factor + delta))
        old_center = self.frameGeometry().center()
        self.resize(int(180 * self.scale_factor), int(210 * self.scale_factor))
        self.move(old_center.x() - self.width() // 2, old_center.y() - self.height() // 2)
        self.on_ground_y = self.y()
        self.walk_x = float(self.x())

    def contextMenuEvent(self, event):
        menu = QMenu(self)
        menu.addAction("Jump", self.jump)
        menu.addAction("Nap", self.nap)
        menu.addAction("Wake Up", self.wake_up)
        menu.addSeparator()

        walk_action = QAction("Pause Walk" if self.walking else "Resume Walk", self)
        walk_action.triggered.connect(self.toggle_walk)
        menu.addAction(walk_action)

        top_action = QAction("Keep Above All Apps", self)
        top_action.setCheckable(True)
        top_action.setChecked(self.keep_above)
        top_action.triggered.connect(self.toggle_keep_above)
        menu.addAction(top_action)

        style_action = QAction("Classic Drawn Cat" if self.asset_mode else "Image Cat", self)
        style_action.triggered.connect(self.toggle_style)
        menu.addAction(style_action)

        character_menu = menu.addMenu("Character")
        for definition in self._character_defs():
            available = self._has_sprite_asset(definition)
            label = definition["label"] if available else f"{definition['label']} - add asset"
            action = QAction(label, self)
            action.setCheckable(True)
            action.setChecked(self.character_key == definition["key"])
            action.setEnabled(available)
            selected = definition["key"]
            action.triggered.connect(lambda checked=False, key=selected: self.set_character(key))
            character_menu.addAction(action)

        menu.addAction("Smaller", lambda: self.resize_pet(-0.1))
        menu.addAction("Larger", lambda: self.resize_pet(0.1))
        menu.addSeparator()
        menu.addAction("Quit", QApplication.quit)
        menu.exec(event.globalPos())

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self.drag_offset = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
            self.was_dragged = False

    def toggle_style(self):
        self.asset_mode = not self.asset_mode
        self.update()

    def toggle_keep_above(self):
        self.keep_above = not self.keep_above
        self.macos_level_applied = False
        if self.keep_above:
            self.setWindowFlag(Qt.WindowStaysOnTopHint, True)
            self.show()
            self._keep_window_above()
        else:
            self.setWindowFlag(Qt.WindowStaysOnTopHint, False)
            if sys.platform == "darwin":
                self._apply_macos_window_level(0)
            self.show()

    def mouseMoveEvent(self, event):
        if self.drag_offset and event.buttons() & Qt.LeftButton:
            next_pos = event.globalPosition().toPoint() - self.drag_offset
            if (next_pos - self.pos()).manhattanLength() > 4:
                self.was_dragged = True
            self.move(next_pos)
            self.walk_x = float(next_pos.x())
            if not self.jump_velocity:
                self.on_ground_y = self.y()

    def mouseReleaseEvent(self, event):
        if event.button() == Qt.LeftButton:
            if not self.was_dragged:
                self.set_mood("happy", ticks=42)
            self.drag_offset = None
            self.was_dragged = False

    def mouseDoubleClickEvent(self, event):
        if event.button() == Qt.LeftButton:
            self.jump()

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing, True)
        painter.setPen(Qt.NoPen)

        unit = min(self.width() / 180.0, self.height() / 210.0)
        painter.translate(self.width() / 2.0, self.height() / 2.0)
        painter.scale(unit, unit)
        painter.translate(-90, -105)

        self._draw_shadow(painter)
        if self.asset_mode:
            self._draw_sprite_pet(painter)
        else:
            self._draw_pet(painter)
        self._draw_bubble(painter)

    def _draw_shadow(self, painter):
        if self.asset_mode:
            step = abs(math.sin(self.phase * 2.2)) if self.walking and self.mood != "sleepy" else 0
            width = 104 + step * 6
            painter.setBrush(QColor(0, 0, 0, 42))
            painter.drawEllipse(QRectF(90 - width / 2, 188, width, 12))
            return

        bounce = math.sin(self.phase) * 3
        painter.setBrush(QColor(0, 0, 0, 38))
        painter.drawEllipse(QRectF(36, 181 - bounce * 0.18, 108, 18))

    def _draw_sprite_pet(self, painter):
        is_walking = self.walking and self.mood != "sleepy" and not self.drag_offset and not self.jump_velocity
        step = math.sin(self.phase * 2.2) if is_walking else 0
        foot_pressure = abs(step)
        squash = 1.0
        if self.jump_offset > -5 and self.jump_velocity > 0:
            squash = 0.94

        painter.save()
        painter.translate(90, 108)
        if self.direction > 0:
            painter.scale(-1, 1)
        painter.scale(1.0 / squash, squash)

        painter.setPen(Qt.NoPen)
        painter.setBrush(QColor(60, 45, 42, 32 + int(foot_pressure * 18)))
        painter.drawEllipse(QRectF(-54 + step * 2, 76, 30, 7))
        painter.drawEllipse(QRectF(18 - step * 2, 76, 30, 7))

        sprite = self.sprite
        if is_walking and self.walk_frames:
            sprite = self.walk_frames[int(self.phase * 2.2) % len(self.walk_frames)]

        if not sprite.isNull():
            ratio = sprite.width() / max(1, sprite.height())
            sprite_h = 168.0
            sprite_w = sprite_h * ratio
            if sprite_w > 176:
                sprite_w = 176.0
                sprite_h = sprite_w / ratio
            target = QRectF(-sprite_w / 2, 88 - sprite_h, sprite_w, sprite_h)
            painter.drawPixmap(target, sprite, QRectF(sprite.rect()))
        else:
            font = QFont("Apple Color Emoji", 112)
            painter.setFont(font)
            painter.drawText(QRectF(-90, -95, 180, 190), Qt.AlignCenter, "🐈")

        painter.restore()

    def _draw_pet(self, painter):
        bounce = math.sin(self.phase) * 5 if self.mood != "sleepy" else 0
        squash = 1.0
        if self.jump_offset > -5 and self.jump_velocity > 0:
            squash = 0.94

        painter.save()
        painter.translate(90, 116 + bounce)
        painter.scale(1.0 / squash, squash)
        painter.translate(-90, -116)

        self._draw_tail(painter)
        self._draw_ear(painter, 54, 60, -18 - math.sin(self.phase * 1.5) * 4)
        self._draw_ear(painter, 126, 60, 18 + math.sin(self.phase * 1.5) * 4)

        body = QRectF(32, 56, 116, 126)
        painter.setBrush(QColor(255, 210, 181))
        painter.setPen(QPen(QColor(155, 87, 76, 90), 2))
        painter.drawEllipse(body)

        painter.setPen(Qt.NoPen)
        painter.setBrush(QColor(255, 255, 255, 140))
        painter.drawEllipse(QRectF(61, 126, 58, 48))

        painter.setBrush(QColor(238, 148, 132))
        painter.drawEllipse(QRectF(44, 168, 34, 23))
        painter.drawEllipse(QRectF(102, 168, 34, 23))

        self._draw_face(painter)
        painter.restore()

    def _draw_ear(self, painter, x, y, degrees):
        painter.save()
        painter.translate(x, y)
        painter.rotate(degrees)

        outer = QPainterPath()
        outer.moveTo(0, -35)
        outer.lineTo(-25, 17)
        outer.quadTo(0, 29, 25, 17)
        outer.closeSubpath()
        painter.setPen(QPen(QColor(155, 87, 76, 75), 2))
        painter.setBrush(QColor(239, 166, 146))
        painter.drawPath(outer)

        inner = QPainterPath()
        inner.moveTo(0, -19)
        inner.lineTo(-13, 10)
        inner.quadTo(0, 16, 13, 10)
        inner.closeSubpath()
        painter.setPen(Qt.NoPen)
        painter.setBrush(QColor(255, 190, 184))
        painter.drawPath(inner)
        painter.restore()

    def _draw_tail(self, painter):
        tail = QPainterPath()
        tail.moveTo(134, 139)
        tail.cubicTo(171, 132, 164, 84, 137, 96)

        outline = QPen(QColor(155, 87, 76, 70), 17)
        outline.setCapStyle(Qt.RoundCap)
        outline.setJoinStyle(Qt.RoundJoin)
        painter.setPen(outline)
        painter.setBrush(Qt.NoBrush)
        painter.drawPath(tail)

        pen = QPen(QColor(255, 210, 181), 13)
        pen.setCapStyle(Qt.RoundCap)
        pen.setJoinStyle(Qt.RoundJoin)
        painter.setPen(pen)
        painter.drawPath(tail)

    def _draw_face(self, painter):
        sleepy = self.mood == "sleepy"
        blink = int(self.phase * 2) % 45 == 0
        face_dx = self.gaze_x * 4
        face_dy = self.gaze_y * 3
        self._draw_eye(painter, 65 + face_dx, 108 + face_dy, sleepy or blink)
        self._draw_eye(painter, 115 + face_dx, 108 + face_dy, sleepy or blink)

        painter.setBrush(QColor(70, 44, 45))
        painter.setPen(Qt.NoPen)
        painter.drawEllipse(QRectF(84 + face_dx, 124 + face_dy, 12, 8))

        pen = QPen(QColor(70, 44, 45), 3)
        pen.setCapStyle(Qt.RoundCap)
        painter.setPen(pen)
        painter.setBrush(Qt.NoBrush)
        mouth = QPainterPath()
        if sleepy:
            mouth.moveTo(78 + face_dx, 140 + face_dy)
            mouth.lineTo(102 + face_dx, 140 + face_dy)
        else:
            mouth.moveTo(90 + face_dx, 132 + face_dy)
            mouth.lineTo(90 + face_dx, 137 + face_dy)
            mouth.moveTo(90 + face_dx, 137 + face_dy)
            mouth.cubicTo(86 + face_dx, 146 + face_dy, 78 + face_dx, 146 + face_dy, 75 + face_dx, 138 + face_dy)
            mouth.moveTo(90 + face_dx, 137 + face_dy)
            mouth.cubicTo(94 + face_dx, 146 + face_dy, 102 + face_dx, 146 + face_dy, 105 + face_dx, 138 + face_dy)
        painter.drawPath(mouth)

        whisker_pen = QPen(QColor(70, 44, 45, 190), 2)
        whisker_pen.setCapStyle(Qt.RoundCap)
        painter.setPen(whisker_pen)
        for y, lift in ((124, -6), (131, 0), (138, 6)):
            whisker_tip_y = round(y + lift * 0.15)
            painter.drawLine(41 + round(face_dx), whisker_tip_y + round(face_dy), 75 + round(face_dx), y + round(face_dy))
            painter.drawLine(105 + round(face_dx), y + round(face_dy), 139 + round(face_dx), whisker_tip_y + round(face_dy))

        painter.setPen(Qt.NoPen)
        painter.setBrush(QColor(255, 96, 108, 90 if self.mood == "happy" else 56))
        painter.drawEllipse(QRectF(42 + face_dx * 0.7, 128 + face_dy * 0.7, 21, 10))
        painter.drawEllipse(QRectF(117 + face_dx * 0.7, 128 + face_dy * 0.7, 21, 10))

    def _draw_eye(self, painter, x, y, closed):
        if closed:
            pen = QPen(QColor(70, 44, 45), 3)
            pen.setCapStyle(Qt.RoundCap)
            painter.setPen(pen)
            painter.setBrush(Qt.NoBrush)
            path = QPainterPath()
            path.moveTo(x - 9, y)
            path.cubicTo(x - 4, y + 5, x + 4, y + 5, x + 9, y)
            painter.drawPath(path)
            return

        painter.setPen(Qt.NoPen)
        painter.setBrush(QColor(255, 248, 218))
        painter.drawEllipse(QRectF(x - 8, y - 9, 16, 18))
        painter.setBrush(QColor(121, 171, 96))
        painter.drawEllipse(QRectF(x - 5 + self.gaze_x * 3, y - 6 + self.gaze_y * 3, 10, 13))
        painter.setBrush(QColor(35, 24, 26))
        painter.drawEllipse(QRectF(x - 2 + self.gaze_x * 4, y - 6 + self.gaze_y * 3.5, 4, 13))
        painter.setBrush(QColor(255, 255, 255, 230))
        painter.drawEllipse(QRectF(x + 1 + self.gaze_x * 2, y - 4 + self.gaze_y * 2, 4, 5))

    def _draw_bubble(self, painter):
        text = None
        if self.mood == "happy":
            text = random.choice(("Hi!", "Yay!", "Boing!")) if self.jump_velocity else "Hi!"
        elif self.mood == "sleepy":
            text = "Zzz"
        if not text:
            return

        rect = QRectF(118, 26, 50, 28)
        painter.setPen(QPen(QColor(0, 0, 0, 24), 1))
        painter.setBrush(QColor(255, 255, 255, 226))
        painter.drawRoundedRect(rect, 14, 14)
        painter.setPen(QColor(70, 44, 45))
        painter.setFont(QFont("Helvetica", 12, QFont.Bold))
        painter.drawText(rect, Qt.AlignCenter, text)


def main():
    app = QApplication(sys.argv)
    pet = DesktopPet()
    pet.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
