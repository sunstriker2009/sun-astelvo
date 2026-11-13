"""Build ASTELVO vector masters and raster exports. Requires fonttools, Pillow, Inkscape.
Fonts: Liberation Sans Regular/Bold (SIL OFL); see assets/brand/FONT-LICENSE.txt.
Run from repository root: python3 scripts/brand/build_brand.py
Optional ASTELVO_FONT_DIR overrides /usr/share/fonts/truetype/liberation.
"""
from pathlib import Path
import os, json, subprocess, shutil
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2] if Path(__file__).parent.name == 'brand' else Path(__file__).parent / 'package'
OUT = ROOT / 'assets/brand'
OUT.mkdir(parents=True, exist_ok=True)
FONT = Path(os.environ.get('ASTELVO_FONT_DIR', '/usr/share/fonts/truetype/liberation'))
COLORS = dict(background='#0B1020', surface='#151D30', accent='#879BFF', accentDeep='#5865D8', text='#F5F7FA', muted='#9CA8BC', sun='#F6C453')

# Deliberate geometric reconstruction of approved raster concept; not an automatic trace.
LAYERS = [
 'M18 218 96 87Q109 65 133 65H161L174 94H136Q121 94 112 109L42 218Z',
 'M50 235 123 121Q133 105 150 105H177L190 135H156Q145 135 139 145L80 235Z',
 'M91 247 151 155Q158 144 173 144H192L244 247Z M170 181Q169 179 169 183V218Q169 222 173 220L202 203Q205 201 202 199Z'
]
STAR = 'M152 16C150 27 147 31 139 34C147 37 150 41 152 52C154 41 157 37 165 34C157 31 154 27 152 16Z'

def mark(palette, star=True):
    parts = [f'<path d="{d}" fill="{color}" fill-rule="evenodd"/>' for d,color in zip(LAYERS,palette)]
    if star: parts.append(f'<path d="{STAR}" fill="{palette[-1]}"/>')
    return ''.join(parts)

def svg(w,h,body,title):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-labelledby="title"><title id="title">{title}</title>{body}</svg>\n'

def outline(text,x,y,size,bold=False,spacing=0,color='#F5F7FA'):
    f=TTFont(FONT / ('LiberationSans-Bold.ttf' if bold else 'LiberationSans-Regular.ttf'))
    glyphs=f.getGlyphSet(); cmap=f.getBestCmap(); scale=size/f['head'].unitsPerEm
    cursor=0; paths=[]
    for c in text:
        name=cmap[ord(c)]; pen=SVGPathPen(glyphs); glyphs[name].draw(pen)
        paths.append(f'<path d="{pen.getCommands()}" transform="translate({cursor:.3f} 0)"/>')
        cursor += f['hmtx'][name][0]+spacing/scale
    return f'<g fill="{color}" transform="translate({x} {y}) scale({scale} {-scale})">'+''.join(paths)+'</g>'

def write(name,text): (OUT / name).write_text(text)

write('astelvo-mark-color.svg',svg(256,256,mark([COLORS['accentDeep'],'#7184F2',COLORS['accent']]),'ASTELVO layered A with play cutout and exploration star'))
write('astelvo-mark-light.svg',svg(256,256,mark([COLORS['text']]*3),'ASTELVO monochrome light mark'))
write('astelvo-mark-dark.svg',svg(256,256,mark([COLORS['background']]*3),'ASTELVO monochrome dark mark'))
write('astelvo-mark-small.svg',svg(256,256,mark([COLORS['accent']]*3,False),'ASTELVO compact mark without star'))

for mode in ['dark','light']:
    bg=COLORS['background'] if mode=='dark' else '#FFFFFF'
    ink=COLORS['text'] if mode=='dark' else COLORS['background']
    palette=[COLORS['accentDeep'],'#7184F2',COLORS['accent']] if mode=='dark' else [COLORS['accentDeep']]*3
    body=f'<rect width="1060" height="370" fill="{bg}"/>'
    body+=f'<g transform="translate(40 30) scale(.96)">{mark(palette)}</g>'
    body+=outline('ASTELVO',320,158,91,True,7,ink)
    body+=outline('by Sun',324,221,38,False,0,COLORS['sun'] if mode=='dark' else '#76530B')
    body+=outline('Organize. Script. Explore.',48,324,36,False,1,ink)
    write(f'astelvo-lockup-{mode}.svg',svg(1060,370,body,'ASTELVO by Sun — Organize. Script. Explore.'))

icon=f'<rect x="8" y="8" width="240" height="240" rx="52" fill="{COLORS["background"]}"/>'
icon+=f'<g transform="translate(28 21) scale(.78)">{mark([COLORS["accentDeep"],"#7184F2",COLORS["accent"]])}</g>'
write('astelvo-app-icon.svg',svg(256,256,icon,'ASTELVO application icon'))
write('astelvo-app-icon-small.svg',svg(256,256,f'<rect x="8" y="8" width="240" height="240" rx="52" fill="{COLORS["background"]}"/><g transform="translate(9 -16) scale(.94)">{mark([COLORS["accent"]]*3,False)}</g>','ASTELVO small app icon'))

(OUT/'tokens.json').write_text(json.dumps({'brand':'ASTELVO by Sun','tagline':'Organize. Script. Explore.','version':'0.1.0','colors':COLORS},indent=2)+'\n')
(OUT/'tokens.css').write_text(':root {\n'+''.join(f'  --astelvo-{k}: {v};\n' for k,v in COLORS.items())+'}\n')

for n in [16,24,32,48,64,128,256,512,1024]:
    # Optical small-size variant: one flat fill, larger silhouette, no detached star.
    source=OUT/'astelvo-app-icon.svg'
    if n<=24:
        source=OUT/'astelvo-app-icon-small.svg'
    subprocess.run(['inkscape',str(source),'--export-type=png',f'--export-filename={OUT / f"astelvo-icon-{n}.png"}',f'--export-width={n}',f'--export-height={n}'],check=True,capture_output=True)
Image.open(OUT/'astelvo-icon-256.png').save(OUT/'astelvo.ico',sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)],append_images=[Image.open(OUT/f'astelvo-icon-{n}.png') for n in [16,24,32,48,64,128]])
for mode in ['dark','light']:
    subprocess.run(['inkscape',str(OUT/f'astelvo-lockup-{mode}.svg'),'--export-type=png',f'--export-filename={OUT/f"astelvo-lockup-{mode}.png"}','--export-width=1590'],check=True,capture_output=True)

# Preview is a QA artefact, outside the reusable asset directory.
preview=Image.new('RGB',(1590,900),COLORS['surface'])
preview.paste(Image.open(OUT/'astelvo-lockup-dark.png').convert('RGB'),(0,0))
d=ImageDraw.Draw(preview); d.text((50,585),'APP ICONS  /  PIXEL-SIZE REVIEW',fill=COLORS['text'])
x=50
for n in [16,24,32,48,64,128]:
    im=Image.open(OUT/f'astelvo-icon-{n}.png'); preview.paste(im,(x,640),im); d.text((x,790),str(n),fill=COLORS['text']); x+=n+55
preview.save(ROOT/'ASTELVO-Brand-Preview.png')
print(OUT)
