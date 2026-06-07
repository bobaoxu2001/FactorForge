#!/usr/bin/env python3
"""Generate FactorForge brand assets (favicon, app icon, OG image) with PIL.

Mark concept: dark premium square, cyan radar rings rising from a signal
origin, and an ascending cyan->emerald "alpha" line ending in a glowing node.
Run: python3 scripts/gen-icons.py
"""
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

APP = "src/app"
BG_TOP = (10, 20, 38)
BG_BOT = (2, 4, 11)
CYAN = (34, 211, 238)
EMER = (52, 211, 153)
MINT = (187, 247, 208)
STROKE = (28, 44, 68)


def vgrad(w, h, top, bot):
    base = Image.new("RGB", (w, h), top)
    draw = ImageDraw.Draw(base)
    for y in range(h):
        t = y / max(1, h - 1)
        draw.line([(0, y), (w, y)], fill=tuple(round(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
    return base


def rounded_mask(w, h, r):
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=r, fill=255)
    return m


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def draw_mark(size, pad_ratio=0.0, with_bg=True):
    """Draw the icon mark on a transparent (or bg) square at `size` px, supersampled."""
    S = size * 4
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    if with_bg:
        r = int(S * 0.235)
        bg = vgrad(S, S, BG_TOP, BG_BOT).convert("RGBA")
        bg.putalpha(rounded_mask(S, S, r))
        img.alpha_composite(bg)
        ImageDraw.Draw(img).rounded_rectangle([2, 2, S - 3, S - 3], radius=r, outline=STROKE, width=max(2, S // 220))

    d = ImageDraw.Draw(img)
    # geometry in 64-grid scaled to S
    sc = S / 64.0
    ox, oy = 14 * sc, 50 * sc  # signal origin
    # radar rings (quarter arcs opening up-right)
    for rad, op, wdt in [(14, 110, 6), (23, 80, 5), (32, 55, 4)]:
        bb = [ox - rad * sc, oy - rad * sc, ox + rad * sc, oy + rad * sc]
        d.arc(bb, start=270, end=360, fill=CYAN + (op,), width=max(2, int(wdt * sc / 4)))

    # ascending alpha line cyan->emerald (draw as gradient-ish segments)
    pts = [(14, 50), (26, 38), (34, 43), (50, 17)]
    pts = [(x * sc, y * sc) for x, y in pts]
    n = len(pts)
    lw = max(6, int(13 * sc / 4))
    for i in range(n - 1):
        t = i / (n - 1)
        d.line([pts[i], pts[i + 1]], fill=lerp(CYAN, EMER, t) + (255,), width=lw, joint="curve")
    # round caps at vertices
    for i, (x, y) in enumerate(pts):
        t = i / (n - 1)
        rr = lw / 2
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=lerp(CYAN, EMER, t) + (255,))

    # glow node at top
    nx, ny = pts[-1]
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gr = 9 * sc
    gd.ellipse([nx - gr, ny - gr, nx + gr, ny + gr], fill=EMER + (120,))
    glow = glow.filter(ImageFilter.GaussianBlur(int(4 * sc)))
    img.alpha_composite(glow)
    nr = 5 * sc
    d.ellipse([nx - nr, ny - nr, nx + nr, ny + nr], fill=EMER + (255,))
    d.ellipse([nx - nr, ny - nr, nx + nr, ny + nr], outline=MINT + (170,), width=max(2, int(1.4 * sc)))
    # origin dot
    orr = 3 * sc
    d.ellipse([ox - orr, oy - orr, ox + orr, oy + orr], fill=CYAN + (255,))

    return img.resize((size, size), Image.LANCZOS)


def font(sz, bold=True):
    candidates = [
        "/System/Library/Fonts/SFNSDisplay.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
    ]
    for c in candidates:
        try:
            return ImageFont.truetype(c, sz)
        except OSError:
            continue
    return ImageFont.load_default()


# ---- favicon.ico (multi-size) + apple icon ----
master = draw_mark(256, with_bg=True)
master.save(f"{APP}/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
draw_mark(180, with_bg=True).save(f"{APP}/apple-icon.png")
print("wrote favicon.ico + apple-icon.png")

# ---- Open Graph image 1200x630 ----
W, H = 1200, 630
og = vgrad(W, H, (8, 16, 32), (2, 4, 11)).convert("RGBA")
od = ImageDraw.Draw(og)

# faint radar grid glow on the right
glowlayer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glowlayer)
cx, cy = 980, 150
for rad in range(120, 620, 70):
    gd.arc([cx - rad, cy - rad, cx + rad, cy + rad], start=90, end=200, fill=CYAN + (26,), width=3)
glowlayer = glowlayer.filter(ImageFilter.GaussianBlur(1))
og.alpha_composite(glowlayer)

# subtle ascending equity curve, kept to the right so it clears the chip row
import random
random.seed(7)
cv = []
y = 500
for i in range(20):
    y -= random.uniform(-3, 11)
    y = max(360, min(510, y))
    cv.append((700 + i * 24, y))
for i in range(len(cv) - 1):
    t = i / (len(cv) - 1)
    od.line([cv[i], cv[i + 1]], fill=lerp(CYAN, EMER, t) + (140,), width=4, joint="curve")
ex, ey = cv[-1]
od.ellipse([ex - 6, ey - 6, ex + 6, ey + 6], fill=EMER + (220,))

# mark top-left
mark = draw_mark(108, with_bg=True)
og.alpha_composite(mark, (80, 70))

# wordmark + eyebrow
od.text((210, 78), "FactorForge", font=font(74), fill=(255, 255, 255, 255))
od.text((214, 162), "AI QUANT RESEARCH LAB", font=font(30), fill=(125, 211, 252, 255))

# headline
od.text((80, 250), "Factor discovery, backtests, and", font=font(46), fill=(226, 232, 240, 255))
od.text((80, 308), "market-stress research in one lab.", font=font(46), fill=(226, 232, 240, 255))

# feature chips
chips = ["Model Portfolio Since May", "Market Stress Mode", "Market Hotspots", "Strategy Research"]
fx = 80
fy = 408
cf = font(26)
for c in chips:
    tb = od.textbbox((0, 0), c, font=cf)
    cw = tb[2] - tb[0] + 44
    if fx + cw > W - 80:
        fx = 80
        fy += 58
    od.rounded_rectangle([fx, fy, fx + cw, fy + 46], radius=23, fill=(255, 255, 255, 12), outline=(34, 211, 238, 90), width=2)
    od.text((fx + 22, fy + 9), c, font=cf, fill=(186, 230, 253, 255))
    fx += cw + 16

# footer disclaimer
od.text((80, 556), "Simulated research · Not investment advice · Historical performance does not indicate future results",
        font=font(22, bold=False), fill=(148, 163, 184, 255))

og.convert("RGB").save(f"{APP}/opengraph-image.png", quality=92)
print("wrote opengraph-image.png")
