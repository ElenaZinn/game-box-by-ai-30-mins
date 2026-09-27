import os
import sys

from PySide6.QtCore import QRect, QRectF, Qt
from PySide6.QtGui import QColor, QFont, QImage, QPainter
from PySide6.QtWidgets import QApplication


def main():
    app = QApplication.instance() or QApplication(sys.argv)
    del app

    root = os.path.dirname(os.path.abspath(__file__))
    assets_dir = os.path.join(root, "assets")
    os.makedirs(assets_dir, exist_ok=True)
    out = os.path.join(assets_dir, "cat_emoji.png")

    image = QImage(512, 512, QImage.Format_ARGB32_Premultiplied)
    image.fill(QColor(0, 0, 0, 0))

    painter = QPainter(image)
    painter.setRenderHint(QPainter.Antialiasing, True)
    painter.setRenderHint(QPainter.TextAntialiasing, True)
    painter.setFont(QFont("Apple Color Emoji", 320))
    painter.drawText(QRectF(18, 18, 476, 476), Qt.AlignCenter, "🐈")
    painter.end()

    cropped = crop_alpha(image, padding=8)
    if not cropped.save(out):
        raise SystemExit(f"Failed to save {out}")
    print(out)


def crop_alpha(image, padding=0):
    min_x = image.width()
    min_y = image.height()
    max_x = -1
    max_y = -1

    for y in range(image.height()):
        for x in range(image.width()):
            if image.pixelColor(x, y).alpha() > 0:
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)

    if max_x < min_x or max_y < min_y:
        return image

    min_x = max(0, min_x - padding)
    min_y = max(0, min_y - padding)
    max_x = min(image.width() - 1, max_x + padding)
    max_y = min(image.height() - 1, max_y + padding)
    return image.copy(QRect(min_x, min_y, max_x - min_x + 1, max_y - min_y + 1))


if __name__ == "__main__":
    main()
