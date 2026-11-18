"""把 icon-512.png 展开成 Android 各密度的启动图标。

用法：
    python dev/make-android-icons.py
"""
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "icon-512.png")
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")

if not os.path.exists(SRC):
    sys.exit("缺少 icon-512.png，先跑 dev/make-icons.py")  # noqa: F821

img = Image.open(SRC).convert("RGB")

DENSITIES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

for folder, size in DENSITIES.items():
    out_dir = os.path.join(RES, folder)
    os.makedirs(out_dir, exist_ok=True)
    img.resize((size, size), Image.LANCZOS).save(os.path.join(out_dir, "ic_launcher.png"))
    print("  %-16s %dx%d" % (folder, size, size))
