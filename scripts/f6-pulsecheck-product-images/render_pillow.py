from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[3]
PUBLIC = ROOT / "QuickLifts-Web" / "public"
OUT = ROOT / "F6-PulseCheck-product-images"
FONT_DIR = Path(
    "/Users/tremainegrant/.cache/codex-runtimes/codex-primary-runtime/dependencies/"
    "native/libreoffice-headless/libreoffice/LibreOfficeDev.app/Contents/Resources/fonts/truetype"
)

S = 2
W, H = 1200, 675

LIME = "#E0FE10"
TEXT = "#F7FAFA"
MUTED = (247, 250, 250, 166)
QUIET = (247, 250, 250, 105)
PURPLE = "#8B5CF6"
CYAN = "#22D3EE"
TEAL = "#14E7D0"
RED = "#FF3B5C"
PANEL = (18, 24, 29, 228)
LINE = (255, 255, 255, 32)


def p(value: float) -> int:
    return round(value * S)


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_DIR / name), p(size))


REG = "Rubik-Regular.ttf"
BOLD = "Rubik-Bold.ttf"


@dataclass
class TextBlock:
    kicker: str
    title: str
    deck: str | None = None
    bullets: Sequence[str] = ()
    x: int = 64
    y: int = 76
    width: int = 470
    title_size: int = 58


def rgba(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    hex_color = hex_color.lstrip("#")
    return (
        int(hex_color[0:2], 16),
        int(hex_color[2:4], 16),
        int(hex_color[4:6], 16),
        alpha,
    )


def fit_text(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont, width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    line = ""
    for word in words:
        trial = word if not line else f"{line} {word}"
        if draw.textbbox((0, 0), trial, font=fnt)[2] <= width:
            line = trial
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def draw_wrapped(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    fnt: ImageFont.FreeTypeFont,
    fill,
    width: int,
    line_gap: int = 8,
) -> int:
    x, y = xy
    lines = fit_text(draw, text, fnt, width)
    ascent = draw.textbbox((0, 0), "Ag", font=fnt)[3]
    for line in lines:
        draw.text((x, y), line, font=fnt, fill=fill)
        y += ascent + p(line_gap)
    return y


def rounded_rect_layer(size: tuple[int, int], radius: int, fill, outline=None, width: int = 1) -> Image.Image:
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=fill, outline=outline, width=width)
    return layer


def add_shadow(base: Image.Image, item: Image.Image, xy: tuple[int, int], blur: int = 38, alpha: int = 135) -> None:
    shadow = Image.new("RGBA", item.size, (0, 0, 0, 0))
    mask = item.getchannel("A")
    shadow.putalpha(mask.point(lambda v: min(alpha, v)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(p(blur)))
    base.alpha_composite(shadow, (xy[0], xy[1] + p(24)))
    base.alpha_composite(item, xy)


def make_bg() -> Image.Image:
    img = Image.new("RGBA", (p(W), p(H)), "#07090B")
    pix = img.load()
    for y in range(p(H)):
        for x in range(p(W)):
            nx = x / p(W)
            ny = y / p(H)
            base = [7, 9, 11]
            warm = max(0, 1 - ((nx - 0.84) ** 2 / 0.22 + (ny + 0.08) ** 2 / 0.18)) * 42
            cool = max(0, 1 - ((nx + 0.08) ** 2 / 0.28 + (ny - 1.08) ** 2 / 0.24)) * 28
            mid = max(0, 1 - ((nx - 0.56) ** 2 / 0.64 + (ny - 0.34) ** 2 / 0.55)) * 15
            pix[x, y] = (
                min(255, int(base[0] + warm * 1.6 + cool * 0.2 + mid)),
                min(255, int(base[1] + warm * 0.9 + cool * 1.5 + mid)),
                min(255, int(base[2] + warm * 2.5 + cool * 1.7 + mid)),
                255,
            )

    d = ImageDraw.Draw(img, "RGBA")
    for x in range(0, p(W), p(46)):
        d.line((x, 0, x, p(H)), fill=(255, 255, 255, 7), width=p(1))
    for y in range(0, p(H), p(46)):
        d.line((0, y, p(W), y), fill=(255, 255, 255, 7), width=p(1))
    d.rectangle((0, 0, p(W), p(H)), outline=(255, 255, 255, 30), width=p(1))
    return img


def draw_brand(img: Image.Image) -> None:
    d = ImageDraw.Draw(img, "RGBA")
    icon = Image.open(PUBLIC / "pulsecheck-app-icon.jpg").convert("RGBA")
    icon = ImageOps.fit(icon, (p(38), p(38)))
    mask = Image.new("L", icon.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, icon.width, icon.height), radius=p(10), fill=255)
    icon.putalpha(mask)
    x, y = p(972), p(40)
    img.alpha_composite(icon, (x, y))
    d.text((x + p(50), y + p(6)), "PulseCheck", font=font(BOLD, 18), fill=(255, 255, 255, 236))


def draw_copy(img: Image.Image, block: TextBlock) -> None:
    d = ImageDraw.Draw(img, "RGBA")
    x, y, width = p(block.x), p(block.y), p(block.width)
    d.text((x, y), block.kicker.upper(), font=font(BOLD, 15), fill=rgba(LIME), spacing=0)
    y += p(44)
    title_font = font(BOLD, block.title_size)
    for line in block.title.split("\n"):
        d.text((x, y), line, font=title_font, fill=rgba(TEXT), spacing=0)
        y += p(block.title_size * 0.98)
    if block.deck:
        y += p(18)
        y = draw_wrapped(d, (x, y), block.deck, font(REG, 21), MUTED, width, line_gap=8)
    if block.bullets:
        y += p(24)
        bullet_font = font(BOLD, 16)
        for bullet in block.bullets:
            d.ellipse((x, y + p(8), x + p(9), y + p(17)), fill=rgba(LIME))
            y = draw_wrapped(d, (x + p(22), y), bullet, bullet_font, (255, 255, 255, 190), width - p(30), line_gap=5)
            y += p(12)


def phone_image(src: str, w: int, h: int) -> Image.Image:
    ow, oh = p(w), p(h)
    border = p(8)
    radius = p(44)
    phone = Image.new("RGBA", (ow, oh), (0, 0, 0, 0))
    body = rounded_rect_layer((ow, oh), radius, (35, 40, 46, 255), (255, 255, 255, 22), p(1))
    phone.alpha_composite(body)
    inner = Image.open(PUBLIC / src).convert("RGBA")
    inner = ImageOps.fit(inner, (ow - border * 2, oh - border * 2), method=Image.Resampling.LANCZOS)
    mask = Image.new("L", inner.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, inner.width, inner.height), radius=max(1, radius - border), fill=255)
    inner.putalpha(mask)
    phone.alpha_composite(inner, (border, border))
    d = ImageDraw.Draw(phone, "RGBA")
    d.rounded_rectangle((ow // 2 - p(37), border + p(6), ow // 2 + p(37), border + p(24)), radius=p(10), fill=(4, 5, 6, 235))
    d.rounded_rectangle((0, 0, ow - 1, oh - 1), radius=radius, outline=(255, 255, 255, 38), width=p(2))
    return phone


def paste_rotated(base: Image.Image, item: Image.Image, center: tuple[int, int], angle: float, shadow=True) -> None:
    rotated = item.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
    xy = (p(center[0]) - rotated.width // 2, p(center[1]) - rotated.height // 2)
    if shadow:
        add_shadow(base, rotated, xy)
    else:
        base.alpha_composite(rotated, xy)


def rounded_panel(img: Image.Image, xywh: tuple[int, int, int, int], radius=20, fill=PANEL) -> ImageDraw.ImageDraw:
    x, y, w, h = [p(v) for v in xywh]
    panel = rounded_rect_layer((w, h), p(radius), fill, LINE, p(1))
    add_shadow(img, panel, (x, y), blur=24, alpha=80)
    return ImageDraw.Draw(img, "RGBA")


def draw_metric_panel(img: Image.Image, xywh: tuple[int, int, int, int], label: str, number: str, note: str) -> None:
    x, y, w, h = [p(v) for v in xywh]
    panel = rounded_rect_layer((w, h), p(18), PANEL, LINE, p(1))
    add_shadow(img, panel, (x, y), blur=22, alpha=80)
    d = ImageDraw.Draw(img, "RGBA")
    d.text((x + p(22), y + p(18)), label.upper(), font=font(BOLD, 12), fill=QUIET)
    d.text((x + p(22), y + p(44)), number, font=font(BOLD, 38), fill=rgba(TEXT))
    d.text((x + p(22), y + p(92)), note, font=font(BOLD, 14), fill=MUTED)


def draw_chips(d: ImageDraw.ImageDraw, x: int, y: int, chips: Iterable[tuple[str, bool]]) -> None:
    x = p(x)
    y = p(y)
    for label, hot in chips:
        f = font(BOLD, 13)
        bbox = d.textbbox((0, 0), label, font=f)
        w = bbox[2] + p(28)
        fill = rgba(LIME) if hot else (255, 255, 255, 22)
        text_fill = (7, 9, 11, 255) if hot else (255, 255, 255, 205)
        d.rounded_rectangle((x, y, x + w, y + p(36)), radius=p(18), fill=fill, outline=(255, 255, 255, 22))
        d.text((x + p(14), y + p(9)), label, font=f, fill=text_fill)
        x += w + p(10)


def draw_wave(img: Image.Image, points: Sequence[tuple[int, int]], color=LIME, width=7, alpha=120) -> None:
    d = ImageDraw.Draw(img, "RGBA")
    pts = [(p(x), p(y)) for x, y in points]
    d.line(pts, fill=rgba(color, alpha), width=p(width), joint="curve")


def save_card(img: Image.Image, slug: str) -> None:
    final = img.resize((W, H), Image.Resampling.LANCZOS).convert("RGB")
    OUT.mkdir(parents=True, exist_ok=True)
    final.save(OUT / f"{slug}.png", "PNG")
    final.save(OUT / f"{slug}.jpg", "JPEG", quality=92, optimize=True)


def card_cover() -> None:
    img = make_bg()
    draw_brand(img)
    d = ImageDraw.Draw(img, "RGBA")
    d.arc((p(666), p(68), p(1180), p(582)), 210, 510, fill=rgba(PURPLE, 46), width=p(3))
    d.arc((p(716), p(118), p(1130), p(532)), 205, 500, fill=rgba(LIME, 34), width=p(2))
    draw_copy(img, TextBlock(
        "Pulse Intelligence Labs",
        "Human\nperformance,\nmeasured daily.",
        "PulseCheck turns private check-ins, biometric signals, and mental reps into a live readiness layer for athletes and teams.",
        x=64,
        y=78,
        width=520,
        title_size=62,
    ))
    paste_rotated(img, phone_image("pulsecheck-media/00-app-store-meet-nora.png", 290, 612), (742, 410), -7)
    paste_rotated(img, phone_image("pulsecheck-media/01-today-checkin.png", 244, 516), (1016, 338), 7)
    draw_wave(img, [(646, 556), (730, 556), (762, 504), (808, 608), (850, 528), (934, 528), (960, 488), (1002, 598), (1048, 524), (1176, 524)], alpha=130)
    save_card(img, "01-pulsecheck-lab-human-performance")


def card_readiness() -> None:
    img = make_bg()
    draw_brand(img)
    draw_copy(img, TextBlock(
        "Readiness engine",
        "Spot risk\nbefore the\ndrop-off.",
        bullets=[
            "Daily emotional state, sleep, soreness, HRV, and training load in one private flow.",
            "Coaches see trends without exposing every athlete conversation.",
            "Escalation signals surface when support needs to move faster.",
        ],
        x=64,
        y=78,
        width=500,
    ))
    d = ImageDraw.Draw(img, "RGBA")
    cx, cy, r = p(728), p(180), p(68)
    d.ellipse((cx-r, cy-r, cx+r, cy+r), fill=(16, 22, 26, 230), outline=LINE, width=p(2))
    d.arc((cx-r, cy-r, cx+r, cy+r), -90, 188, fill=rgba(LIME), width=p(14))
    d.text((cx - p(34), cy - p(26)), "78", font=font(BOLD, 36), fill=rgba(TEXT))
    d.text((cx - p(32), cy + p(18)), "READY", font=font(BOLD, 10), fill=QUIET)
    draw_metric_panel(img, (594, 306, 214, 126), "team readiness", "+14%", "from baseline")
    draw_metric_panel(img, (618, 462, 252, 128), "signal blend", "5", "mood, HRV, sleep, load")
    paste_rotated(img, phone_image("pulsecheck-media/01-today-checkin.png", 290, 612), (1010, 382), 5)
    save_card(img, "02-pulsecheck-readiness-engine")


def card_nora() -> None:
    img = make_bg()
    draw_brand(img)
    draw_copy(img, TextBlock(
        "Nora AI coach",
        "Private support\nthat knows\nthe context.",
        "Nora listens, asks better follow-ups, and translates athlete context into the right recovery or performance rep.",
        x=64,
        y=82,
        width=470,
    ))
    paste_rotated(img, phone_image("pulsecheck-media/02-nora-chat.png", 290, 612), (674, 402), -5)
    paste_rotated(img, phone_image("pulsecheck-media/08-box-breathing.png", 190, 402), (963, 262), 7)
    x, y, w, h = 792, 458, 340, 142
    rounded_panel(img, (x, y, w, h), radius=20)
    d = ImageDraw.Draw(img, "RGBA")
    d.text((p(x + 24), p(y + 22)), "Guided interventions", font=font(BOLD, 22), fill=rgba(TEXT))
    draw_wrapped(d, (p(x + 24), p(y + 58)), "Breathing, reset scripts, confidence reps, and staff handoff flows.", font(REG, 14), fill=MUTED, width=p(w - 48), line_gap=4)
    draw_chips(d, x + 24, y + 106, [("Box breathing", True), ("Coach note", False)])
    save_card(img, "03-pulsecheck-nora-ai-coach")


def card_wearables() -> None:
    img = make_bg()
    draw_brand(img)
    draw_copy(img, TextBlock(
        "Wearable context",
        "Connect body\nsignals to the\nperformance layer.",
        bullets=[
            "Google Health, Oura, Polar, and HealthKit-ready signal lanes.",
            "Readiness interpretation stays source-aware and privacy-aware.",
            "Human support gets better timing, not more noise.",
        ],
        x=64,
        y=78,
        width=500,
    ))
    d = ImageDraw.Draw(img, "RGBA")
    for i, (label, note) in enumerate([("62 bpm", "live heart-rate context"), ("HRV", "recovery trend input"), ("Sleep", "readiness modifier"), ("Load", "training stress signal")]):
        x = 594 + (i % 2) * 180
        y = 162 + (i // 2) * 128
        rounded_panel(img, (x, y, 166, 110), radius=17)
        d.text((p(x + 18), p(y + 20)), label, font=font(BOLD, 23), fill=rgba(TEXT))
        draw_wrapped(d, (p(x + 18), p(y + 56)), note, font(REG, 13), fill=MUTED, width=p(128), line_gap=3)
    paste_rotated(img, phone_image("pulsecheck-media/04-connect-wearable.png", 290, 612), (1010, 382), 4)
    save_card(img, "04-pulsecheck-wearable-context")


def card_training() -> None:
    img = make_bg()
    draw_brand(img)
    draw_copy(img, TextBlock(
        "Mental training protocol",
        "Turn check-ins\ninto reps.",
        "PulseCheck adapts the day’s mental-performance work from real readiness signals, then keeps the team aligned.",
        x=64,
        y=82,
        width=470,
    ))
    d = ImageDraw.Draw(img, "RGBA")
    rounded_panel(img, (552, 150, 342, 154), radius=20)
    d.text((p(576), p(172)), "Today's protocol", font=font(BOLD, 22), fill=rgba(TEXT))
    draw_wrapped(d, (p(576), p(210)), "Pressure Simulation · 12 min · breath control, attention lock, and post-rep reflection.", font(REG, 14), fill=MUTED, width=p(292), line_gap=4)
    draw_chips(d, 576, 256, [("Start rep", True), ("Track response", False)])
    for i, (title, note, status) in enumerate([
        ("Check in", "Capture private state and biometric posture.", "done"),
        ("Run the rep", "Nora adapts the training session to today.", "live"),
        ("Close the loop", "Update readiness and staff-level trend view.", "next"),
    ]):
        x, y = 566, 342 + i * 90
        rounded_panel(img, (x, y, 424, 72), radius=18, fill=(18, 24, 29, 214))
        d.rounded_rectangle((p(x+16), p(y+14), p(x+58), p(y+56)), radius=p(14), fill=rgba(LIME))
        d.text((p(x+32), p(y+23)), str(i+1), font=font(BOLD, 17), fill=(8, 11, 9, 255), anchor="mm")
        d.text((p(x+74), p(y+14)), title, font=font(BOLD, 18), fill=rgba(TEXT))
        d.text((p(x+74), p(y+39)), note, font=font(REG, 12), fill=MUTED)
        d.text((p(x+356), p(y+27)), status.upper(), font=font(BOLD, 11), fill=rgba(LIME))
    paste_rotated(img, phone_image("pulsecheck-media/05-training.png", 290, 612), (1026, 394), 6)
    save_card(img, "05-pulsecheck-mental-training-protocol")


def contact_sheet() -> None:
    thumbs = []
    for slug in [
        "01-pulsecheck-lab-human-performance",
        "02-pulsecheck-readiness-engine",
        "03-pulsecheck-nora-ai-coach",
        "04-pulsecheck-wearable-context",
        "05-pulsecheck-mental-training-protocol",
    ]:
        im = Image.open(OUT / f"{slug}.jpg").convert("RGB")
        thumbs.append(ImageOps.fit(im, (480, 270), method=Image.Resampling.LANCZOS))
    sheet = Image.new("RGB", (1000, 858), "#F4F5F7")
    for idx, thumb in enumerate(thumbs):
        x = 20 if idx % 2 == 0 else 500
        y = 20 + (idx // 2) * 286
        sheet.paste(thumb, (x, y))
    sheet.save(OUT / "_contact-sheet.jpg", "JPEG", quality=90, optimize=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    card_cover()
    card_readiness()
    card_nora()
    card_wearables()
    card_training()
    contact_sheet()
    for path in sorted(OUT.glob("*")):
        print(path)


if __name__ == "__main__":
    main()
