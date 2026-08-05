from PIL import Image, ImageDraw

# Desenha em super-resolução (32x o tamanho base de 64 unidades do SVG) e depois
# reduz com LANCZOS para ter bordas suaves (equivalente a anti-aliasing).
SCALE = 32
BASE = 64
SIZE = BASE * SCALE  # 2048

def pt(x, y):
    return (x * SCALE, y * SCALE)

img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# --- fundo em gradiente (diagonal, aproximado por faixas horizontais) ---
c1 = (129, 140, 248)   # #818CF8
c2 = (67, 56, 202)     # #4338CA
for y in range(SIZE):
    t = y / (SIZE - 1)
    r = round(c1[0] + (c2[0] - c1[0]) * t)
    g = round(c1[1] + (c2[1] - c1[1]) * t)
    b = round(c1[2] + (c2[2] - c1[2]) * t)
    draw.line([(0, y), (SIZE, y)], fill=(r, g, b, 255))

# --- máscara de cantos arredondados (rx = 15 de 64) ---
mask = Image.new("L", (SIZE, SIZE), 0)
mdraw = ImageDraw.Draw(mask)
mdraw.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=15 * SCALE, fill=255)
img.putalpha(mask)
draw = ImageDraw.Draw(img)

# --- halos de sinal nos dois nós monitorados ---
for cx, cy in [(10, 34), (54, 34)]:
    r = 7
    x0, y0 = pt(cx - r, cy - r)
    x1, y1 = pt(cx + r, cy + r)
    halo = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    hdraw = ImageDraw.Draw(halo)
    hdraw.ellipse([x0, y0, x1, y1], fill=(255, 255, 255, 40))
    img = Image.alpha_composite(img, halo)

draw = ImageDraw.Draw(img)

# --- linha de pulso conectando os dois nós ---
pontos = [(10, 34), (18, 34), (23, 19), (29, 47), (35, 25), (39, 34), (54, 34)]
pontos_px = [pt(x, y) for x, y in pontos]
largura = 4.2 * SCALE
draw.line(pontos_px, fill=(255, 255, 255, 255), width=round(largura), joint="curve")
# tampas arredondadas nas pontas de cada segmento (para imitar stroke-linecap="round")
for (x, y) in pontos_px:
    rr = largura / 2
    draw.ellipse([x - rr, y - rr, x + rr, y + rr], fill=(255, 255, 255, 255))

# --- nós (endpoints monitorados) ---
for cx, cy in [(10, 34), (54, 34)]:
    r = 3.4
    x0, y0 = pt(cx - r, cy - r)
    x1, y1 = pt(cx + r, cy + r)
    draw.ellipse([x0, y0, x1, y1], fill=(255, 255, 255, 255))

# --- exporta nos formatos necessários ---
img_512 = img.resize((512, 512), Image.LANCZOS)
img_512.save("/home/claude/infra-monitor-ai/frontend/public/logo-512.png")

apple = img.resize((180, 180), Image.LANCZOS)
apple_bg = Image.new("RGBA", (180, 180), (0, 0, 0, 0))
apple_bg.paste(apple, (0, 0), apple)
apple_bg.convert("RGB").save("/home/claude/infra-monitor-ai/frontend/public/apple-touch-icon.png")

icon_sizes = [16, 32, 48, 64, 128, 256]
imgs = [img.resize((s, s), Image.LANCZOS) for s in icon_sizes]
imgs[0].save(
    "/home/claude/infra-monitor-ai/frontend/public/favicon.ico",
    format="ICO",
    sizes=[(s, s) for s in icon_sizes],
    append_images=imgs[1:],
)

img.resize((32, 32), Image.LANCZOS).save("/home/claude/infra-monitor-ai/frontend/public/favicon-32x32.png")

print("OK - arquivos gerados")
