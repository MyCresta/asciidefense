"""Build the three interface fonts so every art style lays out identically.

Each art style uses its own typeface, but they all share one set of metrics:
every glyph is exactly as wide as a DejaVu Sans Mono glyph (1233/2048 em),
and every font has DejaVu Sans Mono's ascent, descent and line gap. Text then
takes up the same box in every style, so a swap never moves or resizes a button.

  ASCII   DejaVu Sans Mono, subset     -> fonts/spire-ascii-{400,700}.woff2
  Pixel   Pixelify Sans, monospaced    -> fonts/spire-pixel-{400,700}.woff2
  Vector  Nunito, monospaced           -> fonts/spire-vector-{400,700}.woff2

Usage: pip install fonttools brotli
       python3 tools/build-fonts.py [DEJAVU_DIR]
DejaVu ships with most Linux distributions (default /usr/share/fonts/truetype/dejavu).
Pixelify Sans and Nunito (from the @fontsource/nunito npm package) are kept in
tools/font-sources. Licenses for all three are in fonts/.
"""
import sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.subset import Subsetter, Options
from fontTools.varLib.instancer import instantiateVariableFont

OUT = Path(__file__).resolve().parent.parent / 'fonts'
# Printable ASCII plus Latin-1 (the interface uses &nbsp;).
CHARS = list(range(0x20, 0x7f)) + list(range(0xa0, 0x100))
CELL = 1233 / 2048  # DejaVu Sans Mono advance, in em


def subset(font, keep_layout=False):
    options = Options()
    options.layout_features = ['*'] if keep_layout else []
    options.name_IDs = ['*']
    options.notdef_outline = True
    options.hinting = False
    sub = Subsetter(options)
    sub.populate(unicodes=CHARS)
    sub.subset(font)


def rename(font, family, weight):
    style = 'Bold' if weight >= 700 else 'Regular'
    names = font['name']
    for record in list(names.names):
        if record.nameID in (1, 2, 3, 4, 6, 16, 17, 21, 22):
            names.removeNames(nameID=record.nameID)
    names.setName(family, 1, 3, 1, 0x409)
    names.setName(style, 2, 3, 1, 0x409)
    names.setName(f'{family} {style}', 4, 3, 1, 0x409)
    names.setName(f'{family}-{style}'.replace(' ', ''), 6, 3, 1, 0x409)
    names.setName(f'{family}-{style}'.replace(' ', '') + ';spire', 3, 3, 1, 0x409)
    font['OS/2'].usWeightClass = weight


def copy_vertical_metrics(font, reference):
    """Give font the reference's line box, scaled to its own units per em."""
    scale = font['head'].unitsPerEm / reference['head'].unitsPerEm
    r_hhea, r_os2 = reference['hhea'], reference['OS/2']
    hhea, os2 = font['hhea'], font['OS/2']
    hhea.ascent = round(r_hhea.ascent * scale)
    hhea.descent = round(r_hhea.descent * scale)
    hhea.lineGap = round(r_hhea.lineGap * scale)
    os2.sTypoAscender = round(r_os2.sTypoAscender * scale)
    os2.sTypoDescender = round(r_os2.sTypoDescender * scale)
    os2.sTypoLineGap = round(r_os2.sTypoLineGap * scale)
    os2.usWinAscent = round(r_os2.usWinAscent * scale)
    os2.usWinDescent = round(r_os2.usWinDescent * scale)
    # Match how browsers choose between the metric sets.
    os2.fsSelection = (os2.fsSelection & ~(1 << 7)) | (r_os2.fsSelection & (1 << 7))


def monospace(font, scale=1.0, margin=0.04):
    """Redraw every glyph centered in a cell of exactly CELL em.

    Glyphs are first scaled by `scale`; any glyph still wider than the cell
    (less a small margin) is narrowed to fit. Composites are decomposed and
    kerning and ligatures are dropped, since they would change text widths.
    """
    upm = font['head'].unitsPerEm
    cell = round(CELL * upm)
    glyph_set = font.getGlyphSet()
    glyf, hmtx = font['glyf'], font['hmtx']
    room = cell * (1 - margin)
    new = {}
    for name in font.getGlyphOrder():
        advance, _ = hmtx[name]
        bounds = BoundsPen(glyph_set)
        glyph_set[name].draw(bounds)
        sx = scale
        if bounds.bounds:
            x0, _, x1, _ = bounds.bounds
            ink = (x1 - x0) * scale
            if ink > room:
                sx = scale * room / (x1 - x0)
            # Center the ink if it has any, otherwise center the advance.
            dx = (cell - (x1 - x0) * sx) / 2 - x0 * sx
        else:
            dx = (cell - advance * sx) / 2
        outline = DecomposingRecordingPen(glyph_set)
        glyph_set[name].draw(outline)
        pen = TTGlyphPen(None)
        outline.replay(TransformPen(pen, (sx, 0, 0, scale, dx, 0)))
        new[name] = pen.glyph()
    for name, glyph in new.items():
        glyf[name] = glyph
        glyph.recalcBounds(glyf)
        hmtx[name] = (cell, getattr(glyph, 'xMin', 0))
    for table in ('GPOS', 'GSUB', 'kern', 'hdmx', 'LTSH', 'VDMX'):
        if table in font:
            del font[table]
    font['hhea'].advanceWidthMax = cell
    font['OS/2'].xAvgCharWidth = cell
    font['post'].isFixedPitch = 1
    font['OS/2'].panose.bProportion = 9


def meter_block(font):
    """In Vector, '#' only fills meters such as [####----]: draw it as a solid segment."""
    upm = font['head'].unitsPerEm
    cell = round(CELL * upm)
    name = font.getBestCmap()[ord('#')]
    x0, x1 = round(cell * .1), round(cell * .9)
    y0, y1 = round(-.02 * upm), round(.62 * upm)
    pen = TTGlyphPen(None)
    pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0)); pen.closePath()
    glyph = pen.glyph()
    font['glyf'][name] = glyph
    glyph.recalcBounds(font['glyf'])
    font['hmtx'][name] = (cell, x0)


def save(font, name):
    font.flavor = 'woff2'
    font.save(OUT / name)
    print('wrote', name, (OUT / name).stat().st_size, 'bytes')


SOURCES = Path(__file__).resolve().parent / 'font-sources'


def main(dejavu_dir='/usr/share/fonts/truetype/dejavu'):
    pixelify = SOURCES / 'pixelify-sans.woff2'
    nunito_400, nunito_700 = SOURCES / 'nunito-latin-400-normal.woff2', SOURCES / 'nunito-latin-700-normal.woff2'
    dejavu = Path(dejavu_dir)
    reference = TTFont(dejavu / 'DejaVuSansMono.ttf')
    for weight, file in ((400, 'DejaVuSansMono.ttf'), (700, 'DejaVuSansMono-Bold.ttf')):
        font = TTFont(dejavu / file)
        subset(font)
        rename(font, 'Spire ASCII', weight)
        save(font, f'spire-ascii-{weight}.woff2')
    for weight in (400, 700):
        font = instantiateVariableFont(TTFont(pixelify), {'wght': weight}, updateFontNames=False)
        subset(font)
        monospace(font, scale=1.0, margin=.06)
        copy_vertical_metrics(font, reference)
        rename(font, 'Spire Pixel', weight)
        save(font, f'spire-pixel-{weight}.woff2')
    for weight, file in ((400, nunito_400), (700, nunito_700)):
        font = TTFont(file)
        subset(font)
        monospace(font, scale=1.0, margin=.06)
        meter_block(font)
        copy_vertical_metrics(font, reference)
        rename(font, 'Spire Vector', weight)
        save(font, f'spire-vector-{weight}.woff2')


if __name__ == '__main__':
    main(*sys.argv[1:2])
