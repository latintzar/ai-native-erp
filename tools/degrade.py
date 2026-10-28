#!/usr/bin/env python3
"""THE DEGRADATION LIBRARY — what a printed sheet survives on its way back through a camera.

    «i expect this to be fully working when we wire everything, as long as you design it all well,
     spec it well etc so that when you build and test it's piss play cos you can even test it by
     exporting and downresolutioning and even muddling or adding fake dirt to the image and then
     running it through scanning all programmatically without requiring me to print and test»
                                                             — Peter, 2026-09-04 (FEED-IA §198)

This module is the «downresolutioning, muddling and fake dirt» half of that sentence, written once
so the QR harness and the parsing harness damage a page the SAME way and their two floors are
comparable numbers rather than two people's adjectives.

WHAT IT IS. A pure-Python image degradation library — Pillow and numpy, no OpenCV, no network, no
model. Every variant is a named, DETERMINISTIC function of (image, seed): the same page degraded
twice is the same bytes twice, so a floor measured on Tuesday is a floor a drive can re-assert on
Friday and a regression is a regression rather than a dice roll.

WHAT IT MODELS, and why each axis is on the list rather than a longer one:

  resolution  · the sheet photographed from further away, or a phone that downsamples. THE axis a
                QR module size actually fails on (THE-QR-SPEC QR-02.1 argues the whole M-vs-Q trade
                on module millimetres, and this is where that argument gets tested).
  blur        · a hand that moved, a lens that did not focus. σ in printed-pixel units.
  jpeg        · every phone photo is a JPEG, and a messaging app re-compresses it again. Ringing
                around high-contrast edges is exactly what a finder pattern is made of.
  noise       · salt-and-pepper: sensor noise at ISO 3200 in a cold room at 05:40, and dust. And
                `sensor`, the same impulse SEEN THROUGH A LENS, because no optical system can put a
                one-pixel spike into a picture whose modules are six pixels wide — the two floors
                differ, and reporting only one of them would either flatter or libel the mark.
  blot        · fish water and blood: dark blobs with soft edges, graded as a share of the symbol,
                which is the same currency error correction budgets itself in.
  ring        · a coffee-ring arc — a THIN dark curve crossing the whole symbol. Its own axis
                because it damages a different set of modules than a blob does, and reaches the
                finder patterns almost every time.
  grime · stain · ink
              · the same dirt at its REAL SIZE IN MILLIMETRES, at three opacities — fish water,
                coffee, and a marker pen. The only axes on which a bigger mark can show a benefit,
                and therefore the axes the footprint fork has to be argued on. The opacity is not
                decoration: the same three 5 mm drops decoded 24/24 translucent and 8/24 opaque.
  rotate      · nobody holds paper square.
  skew        · nobody holds a phone parallel to the paper either. A perspective warp, not a shear.
  lighting    · a cold-room strip light: one bright corner, one dark one, plus global contrast loss.
  combo       · «a phone photo of a creased sheet at 05:40» — blur + skew + dirt + JPEG 50 together,
                because degradations compose and a floor per axis is not a floor for a morning.

USE IT
    from degrade import VARIANTS, apply_variant, variant_names
    hurt = apply_variant(image, 'res-0.35', seed=7)                     # one named variant
    hurt = apply_variant(page, 'splash-3x3mm', 7, Sheet(box, px_per_mm)) # one that needs a scale
    for name in variant_names('qr'):                        # the QR sweep's own list
        ...

Run it directly to write a contact sheet of every variant of an image:
    python3 tools/degrade.py <image.png> <out-dir> [--seed 7]
"""
from __future__ import annotations

import io
import math
import pathlib
import sys
import zlib
from dataclasses import dataclass
from typing import Callable

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

__all__ = [
    'Sheet', 'Variant', 'VARIANTS', 'apply_variant', 'variant_names', 'variants_for', 'axes',
    'down_resolution', 'gaussian_blur', 'jpeg_cycle', 'salt_and_pepper', 'sensor_noise',
    'dirt', 'splash', 'darkened_share', 'rotate', 'perspective', 'uneven_light', 'phone_at_0540',
]

# ── THE SEED LAW ───────────────────────────────────────────────────────────────────────────────
# Every randomised step draws from a generator seeded with (seed, variant name), never from the
# global numpy state. Two variants in one run therefore cannot shift each other's dirt, and the
# order the harness runs them in cannot change any of their results.
#
# ⚠ THE SALT IS CRC32, NOT `hash()`, AND THAT IS A BUG THIS FILE ALREADY HAD. The first version
# mixed the salt in with Python's built-in `hash()`, which for strings is SEEDED PER PROCESS —
# so two runs of the same drive, same seed, same variant, produced different dirt, and the drive
# came back 25 GREEN / 0 RED on one run and 22 GREEN / 3 RED on the next. A degradation harness
# whose damage moves between runs cannot state a floor at all: every red is «maybe the dice» and
# every green is «maybe the dice too». `zlib.crc32` is stable across processes, machines and
# Python versions, which is the whole requirement.

def _rng(seed: int, salt: str) -> np.random.Generator:
    mixed = (int(seed) & 0xFFFFFFFF) ^ zlib.crc32(salt.encode())
    return np.random.default_rng(np.random.SeedSequence([mixed, len(salt)]))


def _rgb(image: Image.Image) -> Image.Image:
    return image if image.mode == 'RGB' else image.convert('RGB')


# ── THE AXES ───────────────────────────────────────────────────────────────────────────────────

def down_resolution(image: Image.Image, factor: float, seed: int = 0) -> Image.Image:
    """Shrink to `factor` of the printed pixel density and put it back at the original size.

    Down THEN up, on purpose: a decoder is handed a picture with the SAME nominal size and less
    information in it, which is what «a photo taken from further away» actually gives you. The way
    down is AREA (a real sensor integrates), the way back is BILINEAR (no invented sharpness)."""
    if factor >= 0.999:
        return _rgb(image).copy()
    small = (max(1, round(image.width * factor)), max(1, round(image.height * factor)))
    return _rgb(image).resize(small, Image.Resampling.BOX).resize(image.size, Image.Resampling.BILINEAR)


def gaussian_blur(image: Image.Image, sigma: float, seed: int = 0) -> Image.Image:
    """σ in pixels of the image as given. A σ of 1 on a 6-px module is a soft photo; on a 3-px
    module it is most of a module, which is the point of measuring it against module size."""
    return _rgb(image).filter(ImageFilter.GaussianBlur(radius=float(sigma)))


def jpeg_cycle(image: Image.Image, quality: int, seed: int = 0, rounds: int = 1) -> Image.Image:
    """Encode and decode as JPEG at `quality`, `rounds` times — a photo sent through a chat app
    and forwarded is compressed more than once, and the ringing accumulates."""
    out = _rgb(image)
    for _ in range(max(1, rounds)):
        buffer = io.BytesIO()
        out.save(buffer, format='JPEG', quality=int(quality), subsampling=2)
        buffer.seek(0)
        out = Image.open(buffer).convert('RGB')
    return out


def salt_and_pepper(image: Image.Image, share: float, seed: int = 0) -> Image.Image:
    """Flip `share` of pixels to pure black or pure white, half and half. Sensor noise and dust."""
    array = np.array(_rgb(image))
    rng = _rng(seed, 'salt%.4f' % share)
    picked = rng.random(array.shape[:2])
    array[picked < share / 2] = 0
    array[(picked >= share / 2) & (picked < share)] = 255
    return Image.fromarray(array)


def dirt(image: Image.Image, coverage: float = 0.06, ring: bool = True, seed: int = 0,
         opacity: int = 210, region: tuple[int, int, int, int] | None = None,
         ring_width: float = 0.012) -> Image.Image:
    """Fish water, blood, a coffee ring — SIZED BY THE AREA IT COVERS, not by a blotch count.

    ⚠ THE REASON THIS IS COVERAGE-CONTROLLED. «Five blotches» is not a quantity: five blotches of
    an unstated radius covered 5.6 % of one symbol and 15 % of the next, and a floor read off that
    is a lottery rather than a measurement. Error correction has a BUDGET stated in per cent of the
    symbol (15 % at level M), so damage has to be stated in the same currency or the two numbers
    cannot be compared at all. `coverage` is the share of the image the dirt darkens, and the
    library places blotches until it MEASURES that share.

    The blotches have soft edges — drawn on their own layer and blurred before compositing, because
    real dirt has a penumbra and a hard-edged rectangle is a far easier thing to survive than a
    smear. `ring` adds a coffee-ring arc: thin, dark and curved, crossing the symbol rather than
    sitting on a corner of it, which damages a different set of modules than a blob does.

    Placement stays random, and that is deliberate: where the dirt lands is the whole question.
    A blot on a finder pattern is fatal at any error-correction level, and a batch of twenty
    locators each with its own placement is what turns that from an anecdote into a rate.

    ⚠ `region` IS WHAT COVERAGE IS A SHARE OF. A mark photographed on a sheet has white paper
    around it, and «5 % of the photograph» is not «5 % of the symbol» — it is a quarter of it, or a
    sixteenth, depending only on how the person framed the shot. Error correction budgets the
    SYMBOL, so the caller states the symbol's box and the coverage is measured inside it. Dirt is
    still allowed to fall outside that box: a splash does not respect a border."""
    base = _rgb(image)
    rng = _rng(seed, 'dirt%.3f' % coverage)
    box = region or (0, 0, base.width, base.height)
    span_x, span_y = box[2] - box[0], box[3] - box[1]
    short = min(span_x, span_y)
    layer = Image.new('L', base.size, 0)
    ink = ImageDraw.Draw(layer)
    if ring:
        radius = float(rng.uniform(0.34, 0.5)) * short
        cx = box[0] + float(rng.uniform(0.25, 0.75)) * span_x
        cy = box[1] + float(rng.uniform(0.25, 0.75)) * span_y
        start = float(rng.uniform(0, 360))
        ink.arc([cx - radius, cy - radius, cx + radius, cy + radius],
                start=start, end=start + float(rng.uniform(200, 330)),
                fill=200, width=max(2, int(short * float(ring_width))))
    wanted = float(coverage) * span_x * span_y
    # A blotch is drawn, the covered area INSIDE THE BOX is MEASURED, and the next one is drawn
    # only if the target has not been met. Twenty is a ceiling on the loop, never a target.
    for _ in range(20):
        inside = np.array(layer)[box[1]:box[3], box[0]:box[2]]
        covered = np.count_nonzero(inside > 96)
        if covered >= wanted:
            break
        remaining = max(wanted - covered, 1.0)
        radius = min(float(np.sqrt(remaining / math.pi)) * float(rng.uniform(0.55, 1.0)), short * 0.30)
        radius = max(radius, short * 0.02)
        cx = box[0] + float(rng.uniform(-0.05, 1.05)) * span_x
        cy = box[1] + float(rng.uniform(-0.05, 1.05)) * span_y
        squash = float(rng.uniform(0.6, 1.0))
        ink.ellipse([cx - radius, cy - radius * squash, cx + radius, cy + radius * squash],
                    fill=int(rng.integers(180, 255)))
    layer = layer.filter(ImageFilter.GaussianBlur(radius=max(1.0, short * 0.006)))
    layer = layer.point(lambda value: min(255, int(value * opacity / 255)))
    return Image.composite(Image.new('RGB', base.size, (26, 22, 18)), base, layer)


def splash(image: Image.Image, drops: int = 3, mm: float = 3.0, px_per_mm: float = 6.0,
           spread: float = 0.4, seed: int = 0, region: tuple[int, int, int, int] | None = None,
           opacity: int = 220) -> Image.Image:
    """DIRT AT ITS REAL SIZE. `drops` splashes of about `mm` millimetres across, landing on and
    around `region`.

    ⚠ THIS IS THE MODEL THAT CAN ANSWER «WOULD A BIGGER MARK HELP». `dirt` scales its blotches
    with the symbol, so growing the mark grows the dirt with it and the answer always comes back
    «no difference» — which is an artefact of the model, not a fact about paper. A drop of fish
    water is three millimetres wide on any mark. Measure it that way and a 20 mm mark and a 26 mm
    mark stop being the same experiment: the same drop covers a smaller share of the bigger one,
    and covers less of its finder pattern, which is the module a decoder cannot do without."""
    base = _rgb(image)
    rng = _rng(seed, 'splash%d-%.2f' % (drops, mm))
    box = region or (0, 0, base.width, base.height)
    span_x, span_y = box[2] - box[0], box[3] - box[1]
    layer = Image.new('L', base.size, 0)
    ink = ImageDraw.Draw(layer)
    for _ in range(max(0, int(drops))):
        radius = 0.5 * float(mm) * float(px_per_mm) * float(rng.uniform(1 - spread, 1 + spread))
        cx = box[0] + float(rng.uniform(-0.05, 1.05)) * span_x
        cy = box[1] + float(rng.uniform(-0.05, 1.05)) * span_y
        squash = float(rng.uniform(0.65, 1.0))
        ink.ellipse([cx - radius, cy - radius * squash, cx + radius, cy + radius * squash],
                    fill=int(rng.integers(190, 255)))
    layer = layer.filter(ImageFilter.GaussianBlur(radius=max(1.0, float(px_per_mm) * 0.12)))
    layer = layer.point(lambda value: min(255, int(value * opacity / 255)))
    return Image.composite(Image.new('RGB', base.size, (26, 22, 18)), base, layer)


def darkened_share(before: Image.Image, after: Image.Image) -> float:
    """How much of the page a degradation actually darkened — the number `dirt` is graded on, and
    the one that makes «damage» and «error-correction budget» the same currency."""
    a = np.array(before.convert('L'), dtype=np.int16)
    b = np.array(after.convert('L'), dtype=np.int16)
    if a.shape != b.shape:
        return float('nan')
    return float(np.count_nonzero((a - b) > 40) / a.size)


def rotate(image: Image.Image, degrees: float, seed: int = 0, pad: int = 40) -> Image.Image:
    """Rotate on a white page. Padded first, because a symbol rotated into its own edge has lost
    its quiet zone to the crop rather than to the rotation, and that would measure the wrong thing."""
    base = _rgb(image)
    canvas = Image.new('RGB', (base.width + 2 * pad, base.height + 2 * pad), 'white')
    canvas.paste(base, (pad, pad))
    return canvas.rotate(float(degrees), resample=Image.Resampling.BICUBIC, expand=True, fillcolor='white')


def _perspective_coefficients(source: list[tuple[float, float]],
                              target: list[tuple[float, float]]) -> tuple[float, ...]:
    """The eight coefficients PIL wants for a projective map. Solved, not guessed."""
    matrix = []
    for (sx, sy), (tx, ty) in zip(source, target):
        matrix.append([tx, ty, 1, 0, 0, 0, -sx * tx, -sx * ty])
        matrix.append([0, 0, 0, tx, ty, 1, -sy * tx, -sy * ty])
    a = np.array(matrix, dtype=float)
    b = np.array(source, dtype=float).reshape(8)
    return tuple(np.linalg.solve(a, b))


def perspective(image: Image.Image, strength: float, seed: int = 0, pad: int = 40) -> Image.Image:
    """A phone held at an angle: the far edge of the paper is shorter than the near one.

    `strength` is the share of the width the top edge loses (0.08 mild, 0.20 strong). A real
    projective warp, solved from four corners — a shear would keep every horizontal line the same
    length, and it is precisely the change in module SIZE across the symbol that a decoder has to
    resolve here."""
    base = _rgb(image)
    canvas = Image.new('RGB', (base.width + 2 * pad, base.height + 2 * pad), 'white')
    canvas.paste(base, (pad, pad))
    w, h = canvas.size
    inset = float(strength) * w
    rise = float(strength) * h * 0.35
    source = [(0.0, 0.0), (float(w), 0.0), (float(w), float(h)), (0.0, float(h))]
    target = [(inset, rise), (w - inset, 0.0), (float(w), float(h)), (0.0, h - rise)]
    coefficients = _perspective_coefficients(source, target)
    return canvas.transform((w, h), Image.Transform.PERSPECTIVE, coefficients,
                            resample=Image.Resampling.BICUBIC, fillcolor='white')


def uneven_light(image: Image.Image, contrast: float = 0.55, gradient: float = 0.45,
                 seed: int = 0) -> Image.Image:
    """A cold-room strip light overhead and to one side: a diagonal illumination ramp plus global
    contrast loss. Multiplicative, because light is."""
    base = ImageEnhance.Contrast(_rgb(image)).enhance(float(contrast))
    array = np.array(base, dtype=np.float32)
    height, width = array.shape[:2]
    ys = np.linspace(0.0, 1.0, height, dtype=np.float32)[:, None]
    xs = np.linspace(0.0, 1.0, width, dtype=np.float32)[None, :]
    ramp = 1.0 - float(gradient) * (0.65 * ys + 0.35 * xs)
    array *= ramp[:, :, None]
    return Image.fromarray(np.clip(array, 0, 255).astype(np.uint8))


def phone_at_0540(image: Image.Image, seed: int = 0, coverage: float = 0.06,
                  region: tuple[int, int, int, int] | None = None) -> Image.Image:
    """THE MORNING ITSELF. A phone photo of a creased sheet in a cold room before dawn: soft focus,
    held at an angle, dirty paper, sent as a JPEG. Composed in the order the world composes them —
    the paper is dirty and creased BEFORE the camera sees it, the camera's own faults come next,
    and the compression is last because it happens to the file.

    The dirt is held at `coverage` INSIDE level M's own 15 % budget, so the combination measures
    what stacking degradations costs rather than re-measuring the occlusion floor by accident. The
    noise is put through the lens, because a lens is what a camera has: an impulse one pixel wide
    in an image whose modules are six pixels wide is a thing no optical system can produce."""
    step = dirt(image, coverage=coverage, ring=True, seed=seed, opacity=190, region=region)
    step = _crease(step, seed=seed)
    step = perspective(step, 0.09, seed=seed)
    step = rotate(step, -6.0, seed=seed, pad=12)
    step = gaussian_blur(step, 1.1)
    step = uneven_light(step, contrast=0.7, gradient=0.35)
    step = gaussian_blur(salt_and_pepper(step, 0.004, seed=seed), 0.6)
    return jpeg_cycle(step, 50, rounds=2)


def sensor_noise(image: Image.Image, share: float, sigma: float = 0.6, seed: int = 0) -> Image.Image:
    """Impulse noise SEEN THROUGH A LENS — the physically honest noise model.

    ⚠ WHY THIS EXISTS BESIDE `salt_and_pepper`. Pure impulse noise at print resolution flips single
    pixels, and no camera can put a one-pixel spike into an image whose modules are six pixels
    across: diffraction and the sensor's own fill factor spread any point over at least a pixel or
    two. The difference is not academic — it is the whole gap between the two noise floors this
    harness reports, and reporting only the pathological one would understate a working mark while
    reporting only the kind one would flatter it. Both are measured; both are stated."""
    return gaussian_blur(salt_and_pepper(image, share, seed=seed), sigma)


def _crease(image: Image.Image, seed: int = 0) -> Image.Image:
    """One fold across the sheet: a soft bright line with a soft dark line beside it, which is what
    a crease is under a flat light. Not a cut — the paper is still there, it just catches the light
    differently, and a decoder has to read modules through it."""
    base = _rgb(image)
    rng = _rng(seed, 'crease')
    array = np.array(base, dtype=np.float32)
    height, width = array.shape[:2]
    axis = np.arange(height, dtype=np.float32)[:, None] + 0.0 * np.arange(width, dtype=np.float32)[None, :]
    at = float(rng.uniform(0.35, 0.65)) * height
    tilt = float(rng.uniform(-0.12, 0.12))
    axis = axis + tilt * np.arange(width, dtype=np.float32)[None, :]
    distance = axis - at
    spread = max(2.0, height * 0.012)
    bright = np.exp(-((distance - spread) ** 2) / (2 * spread ** 2)) * 34.0
    dark = np.exp(-((distance + spread) ** 2) / (2 * spread ** 2)) * 40.0
    array += (bright - dark)[:, :, None]
    return Image.fromarray(np.clip(array, 0, 255).astype(np.uint8))


# ── THE NAMED VARIANTS ─────────────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class Sheet:
    """WHAT THE IMAGE IS A PICTURE OF. Two facts a degradation cannot invent for itself.

    `region` · the box a damage BUDGET is a share of — the symbol on the sheet, the table on the
      albarán. «5 % of the photograph» is not «5 % of the symbol»; it is a quarter of it or a
      sixteenth, depending only on how the person framed the shot.
    `px_per_mm` · how big a millimetre is in this picture. ⚠ THIS IS THE FACT THAT DECIDES WHETHER
      A BIGGER MARK IS WORTH ANYTHING. A drop of fish water is about three millimetres wide whether
      it lands on a 20 mm mark or a 26 mm one — so proportional dirt (a fixed share of the symbol)
      can never show that growing the mark helps, and physical dirt shows it immediately. Both
      models are in this file for exactly that reason, and the spec quotes both."""
    region: tuple[int, int, int, int] | None = None
    px_per_mm: float | None = None


@dataclass(frozen=True)
class Variant:
    """One named degradation. `axis` groups the steps a floor is computed along; `rank` orders
    them from gentlest to harshest INSIDE that axis, which is what makes «the floor» a well-defined
    thing rather than a set of unordered results.

    `apply(image, seed, sheet)` — the steps that budget nothing (a blur applies to the whole
    photograph) ignore the sheet entirely."""
    name: str
    axis: str
    rank: int
    label: str
    apply: Callable[..., Image.Image]
    needs: tuple[str, ...] = ()


def _variant(name: str, axis: str, rank: int, label: str, fn: Callable[..., Image.Image],
             needs: tuple[str, ...] = (), **kwargs) -> Variant:
    def run(image, seed, sheet=None, _f=fn, _k=kwargs, _n=needs):
        sheet = sheet or Sheet()
        extra = {}
        if 'region' in _n:
            extra['region'] = sheet.region
        if 'px_per_mm' in _n:
            if not sheet.px_per_mm:
                raise ValueError(name + ' is a physical degradation and needs Sheet(px_per_mm=…)')
            extra['px_per_mm'] = sheet.px_per_mm
        return _f(image, seed=seed, **extra, **_k)
    return Variant(name, axis, rank, label, run, needs)


VARIANTS: dict[str, Variant] = {variant.name: variant for variant in [
    Variant('clean', 'clean', 0, 'the sheet as exported', lambda image, seed, sheet=None: _rgb(image).copy()),

    # Each axis runs PAST the brief's steps until it breaks. A sweep whose harshest step still
    # passes has not found a floor — it has found the end of the list, and the two are not the
    # same fact. The brief's own steps keep their names; the ones after them are the measurement.
    _variant('res-1.00', 'resolution', 0, 'full printed density', down_resolution, factor=1.0),
    _variant('res-0.50', 'resolution', 1, 'half the printed density', down_resolution, factor=0.5),
    _variant('res-0.35', 'resolution', 2, '35% of the printed density', down_resolution, factor=0.35),
    _variant('res-0.25', 'resolution', 3, 'a quarter of the printed density', down_resolution, factor=0.25),
    _variant('res-0.20', 'resolution', 4, 'a fifth of the printed density', down_resolution, factor=0.20),
    _variant('res-0.15', 'resolution', 5, '15% of the printed density', down_resolution, factor=0.15),
    _variant('res-0.12', 'resolution', 6, '12% of the printed density', down_resolution, factor=0.12),

    _variant('blur-0.5', 'blur', 0, 'gaussian blur σ 0.5', gaussian_blur, sigma=0.5),
    _variant('blur-1.0', 'blur', 1, 'gaussian blur σ 1', gaussian_blur, sigma=1.0),
    _variant('blur-1.5', 'blur', 2, 'gaussian blur σ 1.5', gaussian_blur, sigma=1.5),
    _variant('blur-2.0', 'blur', 3, 'gaussian blur σ 2', gaussian_blur, sigma=2.0),
    _variant('blur-3.0', 'blur', 4, 'gaussian blur σ 3', gaussian_blur, sigma=3.0),
    _variant('blur-4.0', 'blur', 5, 'gaussian blur σ 4', gaussian_blur, sigma=4.0),

    _variant('jpeg-80', 'jpeg', 0, 'JPEG quality 80', jpeg_cycle, quality=80),
    _variant('jpeg-50', 'jpeg', 1, 'JPEG quality 50', jpeg_cycle, quality=50),
    _variant('jpeg-30', 'jpeg', 2, 'JPEG quality 30', jpeg_cycle, quality=30),
    _variant('jpeg-15', 'jpeg', 3, 'JPEG quality 15', jpeg_cycle, quality=15),
    _variant('jpeg-30x3', 'jpeg', 4, 'JPEG 30, forwarded three times', jpeg_cycle, quality=30, rounds=3),

    # THE BRIEF'S OWN NOISE AXIS: pure impulse, at print resolution. Kept exactly as asked.
    _variant('noise-0.5', 'noise', 0, 'salt-and-pepper 0.5%', salt_and_pepper, share=0.005),
    _variant('noise-2', 'noise', 1, 'salt-and-pepper 2%', salt_and_pepper, share=0.02),
    _variant('noise-5', 'noise', 2, 'salt-and-pepper 5%', salt_and_pepper, share=0.05),
    # AND THE SAME NOISE THROUGH A LENS — see `sensor_noise`. Both floors are reported.
    _variant('sensor-0.5', 'sensor', 0, 'sensor noise 0.5% through the lens', sensor_noise, share=0.005),
    _variant('sensor-2', 'sensor', 1, 'sensor noise 2% through the lens', sensor_noise, share=0.02),
    _variant('sensor-5', 'sensor', 2, 'sensor noise 5% through the lens', sensor_noise, share=0.05),
    _variant('sensor-10', 'sensor', 3, 'sensor noise 10% through the lens', sensor_noise, share=0.10),

    # ── DIRT, ON THREE AXES, BECAUSE IT IS THREE DIFFERENT DAMAGES ────────────────────────────
    # THE FIRST SWEEP MIXED THEM AND THE FLOOR WAS UNREADABLE. «Five blotches and a coffee ring»
    # failed at 2 % and passed at 15 %, which is not a floor, it is a lottery — and the reason was
    # that the RING alone already covers 2.5 % of the symbol as one long curve across it, so the
    # gentlest step of the axis was never gentle. Split apart, each one says a different true thing.
    #
    #   blot   · blobs only, graded as a share of the symbol — the axis that is in the same
    #            currency as the error-correction budget, and therefore the one that can be held
    #            against level M's 15 %.
    #   ring   · one coffee-ring arc, graded by how wide the ring is. A thin curve crossing the
    #            whole symbol damages a different set of modules than a blob does, and it is the
    #            one that reaches the finder patterns almost every time.
    #   splash · dirt at its REAL SIZE in millimetres — the only axis on which growing the mark
    #            can show a benefit, and therefore the axis QR-02.1's fork has to be argued on.
    _variant('blot-02', 'blot', 0, 'opaque blobs over 2% of the symbol', dirt, ('region',), coverage=0.02, ring=False),
    _variant('blot-05', 'blot', 1, 'opaque blobs over 5% of the symbol', dirt, ('region',), coverage=0.05, ring=False),
    _variant('blot-08', 'blot', 2, 'opaque blobs over 8% of the symbol', dirt, ('region',), coverage=0.08, ring=False),
    _variant('blot-15', 'blot', 3, "opaque blobs over 15% — level M's whole budget", dirt, ('region',), coverage=0.15, ring=False),

    _variant('ring-thin', 'ring', 0, 'a coffee ring, 0.6% of the symbol wide', dirt, ('region',), coverage=0.0, ring=True, ring_width=0.006),
    _variant('ring', 'ring', 1, 'a coffee ring, 1.2% wide', dirt, ('region',), coverage=0.0, ring=True, ring_width=0.012),
    _variant('ring-wide', 'ring', 2, 'a coffee ring, 2.4% wide', dirt, ('region',), coverage=0.0, ring=True, ring_width=0.024),

    # ── AND DIRT HAS AN OPACITY, WHICH TURNS OUT TO BE THE PARAMETER THAT DECIDES EVERYTHING ──
    # Measured on this harness: three 5 mm drops on the 20 mm mark decoded 8/24 opaque, 18/24 as a
    # dark stain and 24/24 translucent. So «dirt» without an opacity is not a quantity either — and
    # the cold room's own dirt, fish water, is the translucent one. Three ladders, named for what
    # they actually are, and the spec quotes all three rather than the scariest.
    #   grime · fish water, brine, melted ice — translucent, the everyday case
    #   stain · coffee, blood that has dried, sauce — dark but still see-through
    #   ink   · a marker pen, fresh blood, a printer smear — OPAQUE, the worst case
    _variant('grime-3x3mm', 'grime', 0, 'three 3 mm splashes of fish water', splash, ('region', 'px_per_mm'), drops=3, mm=3.0, opacity=90),
    _variant('grime-3x5mm', 'grime', 1, 'three 5 mm splashes of fish water', splash, ('region', 'px_per_mm'), drops=3, mm=5.0, opacity=90),
    _variant('grime-6x5mm', 'grime', 2, 'six 5 mm splashes of fish water', splash, ('region', 'px_per_mm'), drops=6, mm=5.0, opacity=90),

    _variant('stain-1x3mm', 'stain', 0, 'one 3 mm coffee stain', splash, ('region', 'px_per_mm'), drops=1, mm=3.0, opacity=150),
    _variant('stain-3x3mm', 'stain', 1, 'three 3 mm coffee stains', splash, ('region', 'px_per_mm'), drops=3, mm=3.0, opacity=150),
    _variant('stain-3x5mm', 'stain', 2, 'three 5 mm coffee stains', splash, ('region', 'px_per_mm'), drops=3, mm=5.0, opacity=150),
    _variant('stain-6x5mm', 'stain', 3, 'six 5 mm coffee stains', splash, ('region', 'px_per_mm'), drops=6, mm=5.0, opacity=150),

    _variant('ink-1x2mm', 'ink', 0, 'one opaque 2 mm blot', splash, ('region', 'px_per_mm'), drops=1, mm=2.0),
    _variant('ink-1x3mm', 'ink', 1, 'one opaque 3 mm blot', splash, ('region', 'px_per_mm'), drops=1, mm=3.0),
    _variant('ink-3x3mm', 'ink', 2, 'three opaque 3 mm blots', splash, ('region', 'px_per_mm'), drops=3, mm=3.0),
    _variant('ink-3x5mm', 'ink', 3, 'three opaque 5 mm blots', splash, ('region', 'px_per_mm'), drops=3, mm=5.0),
    _variant('ink-6x5mm', 'ink', 4, 'six opaque 5 mm blots', splash, ('region', 'px_per_mm'), drops=6, mm=5.0),

    # AND THE REALISTIC COMBINATION, kept because a cold room delivers both at once.
    _variant('dirt-05', 'dirt', 0, 'opaque blobs over 5% and a coffee ring', dirt, ('region',), coverage=0.05, ring=True),
    _variant('dirt-15', 'dirt', 1, 'opaque blobs over 15% and a coffee ring', dirt, ('region',), coverage=0.15, ring=True),

    _variant('rot-3', 'rotation', 0, 'rotated 3°', rotate, degrees=3.0),
    _variant('rot-10', 'rotation', 1, 'rotated 10°', rotate, degrees=10.0),
    _variant('rot-20', 'rotation', 2, 'rotated 20°', rotate, degrees=20.0),
    _variant('rot-45', 'rotation', 3, 'rotated 45°', rotate, degrees=45.0),
    _variant('rot-minus-3', 'rotation', 0, 'rotated −3°', rotate, degrees=-3.0),
    _variant('rot-minus-10', 'rotation', 1, 'rotated −10°', rotate, degrees=-10.0),
    _variant('rot-minus-20', 'rotation', 2, 'rotated −20°', rotate, degrees=-20.0),

    _variant('skew-mild', 'skew', 0, 'mild perspective skew', perspective, strength=0.08),
    _variant('skew-strong', 'skew', 1, 'strong perspective skew', perspective, strength=0.20),
    _variant('skew-severe', 'skew', 2, 'severe perspective skew', perspective, strength=0.32),

    _variant('light-uneven', 'lighting', 0, 'low contrast, uneven light', uneven_light),
    _variant('light-harsh', 'lighting', 1, 'harsher contrast loss and ramp', uneven_light, contrast=0.38, gradient=0.6),
    _variant('light-dire', 'lighting', 2, 'contrast 0.22 and a steep ramp', uneven_light, contrast=0.22, gradient=0.75),

    _variant('combo-0540', 'combo', 0, 'a phone photo of a creased sheet at 05:40',
             phone_at_0540, ('region',)),
    _variant('combo-0540-hard', 'combo', 1, "the same morning, dirt at level M's full 15% budget",
             phone_at_0540, ('region',), coverage=0.15),
]}

# The QR sweep walks every axis. The parsing sweep is BOUNDED — each read costs ~90 s of a live
# provider's time, so eight variants is what a floor is measured on there (THE-PARSING-SPEC).
QR_SWEEP = [name for name in VARIANTS]
PARSE_SWEEP = ['clean', 'res-0.50', 'blur-1.0', 'jpeg-30', 'dirt-05', 'rot-10', 'skew-mild', 'combo-0540']


def variant_names(sweep: str = 'qr') -> list[str]:
    return list(QR_SWEEP) if sweep == 'qr' else list(PARSE_SWEEP)


def variants_for(sweep: str = 'qr') -> list[Variant]:
    return [VARIANTS[name] for name in variant_names(sweep)]


def apply_variant(image: Image.Image, name: str, seed: int = 0, sheet: 'Sheet | None' = None) -> Image.Image:
    """The one door. A name that is not a variant is an error, never a quiet pass-through.

    `sheet` says what the image is a picture of — see `Sheet`. Omit it and the whole image is the
    box, which is right for a page, and the physical variants refuse rather than guess a scale."""
    if name not in VARIANTS:
        raise KeyError('no such variant: ' + name + ' — have ' + ', '.join(sorted(VARIANTS)))
    return VARIANTS[name].apply(image, int(seed), sheet)


def axes(sweep: str = 'qr') -> dict[str, list[Variant]]:
    """The sweep grouped by axis, each axis ordered gentlest → harshest. A floor is read off this."""
    grouped: dict[str, list[Variant]] = {}
    for variant in variants_for(sweep):
        grouped.setdefault(variant.axis, []).append(variant)
    for group in grouped.values():
        group.sort(key=lambda variant: (variant.rank, variant.name))
    return grouped


def _contact_sheet(source: pathlib.Path, out: pathlib.Path, seed: int) -> None:
    out.mkdir(parents=True, exist_ok=True)
    image = Image.open(source).convert('RGB')
    for variant in VARIANTS.values():
        path = out / (variant.name + '.png')
        apply_variant(image, variant.name, seed, Sheet(px_per_mm=image.width / 60.0)).save(path)
        print('%-14s %-46s %s' % (variant.name, variant.label, path))


if __name__ == '__main__':
    if len(sys.argv) < 3:
        raise SystemExit(__doc__.strip().splitlines()[-1])
    seed = 7
    if '--seed' in sys.argv:
        seed = int(sys.argv[sys.argv.index('--seed') + 1])
    _contact_sheet(pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), seed)
