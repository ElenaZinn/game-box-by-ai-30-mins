import os
import sys

from PySide6.QtCore import QRect
from PySide6.QtGui import QImage


def trim_alpha(input_path, output_path, padding=8, alpha_threshold=4):
    image = QImage(input_path)
    if image.isNull():
        raise SystemExit(f"Could not load {input_path}")

    min_x = image.width()
    min_y = image.height()
    max_x = -1
    max_y = -1

    for y in range(image.height()):
        for x in range(image.width()):
            if image.pixelColor(x, y).alpha() > alpha_threshold:
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)

    if max_x < min_x or max_y < min_y:
        raise SystemExit("No non-transparent pixels found")

    min_x = max(0, min_x - padding)
    min_y = max(0, min_y - padding)
    max_x = min(image.width() - 1, max_x + padding)
    max_y = min(image.height() - 1, max_y + padding)

    trimmed = image.copy(QRect(min_x, min_y, max_x - min_x + 1, max_y - min_y + 1))
    if not trimmed.save(output_path):
        raise SystemExit(f"Could not save {output_path}")
    print(output_path)
    print(f"{image.width()}x{image.height()} -> {trimmed.width()}x{trimmed.height()}")


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: trim_alpha_asset.py INPUT OUTPUT")
    trim_alpha(os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2]))


if __name__ == "__main__":
    main()
