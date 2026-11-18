"""从一张方形原图生成各类应用图标。

用法：
    python dev/make-icons.py [原图路径]

不带参数时读取仓库根目录的 icon-src.png，输出：
    icon-512.png / icon-192.png / icon-maskable-512.png
    apple-touch-icon.png / favicon.png
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "icon-src.png")

if not os.path.exists(SRC):
    sys.exit("找不到原图：%s\n把一个 1024x1024 的方形图片放成 icon-src.png，或直接传路径。" % SRC)

img = Image.open(SRC).convert("RGB")
side = min(img.size)
left = (img.size[0] - side) // 2
top = (img.size[1] - side) // 2
face = img.crop((left, top, left + side, top + side))
print("原图 %s -> 居中裁成 %dx%d" % (img.size, side, side))


def save(size, name):
    face.resize((size, size), Image.LANCZOS).save(os.path.join(ROOT, name))
    print("  %-24s %dx%d" % (name, size, size))


save(512, "icon-512.png")
save(192, "icon-192.png")
save(64, "favicon.png")
save(180, "apple-touch-icon.png")

# maskable：四周留出安全区，避免被系统裁成圆形时切到主体
pad = Image.new("RGB", (512, 512), (18, 26, 46))
inner = face.resize((int(512 * 0.72), int(512 * 0.72)), Image.LANCZOS)
off = (512 - inner.size[0]) // 2
pad.paste(inner, (off, off))
pad.save(os.path.join(ROOT, "icon-maskable-512.png"))
print("  %-24s 512x512 (含安全区)")
