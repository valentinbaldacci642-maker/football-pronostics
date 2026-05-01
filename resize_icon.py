from PIL import Image, ImageDraw
import os

src = r'C:\Users\valen\Desktop\téléchargement.png'
base = r'C:\Users\valen\football-pronostics\frontend\android\app\src\main\res'

sizes = {
    'mipmap-mdpi':    48,
    'mipmap-hdpi':    72,
    'mipmap-xhdpi':   96,
    'mipmap-xxhdpi':  144,
    'mipmap-xxxhdpi': 192,
}

# Foreground layer for adaptive icons (108x108 canvas, safe zone = center 72x72)
ADAPTIVE_SIZE = 432  # work at 4x for quality

img = Image.open(src).convert('RGBA')

def make_square_icon(logo, size, padding_pct=0.12):
    canvas = Image.new('RGBA', (size, size), (255, 255, 255, 255))
    pad = int(size * padding_pct)
    inner = size - pad * 2
    logo_resized = logo.resize((inner, inner), Image.LANCZOS)
    canvas.paste(logo_resized, (pad, pad), logo_resized)
    return canvas

def make_round_icon(logo, size, padding_pct=0.12):
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    # white circle background
    mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size, size), fill=255)
    bg = Image.new('RGBA', (size, size), (255, 255, 255, 255))
    bg.putalpha(mask)
    canvas.paste(bg, (0, 0), bg)
    pad = int(size * padding_pct)
    inner = size - pad * 2
    logo_resized = logo.resize((inner, inner), Image.LANCZOS)
    canvas.paste(logo_resized, (pad, pad), logo_resized)
    return canvas

def make_foreground(logo, size):
    # Adaptive foreground: logo occupies 72/108 = 66% of canvas, centered
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    inner = int(size * 0.66)
    pad = (size - inner) // 2
    logo_resized = logo.resize((inner, inner), Image.LANCZOS)
    canvas.paste(logo_resized, (pad, pad), logo_resized)
    return canvas

for folder, size in sizes.items():
    out_dir = os.path.join(base, folder)

    make_square_icon(img, size).save(os.path.join(out_dir, 'ic_launcher.png'))
    make_round_icon(img, size).save(os.path.join(out_dir, 'ic_launcher_round.png'))
    make_foreground(img, size).save(os.path.join(out_dir, 'ic_launcher_foreground.png'))

    print(f'{folder}: {size}x{size} OK')
