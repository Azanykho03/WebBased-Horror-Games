"""Deterministic architectural assembly in the existing 3d-generation workflow.

No provider calls or gameplay. Original references stay in the asset source folder.
Stages preserve checkpoints under .cache/3d-generation/runs/haunted-house/.
"""
import argparse,json,math,hashlib,shutil
from pathlib import Path
from utils.house_geometry import House
from utils.house_layout import ROOMS,WALLS,RISE,HEIGHT,STAIR,TOUR
from utils.mesh import inspect_glb

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/assets/models/environments/haunted-house'

def wall(h,room,axis,fixed,start,end,openings):
 h.room=room;floor=RISE if room.startswith('U') else 0
 def segment(a,b,bottom,top,mat='plaster',depth=.16,collision=True):
  if b-a<.001 or top-bottom<.001:return
  pos=[(a+b)/2,floor+(bottom+top)/2,fixed] if axis=='x' else [fixed,floor+(bottom+top)/2,(a+b)/2]
  size=[b-a,top-bottom,depth] if axis=='x' else [depth,top-bottom,b-a]
  h.box(pos,size,mat,solid=collision)
 cursor=start
 for kind,c,w,ht,sill,src,dst in sorted(openings,key=lambda o:o[1]):
  a=c-w/2;b=c+w/2
  segment(cursor,a,0,HEIGHT);segment(a,b,0,sill);segment(a,b,sill+ht,HEIGHT)
  # substantial timber jambs, sill, cornice and panelled door leaves held open.
  for j in (a,b):segment(j-.045,j+.045,sill,sill+ht+.07,'wood',.25,False)
  segment(a-.07,b+.07,sill+ht,sill+ht+.09,'wood',.26,False)
  pos=[c,floor+sill,fixed] if axis=='x' else [fixed,floor+sill,c]
  if kind=='door':
   h.doors.append(dict(id=f'{src}--{dst}',source=src,destination=dst,position=pos,axis=axis,facing=[0,0,1] if axis=='x' else [1,0,0],width=w-.09,height=ht,lockState='open',floor=round(floor/RISE)))
  else:
   segment(a,b,sill-.04,sill+.06,'wood',.34,False)
   segment(a+.05,b-.05,sill+.07,sill+ht-.05,'window',.025,False)
   segment(c-.025,c+.025,sill,sill+ht,'wood',.12,False)
   segment(a,b,sill+ht*.6,sill+ht*.6+.04,'wood',.12,False)
   h.windows.append(dict(room=room,position=pos,axis=axis,width=w,height=ht,sill=sill,exterior=True,curtains=True))
  cursor=b
 segment(cursor,end,0,HEIGHT)
 # Omit skirting at openings; upper trim is continuous above doors.
 cursor=start
 for o in sorted(openings,key=lambda v:v[1]):
  a=o[1]-o[2]/2;b=o[1]+o[2]/2
  if o[0]=='door':segment(cursor,a,0,.18,'wood',.2,False);cursor=b
 segment(cursor,end,0,.18,'wood',.2,False)
 segment(start,end,HEIGHT-.12,HEIGHT,'wood',.25,False)

def architecture(h):
 for rid,name,floor,rects in ROOMS:
  if rid=='F03':continue
  h.room=rid
  for a,b,c,d in rects:
   mat='woodlight' if floor else ('woodlight' if rid=='F02' else 'tile')
   if rid in ('U05','U07','F09'):mat='tile'
   h.box([(a+b)/2,RISE*floor-.1,(c+d)/2],[b-a,.2,d-c],mat,group=rid+'-floor')
   # Ground ceilings use the same upper floor footprint, leaving the stair void.
   if floor and rid!='U07':
    h.box([(a+b)/2,RISE+HEIGHT+.06,(c+d)/2],[b-a,.12,d-c],'plaster',group=rid+'-ceiling')
 # Ceiling above ground floor, clipped around the aligned stair shaft.
 for a,b,c,d in [(-7.6,1.4,-22,0),(3.4,9.4,-22,0),(1.4,3.4,-22,-6.1),(1.4,3.4,-1.6,0)]:
  h.room='F01';h.box([(a+b)/2,HEIGHT-.025,(c+d)/2],[b-a,.08,d-c],'plaster',group='F00-ceiling')
 for row in WALLS:wall(h,*row)
 h.room='F03'
 # Eighteen solid treads, 180 mm rise; navigation follows the matching smooth ramp.
 for i in range(STAIR['steps']):
  rise=(i+1)*RISE/18;depth=4.5/18;z=-6.1+(i+.5)*depth
  h.box([2.4,rise/2,z],[1.8,rise,depth],'wood')
  h.box([2.4,rise+.007,z-depth/2+.025],[1.83,.025,.07],'woodlight')
  for x in (1.52,3.28):
   h.rod([x,rise,z],[x,rise+.88,z],.028)
   for yy,r in ((.16,.043),(.46,.055),(.66,.04)):h.ball([x,rise+yy,z],[r,.06,r],'wood')
 for x in (1.52,3.28):h.rod([x,1.03,-5.95],[x,RISE+.92,-1.65],.055)
 # Collision rail segments follow the slope, avoiding an invisible wall at the foot.
 for i in range(18):
  z=-6.1+(i+.5)*4.5/18;y=(i+.5)*RISE/18
  for x in (1.47,3.33):
   h.colliders.append(dict(id=f'stair-rail-{x}-{i}',room='F03',min=[x-.05,y,z-.125],max=[x+.05,y+1.02,z+.125]))
 # Upper hallway guard above the open well, and north end guard.
 h.room='U00'
 for z in [-6.1+i*.3 for i in range(18)]:h.rod([1.44,RISE,z],[1.44,RISE+1.02,z],.024)
 h.rod([1.44,RISE+1.02,-6.1],[1.44,RISE+1.02,-1.65],.05)
 h.colliders.append(dict(id='upper-stair-guard',room='U00',min=[1.38,RISE,-6.15],max=[1.5,RISE+1.1,-1.65]))
 h.box([2.4,RISE+.48,-6.17],[1.95,.96,.12],'wood',solid=True)
 # Solid terrace railing; exit recess slab; porch; rusted garage shutter.
 h.room='U07'
 for x in [-7.5+i*.42 for i in range(41)]:h.rod([x,RISE+.04,2.42],[x,RISE+1.1,2.42],.025,'rust')
 for z in [.15+i*.4 for i in range(6)]:
  for x in (-7.53,9.33):h.rod([x,RISE,z],[x,RISE+1.1,z],.025,'rust')
 h.box([.9,RISE+1.1,2.42],[17,.08,.08],'rust')
 h.colliders.append(dict(id='terrace-front-rail',room='U07',min=[-7.6,RISE,2.35],max=[9.4,RISE+1.2,2.5]))
 for x in (-7.53,9.33):
  h.box([x,RISE+1.1,1.25],[.08,.08,2.5],'rust')
  h.colliders.append(dict(id=f'terrace-side-{x}',room='U07',min=[x-.06,RISE,0],max=[x+.06,RISE+1.2,2.5]))
 h.room='F08';h.box([-3,-.1,-13.5],[3.2,.2,3],'tile',group='F08-floor')
 h.room='F01';h.box([0,-.1,1.0],[2.8,.2,2],'tile',group='F01-floor')
 h.room='F09'
 for y in [i*.12+.12 for i in range(22)]:h.box([-4.65,y,-.102],[4.3,.1,.055],'rust')
 # Modest pitched roof and fascia over the main house; isolated for cutaway view.
 h.room='roof'
 h.box([.9,6.47,-11],[17.25,.16,22.4],'wood',group='roof')
 h.box([.9,6.8,-11],[17.4,.12,22.55],'black',group='roof')

def main():
 p=argparse.ArgumentParser();p.add_argument('--phase',choices=['blockout','furniture','materials','lighting','final'],default='final');args=p.parse_args()
 OUT.mkdir(parents=True,exist_ok=True)
 if args.phase in ('materials','lighting','final'):
  from utils.house_materials import generate_textures
  generate_textures(OUT/'textures')
 h=House(OUT,args.phase);architecture(h)
 if args.phase!='blockout':
  from utils.house_furniture import furnish
  furnish(h)
 if args.phase in ('materials','lighting','final'):
  from utils.house_details import decorate
  decorate(h)
 if args.phase in ('lighting','final'):
  from utils.house_details import illuminate
  illuminate(h)
 checkpoint=ROOT/'.cache/3d-generation/runs/haunted-house'/args.phase
 checkpoint.mkdir(parents=True,exist_ok=True)
 target=checkpoint/'haunted-house.glb' if args.phase!='final' else OUT/'haunted-house.glb'
 stats=h.export(target)
 manifest=dict(version=1,phase=args.phase,units='metres',orientation='Y up; X east; negative Z north; south frontage Z=0',floorRise=RISE,playerRadius=.23,eyeHeight=1.65,bodyHeight=1.78,rooms=[dict(id=r,name=n,floor=f,rects=rects) for r,n,f,rects in ROOMS],stair=STAIR,doors=h.doors,windows=h.windows,props=h.props,colliders=h.colliders,lights=h.lights,tour=[dict(name=n,x=x,z=z,floor=f) for n,x,z,f in TOUR],stats=stats)
 (target.parent/'house-manifest.json').write_text(json.dumps(manifest,indent=2))
 report=inspect_glb(target);(target.parent/'mesh-inspection.json').write_text(json.dumps(report,indent=2))
 print(json.dumps(dict(phase=args.phase,output=str(target),**stats)))
 if args.phase=='final':
  for name in ('house-viewer.html','house-viewer.js','house-navigation.mjs'):
   src=Path(__file__).parent/name
   if src.exists():shutil.copy2(src,OUT/('index.html' if name.endswith('.html') else name))
  (OUT/'generation-info.json').write_text(json.dumps(dict(generator='scripts/3d-generation/generate_house.py',method='Deterministic blueprint-led native geometry; no remote generation',renderer='Babylon.js 9.28.0',sourceManifest='source/reference-manifest.json',sha256=hashlib.sha256(target.read_bytes()).hexdigest(),stats=stats,optional3dAssets='Inspected MIT source; not used. Native meshes avoid a Three.js conversion dependency.',scope='Environment inspection only; no gameplay'),indent=2))

if __name__=='__main__':main()
