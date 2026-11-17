import os
from PIL import Image

SRC = r"C:\Users\zhenge\Documents\deepseek-harness\default-workspace\phone-chat\icon-512.png"
RES = r"C:\Users\zhenge\Documents\deepseek-harness\default-workspace\phone-chat\android\app\src\main\res"

DENSITIES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

img = Image.open(SRC).convert("RGBA")
for folder, size in DENSITIES.items():
    d = os.path.join(RES, folder)
    os.makedirs(d, exist_ok=True)
    img.resize((size, size), Image.LANCZOS).save(os.path.join(d, "ic_launcher.png"))
    print("wrote", folder, size)
