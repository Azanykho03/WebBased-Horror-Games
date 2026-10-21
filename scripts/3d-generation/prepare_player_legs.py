"""Build a small skinned uniform from the supplied (unrigged) lower-body scan.

The source remains intact. Geometry is welded/clustered offline, fitted into real
trouser fabric geometry, and assigned normalized connected hip/knee/ankle weights.
No runtime cloth solver, image service, or replacement anatomical model is used.
"""
from pathlib import Path
import hashlib
import json
import struct
import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/assets/models/player/legs'
SOURCE = OUT / 'source/female_skinny_bottom_part.glb'


def cluster(mesh, cell=.006):
    _, inverse = np.unique(np.round(mesh.vertices / cell).astype(np.int32), axis=0, return_inverse=True)
    count = np.bincount(inverse)
    vertices = np.column_stack([np.bincount(inverse, weights=mesh.vertices[:, k]) / count for k in range(3)])
    faces = inverse[mesh.faces]
    faces = faces[(faces[:, 0] != faces[:, 1]) & (faces[:, 1] != faces[:, 2]) & (faces[:, 0] != faces[:, 2])]
    _, unique = np.unique(np.sort(faces, axis=1), axis=0, return_index=True)
    result = trimesh.Trimesh(vertices=vertices, faces=faces[np.sort(unique)], process=True)
    result.remove_unreferenced_vertices()
    return result


def smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def above(mesh, height):
    vertices,faces=[],[]
    for face in mesh.faces:
        polygon=list(mesh.vertices[face]); clipped=[]
        for a,b in zip(polygon,polygon[1:]+polygon[:1]):
            if a[1]>=height:clipped.append(a)
            if (a[1]>=height)!=(b[1]>=height):clipped.append(a+(b-a)*(height-a[1])/(b[1]-a[1]))
        if len(clipped)<3:continue
        start=len(vertices);vertices.extend(clipped)
        for k in range(1,len(clipped)-1):faces.append([start,start+k,start+k+1])
    return trimesh.Trimesh(vertices=vertices,faces=faces,process=True)


def relax(mesh, iterations=2):
    edges=np.vstack([mesh.faces[:,[0,1]],mesh.faces[:,[1,2]],mesh.faces[:,[2,0]]]);edges=np.vstack([edges,edges[:,::-1]])
    count=np.bincount(edges[:,0],minlength=len(mesh.vertices))
    for _ in range(iterations):
        totals=np.zeros_like(mesh.vertices);np.add.at(totals,edges[:,0],mesh.vertices[edges[:,1]])
        avg=totals/np.maximum(count,1)[:,None]
        mesh.vertices[:]=mesh.vertices*.84+avg*.16


source = trimesh.load_scene(SOURCE, process=False).to_mesh()
raw_counts = [len(source.vertices), len(source.faces)]
# Source inspection: Z-up source transformed by glTF to Y-up; anatomical front
# faces +Z. Runtime faces -Z. Scale feet-to-waist height to 1.10m.
source.vertices[:, 1] -= source.bounds[0, 1]
scale = 1.10 / source.bounds[1, 1]
source.vertices *= scale
source.vertices[:, [0, 2]] *= -1
mesh = cluster(source)

# Cut cloth at the ankle. This is an expanded shell based on the supplied mesh,
# not skin recolored as pants. Covered skin is omitted to prevent z-fighting.
pants = above(mesh, .115)
# A trouser waist stops below the scan's exposed lower abdomen.
pants.vertices[:, 1] *= -1
pants = above(pants, -1.035)
pants.vertices[:, 1] *= -1
v = pants.vertices.copy()
cloth_sides = np.sign(v[:,0]).copy()
centers = []
for y in np.linspace(.115, .92, 36):
    band = source.vertices[(np.abs(source.vertices[:, 1] - y) < .016) & (source.vertices[:, 0] > .012)]
    lo, hi = band.min(axis=0), band.max(axis=0)
    centers.append([y, (lo[0] + hi[0])/2, (lo[2]+hi[2])/2])
centers = np.array(centers)
for i, (x, y, z) in enumerate(v):
    side = 1 if x >= 0 else -1
    cx = np.interp(y, centers[:, 0], centers[:, 1]) * side
    cz = np.interp(y, centers[:, 0], centers[:, 2])
    leg = 1 - smooth((y - .82) / .13)
    dx, dz = x - cx, z - cz
    radius = np.hypot(dx, dz)
    # Loose straight-cut legs taper only at the ankle; soft folds at the knees
    # and cuff are geometry, with a front pressed crease and stitched side seam.
    minimum = np.interp(y, [.115, .20, .40, .55, .72, .86], [.056, .068, .075, .077, .087, .099])
    theta = np.arctan2(dz, dx)
    crease = .003 * np.exp(-((np.cos(theta)) / .18) ** 2)
    folds = (.0035 * np.sin(y * 125 + theta * 2) * np.exp(-((y - .53) / .085) ** 2)
             + .003 * np.sin(y * 145 - theta) * np.exp(-((y - .16) / .05) ** 2))
    wanted = max(radius + .012, minimum) + crease + folds
    ratio = wanted / max(radius, 1e-4)
    v[i, 0] = x + dx * (ratio - 1) * leg
    if y < .78: v[i, 0] = side * max(.004, side * v[i, 0])
    v[i, 2] = z + dz * (ratio - 1) * leg
    if y > .82:
        # Cloth ease around the pelvis, smooth at the crotch and waist.
        v[i, 0] += x * .055 * (1 - leg)
        v[i, 2] += np.sign(z) * .009 * (1 - leg)
pants.vertices = v
relax(pants)

# Waistband and hems share the same bone skin as the fabric surface.
def band(y, radius_x, radius_z, center_z, height, name):
    vertices, faces = [], []
    for ring_y in [y-height/2, y+height/2]:
        for a in np.linspace(0, 2*np.pi, 64, endpoint=False):
            vertices.append([radius_x*np.cos(a), ring_y, center_z+radius_z*np.sin(a)])
    for i in range(64):
        j=(i+1)%64
        faces += [[i,j,64+j],[i,64+j,64+i]]
    # The supplied scan ends at the waist. Close that cut beneath the virtual
    # torso so the grounded camera sees cloth, not the hollow leg interior.
    center=len(vertices);vertices.append([0,y+height/2,center_z])
    for i in range(64):faces.append([center,64+(i+1)%64,64+i])
    return trimesh.Trimesh(vertices=vertices,faces=faces,process=False)
waist = pants.vertices[pants.vertices[:,1] > 1.012]
lo, hi = waist.min(axis=0), waist.max(axis=0)
waistband = band(1.019, max(abs(lo[0]),abs(hi[0]))+.002, (hi[2]-lo[2])/2+.003, (hi[2]+lo[2])/2, .032, 'waistband')

# Shoes are closed smooth lofts fitted to each original foot; they are skinned
# to the ankle, not disconnected scene props. Keep the original foot proportions.
shoes=[]
for side in [-1,1]:
    points=mesh.vertices[(mesh.vertices[:,0]*side>0)&(mesh.vertices[:,1]<.13)]
    z0,z1=points[:,2].min()-.005,points[:,2].max()+.005
    profiles=[]
    for z in np.linspace(z0+.008,z1-.008,20):
        cross=points[np.abs(points[:,2]-z)<.016]
        lo,hi=cross.min(axis=0),cross.max(axis=0)
        profiles.append([z,(lo[0]+hi[0])/2,(hi[0]-lo[0])/2+.005,max(.055,hi[1]+.005)])
    profiles=np.array(profiles);vertices=[];faces=[]
    for r,z in enumerate(np.linspace(z0,z1,24)):
        cx,rx,top=[np.interp(z,profiles[:,0],profiles[:,k]) for k in [1,2,3]]
        taper=.15 if r in [0,23] else 1
        for theta in np.linspace(0,2*np.pi,24,endpoint=False):
            vertices.append([cx+rx*np.cos(theta)*taper,.014+max(0,np.sin(theta))*(top-.014)*taper,z])
        if r:
            for k in range(24):
                a=(r-1)*24+k;b=(r-1)*24+(k+1)%24;c=r*24+k;d=r*24+(k+1)%24
                faces.extend([[a,c,d],[a,d,b]])
    for ring,reverse in [(0,True),(23,False)]:
        for k in range(1,23):
            tri=[ring*24,ring*24+k,ring*24+k+1];faces.append(tri[::-1] if reverse else tri)
    shoe=trimesh.Trimesh(vertices=vertices,faces=faces,process=True)
    shoes.append(shoe)
shoe_sides=np.concatenate([np.full(len(shoe.vertices),side) for shoe,side in zip(shoes,[-1,1])])
shoes=trimesh.util.concatenate(shoes)

HIP=.92
# Joint centers measured from cross sections at ankle / knee / hip. All bone
# local frames are identity at bind pose; parenting supplies connected limbs.
joint_positions=[np.array([0,HIP,0])]
names=['Pelvis']; parents=[None]
for side,label in [(-1,'L'),(1,'R')]:
    base=len(names)
    for label_part,y in [('Thigh',.90),('Shin',.55),('Foot',.105)]:
        cx=np.interp(y,centers[:,0],centers[:,1])*side
        cz=np.interp(y,centers[:,0],centers[:,2])
        joint_positions.append(np.array([cx,y,cz])); names.append(f'{label_part}.{label}')
    parents += [0,base,base+1]

def weights(vertices,sides=None,shoe=False):
    joints=np.zeros((len(vertices),4),dtype=np.uint16); w=np.zeros((len(vertices),4),dtype=np.float32)
    for i,(x,y,z) in enumerate(vertices):
        # Clothing ease can cross the centerline. Assign by the original leg,
        # never by the expanded cloth position (which would stretch bridges).
        side=sides[i] if sides is not None else x
        thigh,shin,foot=(1,2,3) if side<0 else (4,5,6)
        if shoe:
            pair=(foot,foot); values=(1,0)
        elif y>.82:
            t=float(smooth((y-.82)/.15)); pair=(thigh,0); values=(1-t,t)
        elif y>.46:
            t=float(smooth((y-.46)/.17)); pair=(shin,thigh); values=(1-t,t)
        else:
            t=float(smooth((y-.08)/.10)); pair=(foot,shin); values=(1-t,t)
        joints[i,:2]=pair; w[i,:2]=values
    return joints,w

gltf={'asset':{'version':'2.0','generator':'Escape the Haunting / prepare_player_legs.py',
      'extras':{'source':str(SOURCE.relative_to(ROOT)), 'license':'CC-BY-4.0', 'author':'Depressive_k1d; uniform and skinning adapted in-project'}},
      'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':'PlayerUniformRoot','children':[]}],
      'meshes':[],'skins':[],'bufferViews':[],'accessors':[],'materials':[
        {'name':'Student navy woven trousers','pbrMetallicRoughness':{'baseColorFactor':[.045,.063,.105,1],'metallicFactor':0,'roughnessFactor':.94},'doubleSided':True},
        {'name':'Uniform waistband','pbrMetallicRoughness':{'baseColorFactor':[.035,.047,.076,1],'metallicFactor':0,'roughnessFactor':.9},'doubleSided':True},
        {'name':'Black school shoes','pbrMetallicRoughness':{'baseColorFactor':[.022,.026,.030,1],'metallicFactor':0,'roughnessFactor':.48}}]}
chunks=[]; length=0
def accessor(array,kind,component,bounds=False):
    global length
    data=array.tobytes(); pad=(-length)%4
    if pad: chunks.append(bytes(pad));length+=pad
    view=len(gltf['bufferViews']);gltf['bufferViews'].append({'buffer':0,'byteOffset':length,'byteLength':len(data)})
    chunks.append(data);length+=len(data)
    a={'bufferView':view,'componentType':component,'count':len(array),'type':kind}
    if bounds:a.update(min=array.min(axis=0).tolist(),max=array.max(axis=0).tolist())
    index=len(gltf['accessors']);gltf['accessors'].append(a);return index

for i,name in enumerate(names):
    parent=parents[i];position=joint_positions[i]-(joint_positions[parent] if parent is not None else np.array([0,HIP,0]))
    node={'name':name,'translation':position.tolist(),'children':[]}
    gltf['nodes'].append(node)
    gltf['nodes'][parent+1 if parent is not None else 0]['children'].append(i+1)
ib=[]
for p in joint_positions:
    mat=np.eye(4,dtype=np.float32);mat[:3,3]=-(p-[0,HIP,0]);ib.append(mat.T.reshape(16))
gltf['skins'].append({'name':'Connected uniform leg rig','skeleton':1,'joints':list(range(1,8)),'inverseBindMatrices':accessor(np.array(ib,dtype=np.float32),'MAT4',5126)})
for material,(name,part) in enumerate([('UniformTrousers',pants),('Waistband',waistband),('SchoolShoes',shoes)]):
    j,w=weights(part.vertices,cloth_sides if material==0 else shoe_sides if material==2 else None,material==2)
    positions=(part.vertices-[0,HIP,0]).astype(np.float32)
    # Area-weighted normals, avoiding optional scipy and a runtime dependency.
    triangles=part.vertices[part.faces]
    face_normals=np.cross(triangles[:,1]-triangles[:,0],triangles[:,2]-triangles[:,0])
    normals=np.zeros_like(part.vertices)
    for corner in range(3):np.add.at(normals,part.faces[:,corner],face_normals)
    normals=(normals/np.maximum(np.linalg.norm(normals,axis=1),1e-10)[:,None]).astype(np.float32)
    attrs={'POSITION':accessor(positions,'VEC3',5126,True),'NORMAL':accessor(normals,'VEC3',5126),
           'JOINTS_0':accessor(j,'VEC4',5123),'WEIGHTS_0':accessor(w,'VEC4',5126)}
    indices=accessor(part.faces.astype(np.uint32).reshape(-1),'SCALAR',5125)
    gltf['meshes'].append({'name':name,'primitives':[{'attributes':attrs,'indices':indices,'material':material}]})
    gltf['nodes'][0]['children'].append(len(gltf['nodes']));gltf['nodes'].append({'name':name,'mesh':material,'skin':0})
binary=b''.join(chunks);binary+=bytes((-len(binary))%4);gltf['buffers']=[{'byteLength':len(binary)}]
encoded=json.dumps(gltf,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
out=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary
(OUT/'student-uniform-legs.glb').write_bytes(out)
report={'source':str(SOURCE.relative_to(ROOT)),'sourceSHA256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'sourceVertices':raw_counts[0],'sourceTriangles':raw_counts[1],'sourceSkins':0,'sourceAnimations':0,
        'runtimeBytes':len(out),'runtimeVertices':sum(len(m.vertices) for m in [pants,waistband,shoes]),
        'runtimeTriangles':sum(len(m.faces) for m in [pants,waistband,shoes]),'scale':scale,'hipHeight':HIP,
        'joints':{name:p.tolist() for name,p in zip(names,joint_positions)},'technique':'Offline fitted trouser shell, closed waist, geometry folds, connected 7-bone normalized skin, original-foot shoe lofts'}
(OUT/'leg-integration-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
