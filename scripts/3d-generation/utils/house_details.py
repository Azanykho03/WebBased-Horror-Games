"""Architectural finish, local decay and independent room fixtures."""
import math, random
import numpy as np
from .house_layout import RISE, ROOMS
from .house_furniture import place,book,mirror,doll
PI=math.pi
RNG=random.Random(571)

def curtain(h,window):
 x,y,z=window['position'];w=window['width'];ht=window['height'];axis=window['axis'];room=window['room']
 floor=RISE if room.startswith('U') else 0
 # Curtains sit on the interior side of each exterior wall.
 inward=1 if (axis=='z' and x<0) or (axis=='x' and z<0) else -1
 h.begin(room,'curtains',x,z,y,0 if axis=='x' else PI/2)
 # For rotated west/east windows local +Z maps to world +X.
 depth=inward*.16;bottom=.04 if window['sill']>1.5 else -window['sill']+.12
 total=ht-bottom+.08
 for side in (-1,1):
  for i in range(8):
   cx=side*(w/2-.14)+(i-3.5)*.05
   length=total-abs(math.sin(i*2.4+side))*.10
   h.box([cx,ht-length/2,depth+math.cos(i*1.9)*.043],[.053,length,.027],'velvet' if room in ('F02','U06') else 'linen')
  # Tie-back and a sheer underlayer inspired by the supplied window frames.
  h.rod([side*(w/2-.3),ht*.35,depth+.06],[side*(w/2+.08),ht*.35,depth+.06],.012,'brass')
 for cx in (-w*.3,w*.3):h.box([cx,ht*.53,depth*.44],[w*.2,ht*.95,.014],'lace')
 h.rod([-w/2-.23,ht+.14,depth],[w/2+.23,ht+.14,depth],.028,'metal')
 h.end()

def portrait(h,room,x,z,y=1.65,yaw=0,w=.58,ht=.79):
 base=RISE if room.startswith('U') else 0
 h.begin(room,'portrait',x,z,base+y,yaw)
 h.box([0,0,0],[w+.13,ht+.13,.06],'wood')
 h.box([0,0,.036],[w,ht,.018],'portrait')
 for px in (-w/2-.022,w/2+.022):h.box([px,0,.052],[.025,ht+.09,.035],'brass')
 for yy in (-ht/2-.022,ht/2+.022):h.box([0,yy,.052],[w+.1,.025,.035],'brass')
 h.end()

def decorate(h):
 for window in h.windows:curtain(h,window)
 # Weathered carved doors are visibly held fully open; collision follows their
 # resting leaves. Service exit uses a distinct narrow painted leaf.
 for door in list(h.doors):
  x,y,z=door['position'];w=door['width'];axis=door['axis'];room=door['source']
  if room.startswith('outside'):room=door['destination']
  if door['destination']=='outside-escape':room='F08'
  a=(x if axis=='x' else z)-w/2
  if door['source']=='outside-front':
   px,pz,yaw=-.92,-.79,PI/2
  else:
   # Leaves fold against the room side, keeping the cabinet-lined hall clear.
   side=-1 if axis=='z' and x<0 else 1
   px,pz=(a-w/2-.13,z+.115) if axis=='x' else (x+side*.115,a-w/2-.13)
   yaw=0 if axis=='x' else PI/2
  h.begin(room,'open-door',px,pz,y,yaw,size=[w-.08,2.26,.055])
  material='damp' if door['destination']=='outside-escape' else 'wood'
  h.box([0,1.13,0],[w-.08,2.26,.055],material)
  for cy,ht in ((.42,.53),(1.37,1.1)):
   for cx in (-w*.23,w*.23):
    h.box([cx,cy,.037],[w*.39,ht,.029],'woodlight')
    h.box([cx,cy,.057],[w*.31,ht-.09,.018],material)
  h.torus([0,1.34,.071],w*.19,.018,'woodlight')
  h.ball([w*.33,1.03,.07],[.035,.035,.027],'brass')
  h.box([w*.33,1.03,.047],[.07,.18,.021],'rust');h.end()
 # Main threshold and abandoned footwear.
 h.begin('F01','muddy-mat',0,-.46);h.box([0,.011,0],[.88,.018,.52],'fabric')
 for i in range(8):h.box([-.38+i*.11,.024,0],[.013,.006,.46],'black')
 h.end()
 for x in (-.75,-.48):
  h.begin('F01','slipper',x,-1.9);h.ball([0,.025,0],[.072,.025,.16],'velvet');h.ball([0,.057,-.04],[.065,.04,.062],'velvet');h.end()
 # Worn rugs reinforce different room identities without affecting navigation.
 for room,x,z,w,d in [('F02',6.1,-3.1,3.6,3.8),('F06',-4.4,-9.5,3.6,2.55),('U00',0,-10.4,1.5,13.8),('U01',6.5,-5.5,3.4,3.4),('U03',6,-11.8,3.2,3.2),('U06',5.6,-19.2,3.8,4.0)]:
  y=RISE if room.startswith('U') else 0;h.begin(room,'rug',x,z,y+.015)
  h.box([0,0,0],[w,.016,d],'velvet')
  for px in (-w/2+.10,w/2-.10):h.box([px,.013,0],[.07,.007,d-.16],'fabric')
  for pz in (-d/2+.1,d/2-.1):h.box([0,.013,pz],[w-.16,.007,.07],'fabric')
  h.end()
 # Portraits repeat the source's family-picture walls, using original art.
 for room,x,z,y,yaw in [('F01',-1.3,-3.3,1.7,PI/2),('F03',3.30,-3.5,4.65,-PI/2),('F02',7.7,-6.9,1.9,0),('F06',-2.8,-11.9,1.8,0),('U00',-1.29,-6.7,1.8,PI/2),('U00',1.29,-11.9,1.75,-PI/2),('U00',-1.29,-19.8,1.7,PI/2),('U02',-5.2,-8.09,1.8,0),('U01',4.35,-8.08,1.9,0)]:portrait(h,room,x,z,y,yaw)
 # Ground-floor CR has a visibly tiled inner floor and water-marked wall finish.
 for room,x,z,w,d in [('F07',7.76,-9.5,3.05,4.75),('U01',8.06,-1.4,2.52,2.59),('U05',-3.4,-16.9,3.78,3.98)]:
  y=RISE if room.startswith('U') else 0;h.room=room;h.box([x,y+.012,z],[w,.018,d],'tile')
 for room,x,z,y,w,ht,yaw in [('F07',9.306,-10,.5,2.1,1.0,-PI/2),('F05',-5.0,-21.91,1.32,3.1,1.8,0),('U01',9.306,-1.5,1,1.4,1.8,-PI/2),('U05',-3.5,-18.908,.6,2.8,1.1,0),('U00',-1.3,-12.3,2.1,2.7,1.2,PI/2),('F02',9.306,-3.5,.48,2.5,.8,-PI/2),('U04',-7.505,-11.7,.45,2.3,.8,PI/2)]:
  floor=RISE if room.startswith('U') else 0;h.begin(room,'water-stain',x,z,floor+y,yaw);h.box([0,0,0],[w,ht,.004],'stain');h.end()
 # Local damage is intentionally uneven: peeling at the stair/hall damp corners,
 # cracks near plumbing, scratched furniture, and chipped outside terrace tile.
 for room,x,z,y,yaw in [('U00',-1.307,-12.7,1.95,PI/2),('F03',3.309,-4.9,4.2,-PI/2),('F07',9.307,-10.2,1.25,-PI/2)]:
  floor=RISE if room.startswith('U') else 0;h.begin(room,'peeling-plaster',x,z,floor+y,yaw)
  for i in range(22):
   xx=RNG.uniform(-.32,.32);yy=RNG.uniform(-.47,.47)
   h.box([xx,yy,0],[RNG.uniform(.025,.15),RNG.uniform(.018,.09),.005],'linen' if i%3 else 'damp',rot=RNG.uniform(-.07,.07))
  h.end()
 for room,x,z,y in [('U07',3.1,1.5,RISE+.009),('U07',-4.8,1.1,RISE+.009),('F05',-4.8,-20.5,.009),('F07',8,-10,.026),('U05',-3.4,-17,RISE+.026),('F02',6.4,-3.3,.48)]:
  h.begin(room,'surface-crack',x,z,y)
  points=[(-.2,-.12),(-.08,-.04),(.02,-.065),(.10,.035),(.23,.06)]
  for a,b in zip(points,points[1:]):h.rod([a[0],0,a[1]],[b[0],0,b[1]],.003,'black',4)
  h.end()
 # Leaning frame and a figurine among the book-passage volumes.
 portrait(h,'F07',5.0,-7.72,2.47,PI,w=.27,ht=.32)
 h.begin('F07','shelf-figurine',3.7,-7.75,2.43);h.cylinder([0,.025,0],.055,.05,'brass');h.ball([0,.13,0],[.05,.09,.04],'porcelain');h.ball([0,.25,0],[.045,.05,.04],'porcelain');h.end()
 # Sparse papers and fallen books stay outside collision, as requested.
 for room,x,z in [('F07',3.7,-8.16),('F07',2.45,-8.05),('U01',4.62,-2.44),('U02',-4.3,-6.9),('U02',-2.52,-4.2),('U03',8,-12.5),('U04',-4.8,-13.8),('U06',7.65,-18.8)]:
  y=RISE if room.startswith('U') else 0;h.begin(room,'abandoned-belongings',x,z,y+.02)
  for i in range(5):h.box([RNG.uniform(-.35,.35),.006+i*.003,RNG.uniform(-.22,.22)],[.18,.006,.24],'paper',rot=RNG.uniform(-.7,.7))
  h.box([.1,.05,.1],[.22,.07,.3],'bookblue',rot=.34);h.box([.1,.087,.1],[.19,.006,.28],'paper',rot=.34);h.end()
 # Loose wiring and workshop tools.
 h.begin('F06','tangled-cables',-4.3,-11.28)
 for i in range(32):
  t=i*.23;t2=(i+1)*.23
  h.rod([math.sin(t)*.3,.032,math.cos(t)*.16],[math.sin(t2)*.3,.032,math.cos(t2)*.16],.009,'black')
 h.end()
 h.begin('F09','tools',-4.6,-6.57,.92)
 for x in (-.6,-.2,.2,.5):h.rod([x,0,-.13],[x,.015,.13],.017,'metal');h.box([x,.016,.16],[.1,.026,.065],'metal')
 h.end()
 # Dead plants, damp leaves and cracked terrace tile.
 for x,z in [(-6.7,1.35),(8.65,1.15),(-.7,1.95)]:
  h.begin('U07','dead-plant',x,z,RISE,size=[.4,.8,.4]);h.cylinder([0,.2,0],.17,.4,'rust',top=.23);h.cylinder([0,.405,0],.205,.01,'damp')
  for i in range(7):
   a=i*2.7;h.rod([0,.4,0],[math.cos(a)*.27,.7+i*.055,math.sin(a)*.2],.009,'wood')
  h.end()
 for i in range(40):
  x=RNG.uniform(-7.2,9);z=RNG.uniform(.5,2.2);h.begin('U07','leaf',x,z,RISE+.025)
  h.box([0,0,0],[.08,.006,.04],'woodlight',rot=RNG.uniform(0,6));h.end()
 # Sparse cobweb threads, kept in corners and away from navigation.
 for room,x,z,y in [('F03',3.2,-5.8,2.8),('F07',8.8,-7.3,2.9),('U00',-1.2,-21.6,6.15),('U06',8.9,-21.5,6.1)]:
  h.room=room
  for i in range(7):h.rod([x,y,z],[x-.35*math.cos(i*.24),y-.34*math.sin(i*.24),z-.18],.002,'linen',4)

def illuminate(h):
 # A fixed fixture inventory. Only H1 and H2 belong to the upper hallway.
 lights=[
 ('L-living','F02',6.2,2.72,-3.4,2.2,7,'pendant'),('L-doll','F02',7.84,.94,-5.6,.65,3,'lamp'),
 ('L-stairs','F03',3.2,2.95,-4.2,.75,4,'sconce'),
 ('L-dining','F04',5.5,2.2,-18.5,1.8,6,'pendant'),('L-kitchen','F05',-4.5,2.86,-18.6,1.35,6,'fluorescent'),
 ('L-tv','F06',-2.45,.92,-7.65,.95,4.6,'lamp'),('L-books','F07',3.8,2.7,-10.2,.65,5,'pendant'),
 ('L-cr-ground','F07',7.8,2.7,-9.5,.6,3.5,'bulb'),('L-bar','F08',0,2.68,-13.5,.9,4,'pendant'),
 ('L-garage','F09',-2.05,2.72,-6.0,1.0,4.0,'bulb'),
 ('H1','U00',2.4,RISE+2.64,-.83,1.15,4.4,'pendant'),('H2','U00',-.05,RISE+2.65,-4.5,.8,4.2,'pendant'),
 ('L-master-bed','U01',5.2,RISE+.94,-7.25,.9,4.8,'lamp'),('L-master-desk','U01',8.73,RISE+1.07,-3.80,.55,3.2,'desk'),
 ('L-master-cr','U01',8.25,RISE+2.76,-1.5,.5,3,'bulb'),('L-study','U02',-4.2,RISE+1.07,-7.6,.42,4,'desk'),
 ('L-guest','U03',7.46,RISE+.97,-13.8,.7,4.7,'lamp'),('L-twin','U04',-4.75,RISE+1.5,-8.65,.65,5.2,'lamp'),
 ('L-shared-cr','U05',-3.4,RISE+2.72,-16.9,.55,3.4,'bulb'),
 ('L-master2-ceiling','U06',5.2,RISE+2.76,-18.7,.8,5.8,'pendant'),('L-master2-bed','U06',7.18,RISE+.94,-21.1,.65,3.7,'lamp'),
 ]
 for i,(id,room,x,y,z,power,reach,kind) in enumerate(lights):
  h.lights.append(dict(id=id,room=room,position=[x,y,z],intensity=power,range=reach,color=[1,.76,.49] if kind!='fluorescent' else [.68,.79,.65],period=8+(i*3.17)%12,phase=i*2.31,fixture=kind,electric=True))
  h.begin(room,'light-fixture',x,z,y);h.props[-1]['fixtureId']=id
  if kind in ('lamp','desk'):
   h.cylinder([0,-.27,0],.115,.045,'brass');h.rod([0,-.25,0],[0,.0,0],.017,'brass')
   h.cylinder([0,.04,0],.18,.21,'linen',top=.095)
  elif kind=='fluorescent':h.box([0,.03,0],[1.15,.09,.2],'metal');h.box([0,-.025,0],[1.05,.035,.13],'glow')
  else:
   top=(RISE if room.startswith('U') else 0)+3.0-y
   h.rod([0,.10,0],[0,top,0],.009,'black');h.cylinder([0,.08,0],.18,.11,'metal',top=.07)
  h.ball([0,-.015,0],[.049,.075,.049],'glow');h.end()
