import os
from PIL import Image

SRC = r"C:\Users\zhenge\.dsh\attachments\v1\objects\3e\3ebba4e8c258898eb6cf6c5555fc27f78b076a1bb17321b46e5ef731d6bf7629"
APP = r"C:\Users\zhenge\Documents\deepseek-harness\default-workspace\phone-chat"
RES = os.path.join(APP, r"android\app\src\main\res")

img = Image.open(SRC).convert("RGB")
W, H = img.size

# 图标：脸部特写，略作平移让脸居中
x, y, s = 415, 20, 560
x = max(0, min(x, W - s)); y = max(0, min(y, H - s))
face = img.crop((x, y, x + s, y + s))
print("icon crop:", (x, y, s))

# 网页/PWA 图标
face.resize((512, 512), Image.LANCZOS).save(os.path.join(APP, "icon-512.png"))
face.resize((192, 192), Image.LANCZOS).save(os.path.join(APP, "icon-192.png"))
face.resize((64, 64), Image.LANCZOS).save(os.path.join(APP, "favicon.png"))
face.resize((180, 180), Image.LANCZOS).save(os.path.join(APP, "apple-touch-icon.png"))

# maskable：四周留 18% 安全区
mask_bg = Image.new("RGB", (512, 512), (18, 26, 46))
inner = face.resize((int(512 * 0.72), int(512 * 0.72)), Image.LANCZOS)
offset = (512 - inner.size[0]) // 2
mask_bg.paste(inner, (offset, offset))
mask_bg.save(os.path.join(APP, "icon-maskable-512.png"))

# Android 各密度
DENS = {"mipmap-mdpi": 48, "mipmap-hdpi": 72, "mipmap-xhdpi": 96, "mipmap-xxhdpi": 144, "mipmap-xxxhdpi": 192}
for folder, size in DENS.items():
    d = os.path.join(RES, folder)
    os.makedirs(d, exist_ok=True)
    face.resize((size, size), Image.LANCZOS).save(os.path.join(d, "ic_launcher.png"))
    print("android", folder, size)

# 背景图：整张，压到 1080 宽
bg = img.resize((1080, int(H * 1080 / W)), Image.LANCZOS)
bg.save(os.path.join(APP, "bg.jpg"), quality=84, optimize=True)
print("bg:", bg.size, os.path.getsize(os.path.join(APP, "bg.jpg")) // 1024, "KB")
