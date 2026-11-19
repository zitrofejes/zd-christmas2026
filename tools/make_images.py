"""Builds the favicon, app icons and the link-preview (Open Graph) image from assets/.

Run from the repo root:  python tools/make_images.py
Needs Pillow (pip install pillow). Uses Constantia Bold from Windows for the lettering.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
A = ROOT / 'assets'
FONT = Path('C:/Windows/Fonts/constanb.ttf')
FONT_BODY = Path('C:/Windows/Fonts/georgiab.ttf')

GOLD_STOPS = [(0.0, (255, 246, 200)), (0.3, (249, 211, 107)), (0.55, (214, 149, 42)), (0.72, (247, 207, 106)), (1.0, (139, 84, 16))]


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def gradient(size, stops, vertical=True):
    w, h = size
    g = Image.new('RGB', size)
    d = ImageDraw.Draw(g)
    n = h if vertical else w
    for i in range(n):
        t = i / max(1, n - 1)
        for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
            if p0 <= t <= p1:
                c = lerp(c0, c1, (t - p0) / (p1 - p0))
                break
        if vertical:
            d.line([(0, i), (w, i)], fill=c)
        else:
            d.line([(i, 0), (i, h)], fill=c)
    return g


def gold_text(text, font, stroke=3):
    """Gold-gradient lettering with a dark outline and soft shadow, on a transparent layer."""
    bbox = font.getbbox(text, stroke_width=stroke)
    w, h = bbox[2] - bbox[0] + 20, bbox[3] - bbox[1] + 20
    ox, oy = 10 - bbox[0], 10 - bbox[1]
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).text((ox, oy), text, font=font, fill=255)
    outline = Image.new('L', (w, h), 0)
    ImageDraw.Draw(outline).text((ox, oy), text, font=font, fill=255, stroke_width=stroke, stroke_fill=255)
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    layer.paste((74, 42, 6, 255), (0, 0), outline)
    layer.paste(gradient((w, h), GOLD_STOPS), (0, 0), mask)
    shadow = Image.new('RGBA', (w + 30, h + 30), (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 170), (15, 22), outline)
    shadow = shadow.filter(ImageFilter.GaussianBlur(8))
    shadow.alpha_composite(layer, (15, 15))
    return shadow


def santa_hat(width):
    """Simple santa hat (same shape as the SVG on the page)."""
    s = width / 120
    img = Image.new('RGBA', (round(120 * s), round(100 * s)), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.polygon([(10 * s, 78 * s), (40 * s, 25 * s), (75 * s, 5 * s), (104 * s, 22 * s), (86 * s, 62 * s)], fill=(200, 16, 46))
    d.rounded_rectangle([4 * s, 70 * s, 94 * s, 90 * s], radius=10 * s, fill='white')
    d.ellipse([95 * s, 11 * s, 117 * s, 33 * s], fill='white')
    return img


def icon(size):
    """Purple tile, gold ring, glowing scarab — the browser tab / home-screen icon."""
    big = 512
    img = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    bg = gradient((big, big), [(0, (90, 44, 128)), (1, (26, 13, 43))])
    mask = Image.new('L', (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, big - 1, big - 1], radius=112, fill=255)
    img.paste(bg, (0, 0), mask)
    ring = Image.new('L', (big, big), 0)
    ImageDraw.Draw(ring).rounded_rectangle([14, 14, big - 15, big - 15], radius=100, outline=255, width=22)
    img.paste(gradient((big, big), GOLD_STOPS), (0, 0), ring)
    scarab = Image.open(A / 'scarab.webp').convert('RGBA').resize((680, 680), Image.LANCZOS)
    img.alpha_composite(scarab, (-84, -74))
    img.putalpha(Image.composite(img.getchannel('A'), Image.new('L', (big, big), 0), mask))
    return img.resize((size, size), Image.LANCZOS)


def og_image():
    W, H = 1200, 630
    temple = Image.open(A / 'temple.webp').convert('RGB')
    scale = W / temple.width
    temple = temple.resize((W, round(temple.height * scale)), Image.LANCZOS).crop((0, 140, W, 140 + H))
    canvas = temple.convert('RGBA')
    shade = Image.new('RGBA', (W, H))
    sd = ImageDraw.Draw(shade)
    for x in range(W):  # dark on the left for the text, lighter on the right for the pharaoh
        a = round(225 - 120 * (x / W))
        sd.line([(x, 0), (x, H)], fill=(20, 10, 34, a))
    canvas.alpha_composite(shade)

    ph = Image.open(A / 'pharaoh.webp').convert('RGBA')
    ph = ph.resize((470, round(ph.height * 470 / ph.width)), Image.LANCZOS)
    px, py = W - 470 + 10, 70
    canvas.alpha_composite(ph.crop((0, 0, 470, H - py)), (px, py))
    hat = santa_hat(170).rotate(4, expand=True, resample=Image.BICUBIC)
    canvas.alpha_composite(hat, (px + 160, py - 92))

    x0 = 70
    xmas = gold_text('CHRISTMAS', ImageFont.truetype(str(FONT), 108), stroke=4)
    canvas.alpha_composite(xmas, (x0 - 25, 120))
    band = Image.open(A / 'unfold.webp').convert('RGBA')
    band = band.resize((600, round(band.height * 600 / band.width)), Image.LANCZOS)
    bx = x0 - 25 + (xmas.width - band.width) // 2
    canvas.alpha_composite(band, (bx, 120 + xmas.height - 30))

    d = ImageDraw.Draw(canvas)
    body = ImageFont.truetype(str(FONT_BODY), 34)
    small = ImageFont.truetype(str(FONT_BODY), 30)
    y = 120 + xmas.height - 30 + band.height + 34
    d.text((x0, y), 'Friday 11 December · 19:00', font=body, fill=(255, 247, 227))
    d.text((x0, y + 50), "L'Ovella Negra Marina, Barcelona", font=small, fill=(216, 201, 238))
    d.rounded_rectangle([x0, y + 108, x0 + 400, y + 170], radius=31, fill=(55, 224, 214), outline=(185, 255, 250), width=2)
    d.text((x0 + 200, y + 139), 'RSVP & SPIN THE WHEEL', font=ImageFont.truetype(str(FONT), 26), fill=(10, 50, 56), anchor='mm')
    return canvas.convert('RGB')


if __name__ == '__main__':
    base = icon(512)
    base.save(A / 'icon-512.png', optimize=True)
    icon(192).save(A / 'icon-192.png', optimize=True)
    # Apple ignores transparency; give it the full square tile.
    apple = Image.new('RGB', (180, 180), (26, 13, 43))
    apple.paste(icon(180), (0, 0), icon(180))
    apple.save(ROOT / 'apple-touch-icon.png', optimize=True)
    base.save(ROOT / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
    icon(32).save(A / 'favicon-32.png', optimize=True)
    og_image().save(A / 'og.jpg', quality=85, optimize=True, progressive=True)
    print('done')
