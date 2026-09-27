import math
import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "assets")
SOURCE = os.path.join(ASSETS, "cat_3d.png")


def rounded_mask(size, rect, radius=36, blur=14):
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle(rect, radius=radius, fill=255)
    return mask.filter(ImageFilter.GaussianBlur(blur))


def multiply_alpha(image, mask):
    layer = image.copy()
    alpha = layer.getchannel("A")
    layer.putalpha(ImageChops.multiply(alpha, mask))
    return layer


def fade_original(base, mask, strength=0.52):
    alpha = base.getchannel("A")
    fade = mask.point(lambda value: int(255 - value * strength))
    base.putalpha(ImageChops.multiply(alpha, fade))


def translate(layer, dx, dy):
    out = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    out.alpha_composite(layer, (round(dx), round(dy)))
    return out


def squash_body(image, sx=1.0, sy=1.0, y_anchor=1.0):
    if sx == 1.0 and sy == 1.0:
        return image
    w, h = image.size
    nw = round(w * sx)
    nh = round(h * sy)
    resized = image.resize((nw, nh), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    x = round((w - nw) / 2)
    y = round((h - nh) * y_anchor)
    out.alpha_composite(resized, (x, y))
    return out


def make_frame(source, frame_index, spec):
    base = squash_body(source, spec.get("sx", 1.0), spec.get("sy", 1.0))
    canvas = base.copy()
    limbs = spec["limbs"]

    for limb in LIMBS:
        rect = limb["rect"]
        mask = rounded_mask(source.size, rect, limb.get("radius", 42), limb.get("blur", 16))
        erase = mask.filter(ImageFilter.MaxFilter(19)).filter(ImageFilter.GaussianBlur(10))
        fade_original(canvas, erase, strength=limb.get("erase", 0.42))

    for limb in LIMBS:
        dx, dy = limbs[limb["name"]]
        mask = rounded_mask(source.size, limb["rect"], limb.get("radius", 42), limb.get("blur", 16))
        part = multiply_alpha(source, mask)
        moved = translate(part, dx, dy)
        canvas.alpha_composite(moved)

    canvas = add_grounding(canvas, frame_index, spec)
    return canvas


def add_grounding(image, frame_index, spec):
    w, h = image.size
    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    phase = frame_index / 6.0 * math.tau
    alpha = 34 + round(abs(math.sin(phase)) * 12)
    draw.ellipse((w * 0.13, h * 0.955, w * 0.43, h * 0.99), fill=(32, 24, 22, alpha))
    draw.ellipse((w * 0.62, h * 0.93, w * 0.92, h * 0.975), fill=(32, 24, 22, alpha - 8))
    image.alpha_composite(shadow)
    return image


LIMBS = [
    {
        "name": "front_far",
        "rect": (80, 650, 270, 1148),
        "radius": 60,
        "blur": 18,
        "erase": 0.64,
    },
    {
        "name": "front_near",
        "rect": (240, 645, 445, 1148),
        "radius": 60,
        "blur": 18,
        "erase": 0.78,
    },
    {
        "name": "rear_inner",
        "rect": (410, 700, 600, 1085),
        "radius": 52,
        "blur": 16,
        "erase": 0.62,
    },
    {
        "name": "rear_near",
        "rect": (585, 650, 850, 1130),
        "radius": 70,
        "blur": 20,
        "erase": 0.62,
    },
]


FRAMES = [
    {
        "sx": 1.0,
        "sy": 1.0,
        "limbs": {
            "front_far": (0, 0),
            "front_near": (0, 0),
            "rear_inner": (0, 0),
            "rear_near": (0, 0),
        },
    },
    {
        "sx": 1.004,
        "sy": 0.998,
        "limbs": {
            "front_far": (-7, 2),
            "front_near": (8, -4),
            "rear_inner": (5, 1),
            "rear_near": (-6, -2),
        },
    },
    {
        "sx": 1.006,
        "sy": 0.997,
        "limbs": {
            "front_far": (-11, 4),
            "front_near": (13, -6),
            "rear_inner": (8, 1),
            "rear_near": (-10, -3),
        },
    },
    {
        "sx": 1.0,
        "sy": 1.0,
        "limbs": {
            "front_far": (0, 0),
            "front_near": (0, 0),
            "rear_inner": (0, 0),
            "rear_near": (0, 0),
        },
    },
    {
        "sx": 0.998,
        "sy": 1.001,
        "limbs": {
            "front_far": (7, -3),
            "front_near": (-8, 2),
            "rear_inner": (-5, -1),
            "rear_near": (6, 2),
        },
    },
    {
        "sx": 0.996,
        "sy": 1.002,
        "limbs": {
            "front_far": (11, -5),
            "front_near": (-13, 4),
            "rear_inner": (-8, -1),
            "rear_near": (10, 3),
        },
    },
]


def make_contact_sheet(frames):
    gap = 24
    max_w = max(frame.width for frame in frames)
    max_h = max(frame.height for frame in frames)
    sheet = Image.new("RGBA", (max_w * len(frames) + gap * (len(frames) + 1), max_h + gap * 2), (22, 22, 22, 255))
    for i, frame in enumerate(frames):
        x = gap + i * (max_w + gap)
        y = gap + (max_h - frame.height)
        sheet.alpha_composite(frame, (x, y))
    sheet.save(os.path.join(ASSETS, "cat_walk_sheet.png"))


def make_preview_gif(frames):
    preview = []
    for frame in frames:
        thumb = frame.copy()
        thumb.thumbnail((220, 220), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (260, 240), (22, 22, 22, 255))
        canvas.alpha_composite(thumb, ((260 - thumb.width) // 2, 240 - thumb.height - 12))
        preview.append(canvas.convert("P", palette=Image.Palette.ADAPTIVE))
    preview[0].save(
        os.path.join(ASSETS, "cat_walk_preview.gif"),
        save_all=True,
        append_images=preview[1:] + preview,
        duration=105,
        loop=0,
        disposal=2,
    )


def main():
    os.makedirs(ASSETS, exist_ok=True)
    source = Image.open(SOURCE).convert("RGBA")
    frames = []
    for i, spec in enumerate(FRAMES):
        frame = make_frame(source, i, spec)
        out = os.path.join(ASSETS, f"cat_walk_{i}.png")
        frame.save(out)
        frames.append(frame)
        print(out)
    make_contact_sheet(frames)
    make_preview_gif(frames)
    print(os.path.join(ASSETS, "cat_walk_sheet.png"))
    print(os.path.join(ASSETS, "cat_walk_preview.gif"))


if __name__ == "__main__":
    main()
