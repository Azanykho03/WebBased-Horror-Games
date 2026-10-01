"""Small reusable native mesh builder. Exports standard glTF for Babylon.js."""
from collections import defaultdict
from pathlib import Path
import math, json
import numpy as np
import trimesh
from PIL import Image
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals

PALETTE = {
 'plaster':('#b9b4a0',.94), 'wood':('#573422',.7), 'woodlight':('#866044',.8),
 'tile':('#aaa799',.8), 'damp':('#5f685a',1), 'metal':('#514f46',.65),
 'brass':('#aa8b51',.4), 'fabric':('#626858',1), 'velvet':('#654941',1),
 'linen':('#b6b1a0',1), 'lace':('#c8c6aa',1), 'black':('#161b19',.85),
 'glass':('#698381',.3), 'mirror':('#707d78',.24), 'porcelain':('#c1bfaa',.55),
 'paper':('#bbad86',1), 'bookred':('#744a39',.9), 'bookblue':('#424f59',.9),
 'bookgreen':('#555e43',.9), 'food':('#4b5733',1), 'rust':('#734831',1),
 'screen':('#304b46',.8), 'glow':('#e9be7e',.7), 'portrait':('#726249',1), 'window':('#7f9690',.5),
}
class House:
 def __init__(self, out, phase):
  self.out=Path(out);self.phase=phase;self.detailed=phase not in ('blockout','furniture')
  self.parts=defaultdict(list);self.colliders=[];self.props=[];self.windows=[];self.doors=[];self.lights=[]
  self.materials={};self.base=np.eye(4);self.room='F01';self.counter=0
  for name,(hexcol,rough) in PALETTE.items():
   color=[int(hexcol[i:i+2],16) for i in (1,3,5)]+[255]
   path=self.out/'textures'/(name+'.png')
   tex=Image.open(path).convert('RGB') if self.detailed and path.exists() else None
   self.materials[name]=PBRMaterial(name=name,baseColorFactor=[255]*4 if tex else color,baseColorTexture=tex,roughnessFactor=rough,metallicFactor=.35 if name in ('metal','brass','mirror') else 0,doubleSided=False,emissiveFactor=[.16,.12,.07] if name=='glow' else ([.045,.09,.08] if name=='screen' else None))
  stain=self.out/'textures/stain.png'
  if stain.exists():self.materials['stain']=PBRMaterial(name='stain',baseColorTexture=Image.open(stain).convert('RGBA'),baseColorFactor=[255]*4,roughnessFactor=1,metallicFactor=0,alphaMode='BLEND',doubleSided=True)
  self.materials['cabinet-glass']=PBRMaterial(name='cabinet-glass',baseColorFactor=[144,155,133,33],roughnessFactor=.37,metallicFactor=.06,alphaMode='BLEND',doubleSided=True)
 def add(self,mesh,mat,pos=(0,0,0),rot=0,group=None):
  if len(mesh.faces)==0:return
  # Split vertices on faces for stable flat normals and metre-scaled planar UVs.
  verts=mesh.vertices[mesh.faces].reshape((-1,3));faces=np.arange(len(verts)).reshape((-1,3))
  normals=np.repeat(mesh.face_normals,3,axis=0);uv=np.zeros((len(verts),2))
  axis=np.argmax(abs(normals),axis=1)
  for a,ab in [(0,(2,1)),(1,(0,2)),(2,(0,1))]:
   mask=axis==a;uv[mask]=verts[mask][:,ab]
  scale=.65 if mat in ('wood','woodlight') else 1
  uv*=scale
  if mat in ('portrait','stain'):
   span=np.ptp(uv,axis=0);uv=(uv-uv.min(axis=0))/np.maximum(span,.0001)
  m=trimesh.Trimesh(verts,faces,process=False,visual=TextureVisuals(uv=uv,material=self.materials[mat]))
  t=trimesh.transformations.rotation_matrix(rot,[0,1,0]);t[:3,3]=pos;m.apply_transform(self.base@t)
  self.parts[(group or self.room,mat)].append(m)
  return m
 def box(self,pos,size,mat='wood',rot=0,solid=False,label=None,group=None):
  m=self.add(trimesh.creation.box(size),mat,pos,rot,group)
  if solid:
   b=m.bounds;self.colliders.append(dict(id=label or f'collider-{len(self.colliders)}',room=self.room,min=b[0].round(5).tolist(),max=b[1].round(5).tolist()))
  return m
 def ball(self,pos,scale,mat='porcelain'):
  m=trimesh.creation.icosphere(subdivisions=1 if max(scale)<.11 else 2);m.apply_scale(scale);return self.add(m,mat,pos)
 def cylinder(self,pos,radius,height,mat='wood',sections=12,top=None):
  if top is None:m=trimesh.creation.cylinder(radius=radius,height=height,sections=sections)
  else:
   m=trimesh.creation.cylinder(radius=radius,height=height,sections=sections)
   m.vertices[m.vertices[:,2]>0,:2]*=top/radius
  m.apply_transform(trimesh.transformations.rotation_matrix(-math.pi/2,[1,0,0]));return self.add(m,mat,pos)
 def rod(self,a,b,r=.025,mat='wood',sections=8):
  a=np.array(a);b=np.array(b);d=b-a
  m=trimesh.creation.cylinder(radius=r,height=np.linalg.norm(d),sections=sections)
  m.apply_transform(trimesh.geometry.align_vectors([0,0,1],d));return self.add(m,mat,(a+b)/2)
 def torus(self,pos,major,minor,mat='brass',rot=None):
  m=trimesh.creation.torus(major_radius=major,minor_radius=minor,major_sections=16,minor_sections=6)
  if rot is not None:m.apply_transform(trimesh.transformations.rotation_matrix(rot,[1,0,0]))
  return self.add(m,mat,pos)
 def begin(self,room,kind,x,z,y=0,yaw=0,size=None):
  self.room=room;self.base=trimesh.transformations.rotation_matrix(yaw,[0,1,0]);self.base[:3,3]=[x,y,z]
  prop=dict(id=f'{room}-{kind}-{len(self.props)+1:03d}',room=room,kind=kind,position=[x,y,z],yaw=yaw)
  self.props.append(prop)
  if size:
   # Collider uses an oriented rectangle; preserve transform for exact navigation.
   w,h,d=size
   self.colliders.append(dict(id=prop['id'],room=room,center=[x,y+h/2,z],size=size,yaw=yaw))
  return prop
 def end(self):self.base=np.eye(4)
 def export(self,path):
  scene=trimesh.Scene()
  for (room,mat),parts in self.parts.items():
   mesh=trimesh.util.concatenate(parts)
   name=f'{room}__{mat}'
   scene.add_geometry(mesh,node_name=name,geom_name=name)
  path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
  # Before replacing a compiled house, preserve that exact previous artifact.
  if path.exists():
   import hashlib
   digest=hashlib.sha256(path.read_bytes()).hexdigest()[:12]
   backup=self.out.parents[4]/'.cache/3d-generation/runs/haunted-house/history'/digest
   backup.mkdir(parents=True,exist_ok=True)
   import shutil
   for previous in ('haunted-house.glb','house-manifest.json','generation-info.json'):
    src=path.parent/previous
    if src.exists() and not (backup/previous).exists():shutil.copy2(src,backup/previous)
  path.write_bytes(scene.export(file_type='glb'))
  return {'meshBatches':len(scene.geometry),'triangles':sum(len(m.faces) for m in scene.geometry.values()),'vertices':sum(len(m.vertices) for m in scene.geometry.values()),'bytes':path.stat().st_size,'materials':len(self.materials)}
