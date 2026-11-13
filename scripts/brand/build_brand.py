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
CARDS = [
 'M132 29H230Q245 29 242 44L205 222H94L132 29Z',
 'M98 61H201Q216 61 213 76L181 228H62L98 61Z',
 'M63 95H172Q187 95 184 110L158 229H33L63 95Z'
]
ARC = 'M8 237Q128 172 248 237Q128 195 8 237Z'

def mark(palette, detail=True):
    # Transparent keyline gaps separate overlapping cards even in monochrome.
    gaps=''.join(f'<path d="{d}" fill="white" stroke="black" stroke-width="9" stroke-linejoin="round"/>' for d in CARDS[1:])
    holes='<path d="M111 155 111 187 138 171Z" fill="black"/>'
    if detail:
        holes+='<path d="M145 51H214M111 83H184M77 119H151M74 134H130" fill="none" stroke="black" stroke-width="7" stroke-linecap="round"/>'
    defs=f'<defs><clipPath id="card-horizon"><path d="M0 0H256V232Q128 167 0 232Z"/></clipPath><mask id="card-gaps" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256"><rect width="256" height="256" fill="white"/>{gaps}{holes}</mask></defs>'
    cards=''.join(f'<path d="{d}" fill="{c}"/>' for d,c in zip(CARDS,palette))
    return defs+f'<g clip-path="url(#card-horizon)" mask="url(#card-gaps)">{cards}</g><path d="{ARC}" fill="{palette[-1]}"/>'

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

write('astelvo-mark-color.svg',svg(256,256,mark([COLORS['accentDeep'],'#7184F2',COLORS['accent']]),'ASTELVO layered script files over a sun arc'))
write('astelvo-mark-light.svg',svg(256,256,mark([COLORS['text']]*3),'ASTELVO monochrome light mark'))
write('astelvo-mark-dark.svg',svg(256,256,mark([COLORS['background']]*3),'ASTELVO monochrome dark mark'))
write('astelvo-mark-small.svg',svg(256,256,mark([COLORS['accent']]*3,False),'ASTELVO compact files and sun arc mark'))

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
write('astelvo-app-icon-small.svg',svg(256,256,f'<rect x="8" y="8" width="240" height="240" rx="52" fill="{COLORS["background"]}"/><g transform="translate(17 15) scale(.86)">{mark([COLORS["accent"]]*3,False)}</g>','ASTELVO small app icon'))

(OUT/'tokens.json').write_text(json.dumps({'brand':'ASTELVO by Sun','tagline':'Organize. Script. Explore.','version':'0.2.0','colors':COLORS},indent=2)+'\n')
(OUT/'tokens.css').write_text(':root {\n'+''.join(f'  --astelvo-{k}: {v};\n' for k,v in COLORS.items())+'}\n')

for n in [16,24,32,48,64,128,256,512,1024]:
    # Optical small-size variant: one flat fill, larger silhouette, no code strokes.
    source=OUT/'astelvo-app-icon.svg'
    if n<=24:
        source=OUT/'astelvo-app-icon-small.svg'
    subprocess.run(['inkscape',str(source),'--export-type=png',f'--export-filename={OUT / f"astelvo-icon-{n}.png"}',f'--export-width={n}',f'--export-height={n}'],check=True,capture_output=True)
Image.open(OUT/'astelvo-icon-256.png').save(OUT/'astelvo.ico',sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)],append_images=[Image.open(OUT/f'astelvo-icon-{n}.png') for n in [16,24,32,48,64,128]])
for mode in ['dark','light']:
    subprocess.run(['inkscape',str(OUT/f'astelvo-lockup-{mode}.svg'),'--export-type=png',f'--export-filename={OUT/f"astelvo-lockup-{mode}.png"}','--export-width=1590'],check=True,capture_output=True)
    # Identity-specific URLs prevent stale README images when generic assets change.
    shutil.copyfile(OUT/f'astelvo-lockup-{mode}.png', OUT/f'astelvo-files-sun-arc-v02-{mode}.png')

# Preview is a QA artefact, outside the reusable asset directory.
preview=Image.new('RGB',(1590,900),COLORS['surface'])
preview.paste(Image.open(OUT/'astelvo-lockup-dark.png').convert('RGB'),(0,0))
d=ImageDraw.Draw(preview); d.text((50,585),'APP ICONS  /  PIXEL-SIZE REVIEW',fill=COLORS['text'])
x=50
for n in [16,24,32,48,64,128]:
    im=Image.open(OUT/f'astelvo-icon-{n}.png'); preview.paste(im,(x,640),im); d.text((x,790),str(n),fill=COLORS['text']); x+=n+55
preview.save(ROOT/'ASTELVO-Brand-Preview.png')
print(OUT)
