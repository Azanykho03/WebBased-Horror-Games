"""Reference-informed, low-poly household props. Local front is +Z."""
import math,random
import numpy as np
import trimesh
from .house_layout import RISE
PI=math.pi
RNG=random.Random(431)

def legs(h,w,d,height,mat='wood'):
 for x in (-w/2+.09,w/2-.09):
  for z in (-d/2+.09,d/2-.09):
   h.rod([x,.04,z],[x*.94,height,z*.94],.038,mat)
   h.ball([x,height*.65,z],[.05,.065,.05],mat)

def table(h,w=1.6,d=.8,height=.72):
 legs(h,w,d,height);h.box([0,height,0],[w,.09,d],'woodlight')
 h.box([0,height-.12,0],[w-.16,.14,d-.16],'wood')

def chair(h):
 legs(h,.48,.48,.44);h.box([0,.46,0],[.52,.08,.5],'wood')
 h.box([0,.512,.015],[.43,.035,.38],'fabric')
 for x in (-.22,.22):h.rod([x,.4,-.2],[x,1.03,-.23],.029)
 for y in (.71,.85,.99):h.box([0,y,-.225],[.45,.055,.05],'wood')
 h.box([0,.875,-.228],[.16,.23,.036],'woodlight')

def sofa(h,w=2.35,mat='fabric'):
 legs(h,w,.9,.24);h.box([0,.32,0],[w,.26,.94],'wood')
 h.box([0,.71,-.37],[w-.15,.72,.22],mat)
 count=3 if w>1.5 else 1
 for i in range(count):
  x=(i-(count-1)/2)*(w-.32)/count
  h.box([x,.51,.05],[(w-.37)/count,.18,.72],mat,rot=.014*(i-1))
  h.box([x,.83,-.23],[(w-.4)/count,.5,.17],mat)
 for x in (-w/2+.075,w/2-.075):
  h.box([x,.67,0],[.15,.46,.96],'wood')
  h.rod([x,.91,-.36],[x,.79,.4],.072)
  h.ball([x,.8,.4],[.09,.1,.09],'woodlight')
 h.box([-.28 if w>1.5 else 0,.98,-.17],[.43,.31,.13],'linen',rot=-.13)

def bed(h,w=1.35,d=2.35):
 legs(h,w,d,.38);h.box([0,.36,0],[w,.2,d],'wood')
 h.box([0,.53,0],[w-.07,.24,d-.09],'linen')
 h.box([0,.675,.32],[w-.06,.055,d-.85],'fabric')
 for x in (-w/2+.05,w/2-.05):
  h.rod([x,.14,-d/2],[x,1.38,-d/2],.05);h.ball([x,1.4,-d/2],[.085,.1,.085],'wood')
  h.rod([x,.14,d/2],[x,.76,d/2],.04)
 h.box([0,.97,-d/2],[w,.7,.095],'wood')
 for x in (-w*.29,0,w*.29):h.box([x,.99,-d/2+.055],[w*.23,.43,.025],'woodlight')
 h.box([0,.53,d/2],[w,.2,.08],'wood')
 for x in ([-w*.25,w*.25] if w>1.7 else [0]):
  h.box([x,.72,-d*.32],[w*.4,.14,.47],'lace',rot=RNG.uniform(-.08,.08))
 # Overhanging blanket folds break the clean mattress silhouette.
 for x in (-w/2,w/2):
  for z in (.18,.48,.78):h.box([x,.49,z],[.04,.43,.28],'fabric',rot=.03)

def book(h,x,y,z,w=.085,ht=.29,mat='bookred'):
 h.box([x,y+ht/2,z],[w,ht,.19],mat)
 h.box([x,y+ht/2,z+.098],[w*.94,ht*.96,.008],mat)
 h.box([x,y+ht*.64,z+.105],[w*.65,.05,.004],'paper')
 h.box([x,y+ht+.003,z],[w*.75,.004,.17],'paper')
 for dy in (.045,ht-.045):h.box([x,y+dy,z+.105],[w,.011,.01],'brass')

def shelf(h,w=1.7,ht=2.3,style='books'):
 d=.42
 h.box([0,ht/2,-.19],[w,ht,.065],'wood')
 for x in (-w/2,w/2):h.box([x,ht/2,0],[.085,ht,d],'wood')
 h.box([0,ht+.025,0],[w+.15,.12,d+.06],'wood')
 h.box([0,.12,0],[w+.08,.17,d+.02],'wood')
 for y in [.25+i*(ht-.36)/5 for i in range(6)]:
  h.box([0,y,0],[w,.055,d],'woodlight')
  if y>ht-.2:continue
  for j in range(int(w/(.11 if style=='books' else .29))):
   x=-w/2+.1+j*(.11 if style=='books' else .29)
   if style=='books':book(h,x,y+.03,.02,w=RNG.uniform(.05,.095),ht=RNG.uniform(.21,.33),mat=RNG.choice(['bookred','bookblue','bookgreen','linen']))
   elif style=='glass':
    if j%3==0:
     h.cylinder([x,y+.13,.02],.055,.2,'glass');h.cylinder([x,y+.265,.02],.022,.09,'glass')
     h.box([x,y+.13,.077],[.067,.075,.005],'paper')
    else:
     h.cylinder([x,y+.055,.02],.058,.018,'glass');h.rod([x,y+.065,.02],[x,y+.15,.02],.012,'glass')
     h.cylinder([x,y+.215,.02],.031,.14,'glass',top=.082)
     h.cylinder([x,y+.287,.02],.066,.003,'black')
     h.torus([x,y+.29,.02],.075,.008,'glass',rot=PI/2)
   else:
    h.cylinder([x,y+.06,.02],.06,.05,'brass');h.ball([x,y+.17,.02],[.047,.085,.038],'porcelain');h.ball([x,y+.28,.02],[.045,.05,.04],'porcelain')
 if style!='books':
  h.box([0,ht/2,.219],[w-.15,ht-.2,.008],'cabinet-glass')
  for x in (-w/2+.08,0,w/2-.08):h.box([x,ht/2,.228],[.03,ht-.15,.03],'brass')
  for y in (.18,ht-.08):h.box([0,y,.228],[w-.13,.035,.04],'brass')

def wardrobe(h,w=1.8,ht=2.4,open_door=False):
 d=.65
 h.box([0,ht/2,-.3],[w,ht,.09],'wood');h.box([0,ht+.02,0],[w+.15,.12,d+.07],'wood')
 h.box([0,.12,0],[w,.21,d],'wood')
 for x in (-w/2,w/2):h.box([x,ht/2,0],[.085,ht,d],'wood')
 h.box([-w/4,ht/2,.34],[w/2-.06,ht-.18,.07],'woodlight')
 for y in (ht*.29,ht*.74):h.box([-w/4,y,.38],[w/2-.18,ht*.33,.035],'wood')
 h.ball([-.08,ht*.46,.4],[.023,.036,.022],'brass')
 if open_door:
  h.box([w*.43,ht/2,.46],[w*.47,ht-.18,.065],'woodlight',rot=-.75)
  h.rod([-w/2+.1,ht-.25,0],[w/2-.1,ht-.25,0],.018,'metal')
  for x in np.linspace(.07,w/2-.17,5):
   h.box([x,ht*.49,.01],[.09,1.22,.37],RNG.choice(['fabric','velvet','linen']))
   h.rod([x,ht-.35,-.12],[x,ht-.25,0],.01,'metal')
   h.rod([x,ht-.25,0],[x,ht-.35,.12],.01,'metal')
 else:
  h.box([w/4,ht/2,.34],[w/2-.06,ht-.18,.07],'woodlight')
  for y in (ht*.29,ht*.74):h.box([w/4,y,.38],[w/2-.18,ht*.33,.035],'wood')
  h.ball([.08,ht*.46,.4],[.023,.036,.022],'brass')

def mirror(h,w=.8,ht=1.8,standing=True):
 h.box([0,ht/2,0],[w,ht,.1],'wood')
 h.box([0,ht/2,.058],[w-.12,ht-.15,.025],'mirror')
 for x in (-w/2+.025,w/2-.025):h.rod([x,.05,.08],[x,ht-.04,.08],.04,'brass')
 for y in (.03,ht-.03):h.rod([-w/2,y,.08],[w/2,y,.08],.04,'brass')
 for x in (-w/2,w/2):h.ball([x,ht,.03],[.08,.1,.035],'brass')
 if standing:
  for x in (-w/2-.045,w/2+.045):h.rod([x,0,-.2],[x,1.55,0],.035)

def doll(h):
 # Seated porcelain doll: feet and knees project toward the viewer, upright torso.
 h.cylinder([0,.21,0],.13,.3,'velvet',top=.073)
 h.ball([0,.43,0],[.1,.12,.095],'porcelain')
 h.ball([0,.48,-.035],[.11,.092,.075],'wood')
 for x in (-.04,.04):h.ball([x,.45,.088],[.014,.017,.009],'black')
 for x in (-.13,.13):
  h.rod([x*.65,.34,0],[x,.16,.07],.026,'porcelain')
  h.rod([x*.48,.085,0],[x*.48,.05,.2],.032,'porcelain')
  h.ball([x*.48,.05,.23],[.042,.035,.068],'black')
 h.box([0,.30,.084],[.115,.08,.018],'lace')

def computer(h):
 table(h,1.45,.72,.73)
 h.box([-.15,1.02,-.05],[.64,.51,.49],'linen')
 h.box([-.15,1.03,.207],[.54,.39,.025],'black')
 h.box([-.15,1.04,.223],[.47,.31,.009],'screen')
 h.box([-.15,.772,.13],[.64,.075,.28],'linen')
 h.box([.56,.33,0],[.24,.64,.57],'linen')
 for y in (.23,.26,.29,.32,.49):h.box([.56,y,.29],[.17,.014,.009],'black')
 h.box([-.17,.808,.28],[.56,.027,.16],'linen')
 for x in range(12):
  for z in range(3):h.box([-.4+x*.043,.827,.23+z*.041],[.033,.011,.03],'porcelain')
 h.ball([.3,.813,.26],[.045,.022,.06],'linen')

def piano(h):
 h.box([0,.67,0],[1.55,1.28,.42],'wood');h.box([0,.73,.32],[1.65,.17,.55],'wood')
 h.box([0,1.34,0],[1.66,.08,.48],'woodlight');h.box([0,1.04,.23],[1.4,.46,.04],'woodlight')
 for i in range(28):
  h.box([-.69+i*.051,.836,.39],[.048,.025,.29],'linen' if i not in (8,19) else 'black')
  if i%7 not in (2,6):h.box([-.667+i*.051,.86,.3],[.024,.035,.13],'black')
 for x in (-.68,.68):h.rod([x,.03,.53],[x,.76,.53],.055)
 for x in (-.16,0,.16):h.box([x,.13,.25],[.055,.05,.24],'brass')

def toilet(h):
 h.box([0,.61,-.22],[.45,.54,.2],'porcelain')
 h.ball([0,.36,.05],[.29,.16,.4],'porcelain')
 h.ball([0,.49,.08],[.225,.017,.27],'black')
 h.torus([0,.5,.08],.22,.035,'porcelain',rot=PI/2)
 h.cylinder([0,.15,0],.17,.3,'porcelain')
 h.box([.15,.82,-.11],[.07,.025,.025],'brass')

def basin(h):
 h.box([0,.77,0],[.71,.16,.49],'porcelain');h.ball([0,.857,.01],[.24,.015,.16],'damp')
 h.cylinder([0,.38,0],.1,.7,'porcelain')
 h.rod([.12,.85,-.17],[.12,1.02,-.17],.018,'metal');h.rod([.12,1.02,-.17],[.12,1.02,.01],.018,'metal')
 h.box([0,1.48,-.23],[.61,.75,.06],'mirror')
 for x in (-.33,.33):h.box([x,1.48,-.22],[.035,.81,.075],'rust')
 for a,b in [([-.23,.856,.09],[-.28,.856,.15]),([-.28,.856,.15],[-.26,.856,.235])]:h.rod(a,b,.003,'black',4)

def shower(h):
 h.box([0,.07,0],[1.05,.12,.85],'porcelain')
 h.rod([-.52,2.05,.28],[.52,2.05,.28],.019,'rust')
 for x in [-.5+i*.062 for i in range(10)]:
  h.box([x,1.19,.28+math.sin(x*45)*.025],[.065,1.64,.022],'linen')
  h.torus([x,2.02,.28],.035,.007,'metal')
 h.rod([.35,1.1,-.3],[.35,1.9,-.3],.018,'rust');h.ball([.35,1.9,-.24],[.09,.024,.07],'metal')

def car(h):
 h.box([0,.62,0],[1.85,.56,3.95],'damp')
 h.box([0,.92,1.2],[1.8,.19,1.45],'damp');h.box([0,.89,-1.48],[1.78,.14,.95],'damp')
 points=[]
 for y,z,w in [(1.0,-1.08,.86),(1.56,-.7,.72),(1.56,.35,.72),(1.0,.99,.86)]:
  points.extend([[-w,y,z],[w,y,z]])
 vertices=np.array(points);faces=[];centre=vertices.mean(axis=0)
 for q in [(0,1,3,2),(2,3,5,4),(4,5,7,6),(6,7,1,0),(0,2,4,6),(1,7,5,3)]:
  for f in ([q[0],q[1],q[2]],[q[0],q[2],q[3]]):
   a,b,c=vertices[f]
   if np.dot(np.cross(b-a,c-a),(a+b+c)/3-centre)<0:f.reverse()
   faces.append(f)
 h.add(trimesh.Trimesh(vertices,faces,process=False),'glass')
 h.box([0,1.575,-.18],[1.51,.055,1.1],'damp')
 for x in (-.9,.9):
  h.rod([x,.97,-1.08],[x*.8,1.57,-.7],.04,'metal');h.rod([x*.8,1.57,.35],[x,.97,.99],.04,'metal')
  h.rod([x,.97,-.2],[x*.8,1.57,-.2],.037,'metal')
  for z in (-1.25,1.27):
   h.rod([x-.1,.36,z],[x+.1,.36,z],.34,'black',16)
   xx=x+(.115 if x>0 else -.115);h.rod([xx-.01,.36,z],[xx+.01,.36,z],.19,'metal',12)
  for z in (-.62,.36):h.box([x*1.04,.83,z],[.035,.035,.15],'brass')
 for x in (-.59,.59):h.box([x,.86,2.003],[.41,.2,.023],'linen')
 h.box([0,.51,2.035],[1.93,.14,.1],'metal');h.box([0,.73,2.021],[.58,.18,.01],'black')
 for z in (-2.015,2.055):h.box([0,.54,z],[.41,.1,.01],'paper')

def place(h,room,kind,x,z,fn,y=None,yaw=0,size=None,**kw):
 if y is None:y=RISE if room.startswith('U') else 0
 p=h.begin(room,kind,x,z,y,yaw,size);fn(h,**kw);h.end();return p

def furnish(h):
 P=lambda *a,**k:place(h,*a,**k)
 # Living room: observed covered sofas, display hutch and carved hardwood piano.
 P('F02','sofa',6.45,-5.6,sofa,size=[2.35,1.1,.94])
 P('F02','sofa',8.4,-3.15,sofa,yaw=-PI/2,size=[2.35,1.1,.94])
 P('F02','armchair',4.45,-3.8,sofa,yaw=PI/2,w=.98,size=[.98,1.1,.94])
 P('F02','coffee-table',6.15,-3.3,table,w=1.7,d=.86,height=.43,size=[1.7,.5,.86])
 P('F02','doll',6.0,-5.48,doll,y=.61)
 P('F02','side-table',7.84,-5.6,table,w=.52,d=.54,height=.6,size=[.52,.65,.54])
 P('F02','piano',4.27,-6.48,piano,size=[1.7,1.4,1.0])
 P('F02','display-cabinet',8.25,-6.5,shelf,w=1.65,style='figurines',size=[1.85,2.5,.46])
 # Dining furniture uses explicit side tags for exact-count acceptance.
 P('F04','dining-table',5.5,-18.5,table,w=1.35,d=3.6,height=.78,size=[1.35,.84,3.6])
 for side,x,yaw in [('west',4.27,PI/2),('east',6.73,-PI/2)]:
  for z in (-19.62,-18.5,-17.38):P('F04','dining-chair',x,z,chair,yaw=yaw,size=[.52,1.06,.52])['side']=side
 for side,z,yaw in [('north',-20.93,0),('south',-16.07,PI)]:P('F04','dining-chair',5.5,z,chair,yaw=yaw,size=[.52,1.06,.52])['side']=side
 # Meal remains are placed at the table surface, not hovering above it.
 for x,z in [(x,z) for x in (5.05,5.95) for z in (-19.6,-18.5,-17.4)]+[(5.5,-20.03),(5.5,-16.97)]:
  h.begin('F04','place-setting',x,z,.842)
  h.cylinder([0,.013,0],.145,.025,'porcelain',24)
  h.torus([0,.026,0],.128,.009,'porcelain',rot=PI/2)
  for j in range(5):h.ball([RNG.uniform(-.075,.075),.047,RNG.uniform(-.075,.075)],[.037,.019,.038],'food')
  h.cylinder([.18,.091,-.12],.044,.18,'glass',12,top=.049)
  h.rod([-.18,.016,-.085],[-.18,.016,.09],.008,'metal')
  h.box([.18,.012,.05],[.019,.012,.17],'metal');h.end()
 # TV room with two sofas and an old glass CRT.
 P('F06','sofa',-4.65,-7.62,sofa,yaw=PI,size=[2.35,1.1,.94],mat='velvet')
 P('F06','sofa',-6.82,-9.83,sofa,yaw=PI/2,size=[2.35,1.1,.94],mat='velvet')
 P('F06','tv-table',-4.2,-11.4,table,w=1.5,d=.65,height=.46,size=[1.5,1.2,.75])
 h.begin('F06','crt-television',-4.2,-11.4,.52)
 h.box([0,.37,0],[1.02,.72,.58],'wood');h.box([-.08,.38,.303],[.7,.53,.05],'black');h.box([-.08,.38,.335],[.61,.44,.045],'screen')
 for y in (.25,.47):h.cylinder([.38,y,.34],.045,.05,'brass')
 h.rod([-.12,.75,-.12],[-.45,1.16,-.1],.007,'metal');h.rod([.12,.75,-.12],[.42,1.05,-.1],.007,'metal');h.end()
 P('F06','side-table',-2.45,-7.65,table,w=.55,d=.6,height=.58,size=[.55,.62,.6])
 h.begin('F06','remote',-2.45,-7.65,.64);h.box([0,0,0],[.07,.025,.2],'black')
 for z in (-.06,-.02,.02,.06):h.box([0,.016,z],[.034,.008,.018],'linen')
 h.end()
 # Large shelving before the CR, and separate bathroom fixtures.
 P('F07','bookshelf',3.8,-7.5,shelf,yaw=PI,w=3.3,size=[3.45,2.4,.47])
 bathroom(h,'F07',[(8.65,-7.7,PI),(8.8,-10.5,-PI/2),(6.9,-11.3,0)])
 P('F08','bar-cabinet',1.0,-13.5,shelf,yaw=-PI/2,w=1.9,style='glass',size=[2.05,2.5,.48])
 kitchen(h)
 # Car and rear access; none of the decorative loose tires occlude the route.
 P('F09','car',-4.65,-3.05,car,size=[2.05,1.65,4.2])
 P('F09','mirror',-7.25,-5.85,mirror,yaw=PI/2,size=[.9,1.9,.26])
 P('F09','workbench',-4.65,-6.57,table,w=2.1,d=.65,height=.86,size=[2.1,.9,.65])
 P('F09','damaged-cabinet',-2.0,-1.3,wardrobe,yaw=-PI/2,w=1.4,ht=1.6,size=[1.5,1.7,.7])
 for x,z in [(-7,-.9),(-7,-1.8),(-2.3,-3.0)]:
  h.begin('F09','box',x,z,size=[.58,.65,.6]);h.box([0,.32,0],[.58,.64,.6],'paper');h.box([0,.645,0],[.08,.006,.61],'woodlight');h.end()
 h.begin('F09','covered-furniture',-6.9,-3.25,size=[.72,1.05,1.15]);h.box([0,.48,0],[.72,.94,1.1],'linen');h.box([0,.92,-.29],[.68,.37,.42],'linen');h.end()
 for y in (.12,.32,.52):
  h.begin('F09','spare-tire',-2.13,-4.42,y);h.torus([0,0,0],.25,.095,'black',rot=PI/2);h.end()
 # Cabinet-lined approach to the accessible breaker. H2 is placed here later.
 for z in (-2.15,-3.55):P('U00','display-cabinet',-1.06,z,shelf,yaw=PI/2,w=.83,ht=1.92,style='figurines',size=[.98,2.1,.44])
 h.begin('U00','breaker',-1.25,-4.65,RISE+1.14,PI/2)
 h.box([0,.25,0],[.43,.5,.13],'metal');h.box([-.13,.25,.17],[.31,.46,.04],'rust',rot=-.85)
 for y in (.13,.26,.39):
  for x in (-.07,.08):h.box([x,y,.09],[.055,.055,.034],'black')
 h.box([0,.45,.091],[.22,.025,.004],'paper');h.end()
 # Master 1: short book-lined private corridor and separate CR/terrace doors.
 P('U01','bookshelf',4.32,-1.93,shelf,w=1.23,ht=2.12,size=[1.38,2.25,.46])
 P('U01','bed',6.64,-6.7,bed,w=2.08,d=2.6,size=[2.18,1.5,2.7])
 P('U01','wardrobe',4.13,-6.6,wardrobe,yaw=PI/2,w=1.8,size=[1.94,2.55,.7])
 P('U01','computer',8.83,-4.38,computer,yaw=-PI/2,size=[1.5,1.35,.8])
 P('U01','bookshelf',8.75,-7.15,shelf,yaw=-PI/2,w=1.5,ht=2.0,size=[1.65,2.15,.46])
 P('U01','bedside-table',5.2,-7.25,table,w=.48,d=.55,height=.6,size=[.48,.65,.55])
 bathroom(h,'U01',[(8.85,-.6,PI),(8.0,-2.45,0),(8.85,-1.85,-PI/2)])
 # Study is a shared sleeping space: exactly two separate beds.
 for x in (-6.48,-2.47):P('U02','bed',x,-5.8,bed,w=1.28,size=[1.38,1.5,2.45])
 P('U02','computer',-4.6,-7.6,computer,size=[1.5,1.4,.8])
 P('U02','bookshelf',-1.94,-3.3,shelf,yaw=-PI/2,w=2.0,size=[2.15,2.45,.46])
 P('U02','sofa',-6.77,-1.53,sofa,yaw=PI/2,w=2.0,size=[2.0,1.1,.94])
 P('U02','bookshelf',-6.3,-7.83,shelf,w=1.4,ht=1.8,size=[1.5,1.9,.45])
 # Guest room: the antique mirror is mounted over the headboard.
 P('U03','bed',6.0,-13.23,bed,w=2.05,d=2.48,size=[2.15,1.5,2.58])
 P('U03','headboard-mirror',6.0,-14.65,mirror,y=RISE+1.55,w=1.75,ht=1.05,standing=False)
 P('U03','wardrobe',2.17,-13.0,wardrobe,yaw=PI/2,w=2.0,size=[2.12,2.55,.7])
 P('U03','bookshelf',8.78,-9.4,shelf,yaw=-PI/2,w=1.75,size=[1.9,2.45,.46])
 P('U03','bedside-table',7.46,-13.8,table,w=.56,d=.57,height=.63,size=[.56,.7,.57])
 for x in (-6.35,-2.67):P('U04','bed',x,-13.1,bed,w=1.35,size=[1.45,1.5,2.45])
 P('U04','dresser',-4.75,-8.65,wardrobe,w=1.35,ht=1.12,yaw=PI,size=[1.5,1.25,.72])
 bathroom(h,'U05',[(-4.45,-18.35,0),(-2.25,-18.55,0),(-4.63,-15.62,PI)])
 P('U06','bed',5.62,-20.4,bed,w=2.3,d=2.65,size=[2.4,1.5,2.75])
 P('U06','doll',5.62,-20.62,doll,y=RISE+.74)
 P('U06','mirror',8.88,-16.3,mirror,yaw=-PI/2,w=.92,ht=1.98,size=[1.03,2.1,.3])
 for z in (-20.72,-18.57):P('U06','wardrobe',2.15,z,wardrobe,yaw=PI/2,w=1.9,open_door=True,size=[2.03,2.55,1.05])
 P('U06','bedside-table',7.18,-21.1,table,w=.57,d=.58,height=.6,size=[.57,.65,.58])

def bathroom(h,room,positions):
 for kind,fn,(x,z,yaw),size in zip(['toilet','basin','shower'],[toilet,basin,shower],positions,[[.6,.9,.85],[.78,1.9,.55],[1.05,2.1,.85]]):
  place(h,room,kind,x,z,fn,yaw=yaw,size=size)

def kitchen(h):
 h.begin('F05','counter',-5,-21.5,size=[3.65,.94,.82])
 h.box([0,.45,0],[3.65,.88,.77],'linen');h.box([0,.94,0],[3.74,.1,.86],'tile')
 for x in (-1.32,-.46,.46,1.32):
  h.box([x,.46,.395],[.82,.75,.028],'woodlight');h.box([x+.24,.66,.423],[.14,.025,.03],'metal')
 h.box([-.65,1.005,0],[.85,.018,.55],'metal');h.box([-.65,1.017,0],[.67,.016,.4],'damp')
 h.rod([-.4,.99,-.25],[-.4,1.3,-.25],.025,'rust');h.rod([-.4,1.3,-.25],[-.4,1.3,.02],.025,'metal')
 for i in range(5):h.cylinder([.66,1.01+i*.032,.0],.18,.03,'porcelain',20)
 h.end()
 h.begin('F05','stove',-2.35,-21.34,size=[.95,1.0,.91]);h.box([0,.46,0],[.95,.9,.88],'linen');h.box([0,.94,0],[.99,.1,.94],'metal')
 for x in (-.24,.24):
  for z in (-.23,.23):h.torus([x,1.005,z],.16,.016,'black',rot=PI/2)
 h.box([0,.48,.454],[.75,.43,.026],'black');h.box([0,.76,.49],[.7,.043,.048],'rust')
 for x in (-.31,-.1,.1,.31):h.ball([x,.84,.473],[.04,.04,.025],'metal')
 h.end()
 h.begin('F05','refrigerator',-6.94,-15.67,0,PI,size=[.91,1.96,.82]);h.box([0,.98,0],[.91,1.96,.82],'linen')
 for y,ht in ((.61,1.13),(1.56,.65)):h.box([0,y,.431],[.85,ht,.055],'porcelain');h.box([-.31,y,.476],[.04,.32,.055],'rust')
 h.end()
 for x in (-6.65,-2.35):place(h,'F05','cupboard',x,-21.66,wardrobe,w=1.1,ht=.9,y=1.78,size=None)
 h.begin('F05','abandoned-food',-3.95,-21.47,1.0)
 h.cylinder([0,.035,0],.18,.07,'porcelain',top=.21)
 for x,z in [(-.08,.04),(.06,.06),(0,-.07)]:h.ball([x,.075,z],[.06,.035,.07],'food')
 for x in (-.25,-.43):h.cylinder([x,.1,.11],.047,.2,'rust')
 h.end()
