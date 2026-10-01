"""Original, deterministic 512px surface maps; no third-party image assets."""
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
from .house_geometry import PALETTE

def generate_textures(out):
 out=Path(out);out.mkdir(parents=True,exist_ok=True)
 rng=np.random.default_rng(870);n=512
 yy,xx=np.mgrid[0:n,0:n]
 for name,(color,_) in PALETTE.items():
  base=np.array([int(color[i:i+2],16) for i in (1,3,5)])
  noise=rng.normal(0,3.5,(n,n))
  coarse=np.array(Image.fromarray(rng.integers(0,255,(16,16),dtype=np.uint8)).resize((n,n),Image.Resampling.BICUBIC),dtype=float)/255-.5
  value=noise+coarse*17
  if name=='plaster':value=noise*.35+coarse*7
  if name in ('wood','woodlight'):
   grain=np.sin(xx*.34+np.sin(yy*.011)*5+coarse*2)+.5*np.sin(xx*1.08+np.sin(yy*.026)*3)
   value+=grain*8
   for x in range(0,n,128):value[:,x:x+2]-=35
   for i in range(4):
    y=(i*171+109)%512;value[y:y+2,i*128:(i+1)*128]-=25
   for _ in range(90):
    x=int(rng.integers(n));y=int(rng.integers(n));length=int(rng.integers(6,95));value[y:min(y+length,n),x:x+1]+=17
  elif name in ('tile','porcelain'):
   if name=='tile':
    for a in (0,255,256,511):value[a,:]-=42;value[:,a]-=42
    for tx,ty in ((0,0),(256,0),(0,256),(256,256)):
     value[ty:ty+256,tx:tx+256]+=rng.uniform(-8,8)
   value+=coarse*9
  elif name in ('fabric','velvet','linen','lace'):
   value+=(np.sin(xx*PI2/3)+np.sin(yy*PI2/4))*3
   if name in ('fabric','velvet'):
    # Faded, domestic floral jacquard rather than flat monochrome upholstery.
    gx=(xx%96)-48;gy=(yy%96)-48
    flower=np.sin(np.arctan2(gy,gx)*6)*4+19
    ring=np.abs(np.sqrt(gx*gx+gy*gy)-flower)<2
    value[ring]+=14
   if name=='lace':value[(np.sin(xx*.2)*np.sin(yy*.2))>.55]-=23
  elif name in ('rust','metal','brass'):value+=coarse*30
  elif name in ('glass','mirror'):value+=np.sin(xx*.03+yy*.021)*5+coarse*15
  elif name=='paper':value+=coarse*8
  elif name=='screen':value+=np.sin(yy*PI2/4)*16+rng.normal(0,8,(n,n))
  a=np.clip(base+value[:,:,None],0,255).astype(np.uint8)
  image=Image.fromarray(a);draw=ImageDraw.Draw(image)
  if name=='portrait':
   draw.rectangle((8,8,504,504),outline=(112,87,50),width=11)
   for x,y,scale in [(160,174,1),(344,183,.94),(255,316,.62)]:
    draw.ellipse((x-58*scale,y-70*scale,x+58*scale,y+63*scale),fill=(53,45,34))
    draw.ellipse((x-38*scale,y-53*scale,x+38*scale,y+54*scale),fill=(124,106,76))
    draw.polygon([(x-52*scale,y+45*scale),(x+58*scale,y+49*scale),(x+91*scale,y+224*scale),(x-91*scale,y+224*scale)],fill=(47,48,38))
    for dx in (-15,15):draw.ellipse((x+(dx-5)*scale,y-4*scale,x+(dx+5)*scale,y+3*scale),fill=(34,30,26))
   for _ in range(100):
    x,y=rng.integers(512,size=2);draw.line((int(x),int(y),int(x)+int(rng.integers(-25,25)),int(y)+int(rng.integers(3,75))),fill=(110,94,69),width=1)
  image.save(out/(name+'.png'),optimize=True)
 # An irregular transparent water-stain decal used only near plumbing and windows.
 stain=Image.new('RGBA',(512,512),(70,67,41,0));d=ImageDraw.Draw(stain)
 for _ in range(90):
  x,y=rng.normal(256,80,size=2);w,h=rng.uniform(10,90,size=2)
  d.ellipse((x-w,y-h,x+w,y+h),fill=(65,69,44,int(rng.integers(10,45))))
 stain.filter(ImageFilter.GaussianBlur(5)).save(out/'stain.png')
 return len(PALETTE)+1

PI2=np.pi*2
