import os
from PIL import Image

SRC = r"C:\Users\zhenge\.dsh\attachments\v1\objects\d1\d143b4c02b2917d37cf9acacf7bb2c4ca7aaf9c3272e958690969565548dd6d2"
APP = r"C:\Users\zhenge\Documents\deepseek-harness\default-workspace\phone-chat"

img = Image.open(SRC).convert("RGB")
print("原图:", img.size)

# 手机竖屏够用即可：1080 宽
w = 1080
h = int(img.size[1] * w / img.size[0])
bg = img.resize((w, h), Image.LANCZOS)
out = os.path.join(APP, "bg.jpg")
bg.save(out, quality=86, optimize=True, progressive=True)
print("bg.jpg:", bg.size, os.path.getsize(out) // 1024, "KB")
