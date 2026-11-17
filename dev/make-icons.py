import os
from PIL import Image, ImageDraw, ImageFilter

OUT = r"C:\Users\zhenge\Documents\deepseek-harness\default-workspace\phone-chat"

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def gradient(size, c1, c2):
    img = Image.new("RGB", (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        for_x = y / max(1, size - 1)
        # 对角线渐变
        d.line([(0, y), (size, y)], fill=lerp(c1, c2, for_x))
    return img

def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m

def draw_glyph(img, scale=1.0, bubble_w=0.62, bubble_h=0.46, cy=0.50):
    """在 img 上画一个白色对话气泡 + 三个点。"""
    S = img.size[0]
    d = ImageDraw.Draw(img)
    w = int(S * bubble_w * scale)
    h = int(S * bubble_h * scale)
    x = (S - w) // 2
    y = int(S * cy - h // 2)
    r = int(h * 0.34)
    d.rounded_rectangle([x, y, x + w, y + h], radius=r, fill=(255, 255, 255, 255))
    # 尾巴
    tail = int(h * 0.30)
    tx = x + int(w * 0.26)
    d.polygon([(tx, y + h - 2), (tx + tail, y + h - 2), (tx + int(tail * 0.15), y + h + tail)], fill=(255, 255, 255, 255))
    # 三个点
    dot = max(5, int(S * 0.030 * scale))
    gap = int(dot * 2.35)
    cx = x + w // 2
    cyd = y + h // 2
    for k in (-1, 0, 1):
        px = cx + k * gap
        d.ellipse([px - dot, cyd - dot, px + dot, cyd + dot], fill=(43, 75, 208, 255))

# ---------- 常规图标（圆角方块） ----------
for size in (192, 512):
    base = gradient(size, (74, 125, 255), (43, 75, 208)).convert("RGBA")
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw_glyph(layer)
    base = Image.alpha_composite(base, layer)
    base.putalpha(rounded_mask(size, int(size * 0.22)))
    base.save(os.path.join(OUT, f"icon-{size}.png"))
    print("wrote", f"icon-{size}.png")

# ---------- maskable（满幅背景，图形收在安全区） ----------
size = 512
base = gradient(size, (74, 125, 255), (43, 75, 208)).convert("RGBA")
layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
draw_glyph(layer, scale=0.74)
base = Image.alpha_composite(base, layer)
base.save(os.path.join(OUT, "icon-maskable-512.png"))
print("wrote icon-maskable-512.png")

# ---------- apple-touch-icon（不透明底） ----------
size = 180
base = gradient(size, (74, 125, 255), (43, 75, 208)).convert("RGBA")
layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
draw_glyph(layer, scale=1.0)
base = Image.alpha_composite(base, layer).convert("RGB")
base.save(os.path.join(OUT, "apple-touch-icon.png"))
print("wrote apple-touch-icon.png")

# ---------- favicon ----------
base.resize((64, 64), Image.LANCZOS).save(os.path.join(OUT, "favicon.png"))
print("wrote favicon.png")
