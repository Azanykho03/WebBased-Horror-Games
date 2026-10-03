"""Refine preserved HF reconstructions and assemble a camera-ready flashlight grip.

This stage never invokes image generation or inference. Raw GLBs remain intact.
Coordinates are metres, Y-up, with the flashlight beam pointing along local -Z.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import numpy as np
import trimesh
from PIL import Image
from scipy.spatial import cKDTree
from scipy.ndimage import gaussian_filter
from scipy.interpolate import PchipInterpolator
from trimesh.visual import TextureVisuals
from trimesh.visual.material import PBRMaterial

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.cache/3d-generation/flashlight-refinement'
GRIP = np.array([.003, .107, .263])

def smooth_normals(mesh):
    """Share surface normals across UV seams without welding UV coordinates."""
    _, inverse = np.unique(np.round(mesh.vertices, 7), axis=0, return_inverse=True)
    totals = np.zeros((inverse.max() + 1, 3))
    face_vectors = np.cross(mesh.triangles[:, 1] - mesh.triangles[:, 0], mesh.triangles[:, 2] - mesh.triangles[:, 0])
    for corner in range(3):
        np.add.at(totals, inverse[mesh.faces[:, corner]], face_vectors)
    normals = totals / np.maximum(np.linalg.norm(totals, axis=1, keepdims=True), 1e-12)
    mesh.vertex_normals = normals[inverse]
    return mesh

def prepare_arm(source):
    mesh = trimesh.load_scene(source, process=False).to_mesh()
    # Preserve the inferred fingers and palm. Rebuild the defective pinched
    # forearm as rounded cross sections fitted to the source's centreline.
    cut = .205
    vertices, faces, uv = trimesh.intersections.slice_faces_plane(
        mesh.vertices, mesh.faces, [0, 0, 1], [0, 0, cut], uv=mesh.visual.uv)
    skin = mesh.visual.material.copy()
    skin.baseColorTexture = skin.baseColorTexture.convert('RGB').resize((1024,1024),Image.Resampling.LANCZOS)
    skin.name = 'Arm_skin'; skin.metallicFactor = 0; skin.roughnessFactor = .62
    skin.doubleSided = False
    hand = trimesh.Trimesh(vertices=vertices, faces=faces,
        visual=TextureVisuals(uv=uv, material=skin), process=False)
    smooth_normals(hand)
    rim = np.unique(np.round(vertices[np.abs(vertices[:, 2] - cut) < 1e-7], 8), axis=0)
    centre = rim.mean(axis=0)
    order = np.argsort(np.arctan2(rim[:, 1] - centre[1], rim[:, 0] - centre[0]))
    rim = rim[order]
    cap_faces = [[len(rim), (i+1) % len(rim), i] for i in range(len(rim))]
    hand_cap = trimesh.Trimesh(vertices=np.vstack((rim, centre)), faces=cap_faces, process=False)
    cap_material=PBRMaterial(name='Arm_closed_cap',baseColorFactor=[.53,.32,.23,1],metallicFactor=0,roughnessFactor=.7)
    hand_cap.visual = TextureVisuals(material=cap_material)
    # z, centre y, radius x, radius y; measured from the saved TRELLIS arm.
    profile=np.array([[-.12,-.105,.047,.046],[-.08,-.103,.047,.047],[-.04,-.102,.044,.050],
        [0,-.092,.040,.048],[.04,-.076,.037,.045],[.08,-.048,.032,.041],
        [.12,-.011,.027,.037],[.16,.023,.022,.033],[.185,.044,.021,.030],
        [.205,.058,.0195,.028],[.208,.060,.019,.028]])
    splines=[PchipInterpolator(profile[:,0],profile[:,i]) for i in [1,2,3]]
    def surface(theta,z):
        cy,rx,ry=[s(z) for s in splines]
        # Small asymmetric tendon volumes preserve an anatomical silhouette.
        radius=1/np.sqrt((np.cos(theta)/rx)**2+(np.sin(theta)/ry)**2)
        radius*=1+.025*np.cos(theta*3)*np.clip((z+.02)/.2,0,1)
        return np.stack((.003+radius*np.cos(theta),cy+radius*np.sin(theta),z),axis=-1)
    segments,rings=64,56
    theta,z=np.meshgrid(np.linspace(0,2*np.pi,segments+1),np.linspace(-.12,.208,rings))
    body_vertices=surface(theta,z).reshape(-1,3)
    body_uv=np.stack((theta/(2*np.pi),(z+.12)/.328),axis=-1).reshape(-1,2)
    body_faces=[]
    for i in range(rings-1):
        for j in range(segments):
            a=i*(segments+1)+j;b=a+1;c=a+segments+1;d=c+1
            body_faces.extend([[a,b,c],[b,d,c]])
    # Bake the reconstructed front-side skin around the repaired volume. The
    # unseen black gaps in the generated atlas are not treated as skin colour.
    tu,tv=np.meshgrid(np.linspace(0,2*np.pi,512),np.linspace(.208,-.12,1024))
    samples=surface(tu,tv).reshape(-1,3)
    samples[:,0]=np.abs(samples[:,0]-.003)+.003
    source_pixels=np.asarray(mesh.visual.material.baseColorTexture.convert('RGB'))
    source_uv=mesh.visual.uv
    vertex_pixels=source_pixels[np.clip(((1-source_uv[:,1])*(source_pixels.shape[0]-1)).astype(int),0,source_pixels.shape[0]-1),np.clip((source_uv[:,0]*(source_pixels.shape[1]-1)).astype(int),0,source_pixels.shape[1]-1)]/255
    valid=(mesh.vertices[:,0]>.002)&(vertex_pixels[:,0]>.24)&(vertex_pixels[:,0]>vertex_pixels[:,1]*1.03)
    valid_indices=np.flatnonzero(valid)
    _,nearest=cKDTree(mesh.vertices[valid]).query(samples,workers=2)
    body_rgb=vertex_pixels[valid_indices[nearest]].reshape(1024,512,3)
    # Remove the generated baked shadow bands before using a lit PBR material.
    # Keep the recovered fine skin variation, with the wrist's measured colour
    # as the albedo baseline so front and back respond to runtime lighting.
    wrist=valid & (mesh.vertices[:,2]>.175) & (mesh.vertices[:,2]<.215)
    base=np.median(vertex_pixels[wrist],axis=0)
    luminance=body_rgb @ np.array([.3,.59,.11])
    detail=np.clip(luminance-gaussian_filter(luminance,12),-.06,.06)
    body_rgb=base*(1+detail[...,None]*1.35)
    body_texture=Image.fromarray((np.clip(body_rgb,0,1)*255).astype('uint8'))
    body_material=PBRMaterial(name='Arm_forearm_skin',baseColorTexture=body_texture,metallicFactor=0,roughnessFactor=.62)
    body=trimesh.Trimesh(vertices=body_vertices,faces=body_faces,visual=TextureVisuals(uv=body_uv,material=body_material),process=False)
    smooth_normals(body)
    # Close both ends. The wrist closure is hidden inside the retained hand.
    cap_meshes=[]
    for index,reverse in [(0,True),(rings-1,False)]:
        edge=body_vertices[index*(segments+1):(index+1)*(segments+1)-1]
        c=edge.mean(0); f=[[segments,j,(j+1)%segments] for j in range(segments)]
        if reverse: f=np.fliplr(f)
        end=trimesh.Trimesh(vertices=np.vstack((edge,c)),faces=f,process=False)
        end.visual=TextureVisuals(material=cap_material);cap_meshes.append(end)
    transform = trimesh.transformations.rotation_matrix(-np.pi/2, [1,0,0]) @ trimesh.transformations.translation_matrix(-GRIP)
    scene = trimesh.Scene()
    caps=trimesh.util.concatenate([hand_cap,*cap_meshes]);caps.visual=TextureVisuals(material=cap_material)
    for name, part in [('Arm_skin',hand), ('Arm_forearm_skin',body), ('Arm_closed_cap',caps)]:
        part.apply_transform(transform)
        scene.add_geometry(part, geom_name=name, node_name=name)
    return scene

def polish_arm_albedo(scene):
    """De-light the reconstructed skin and blend the retained wrist albedo.

    This is a material bake on the existing UV-mapped meshes, not inference.
    Low-frequency shadows in a single-view reconstruction otherwise become
    dark painted bands when the game adds its own moving lights.
    """
    hand = scene.geometry['Arm_skin']
    forearm = scene.geometry['Arm_forearm_skin']
    body_pixels = np.asarray(forearm.visual.material.baseColorTexture.convert('RGB')) / 255
    baseline = np.median(body_pixels.reshape(-1, 3), axis=0)
    pixels = np.asarray(hand.visual.material.baseColorTexture.convert('RGB')) / 255
    luminance = pixels @ np.array([.3, .59, .11])
    valid = (luminance > .025).astype(float)
    local_light = gaussian_filter(luminance * valid, 12) / np.maximum(gaussian_filter(valid, 12), .001)
    detail = np.clip(luminance / np.maximum(local_light, .04), .78, 1.22)
    height, width = luminance.shape
    u, v = np.meshgrid(np.linspace(0, 1, width), np.linspace(1, 0, height))
    _, nearest = cKDTree(hand.visual.uv).query(np.stack((u, v), axis=-1).reshape(-1, 2), workers=2)
    wrist_distance = hand.vertices[nearest, 1].reshape(height, width) - hand.bounds[0, 1]
    blend = np.clip(wrist_distance / .022, 0, 1)
    blend = blend * blend * (3 - 2 * blend)
    corrected = baseline * (1 + (detail - 1)[..., None] * blend[..., None])
    hand.visual.material.baseColorTexture = Image.fromarray((np.clip(corrected, 0, 1) * 255).astype('uint8'))
    # Preserve the finer recovered skin variation while suppressing broad
    # nearest-surface patches on the repaired forearm's unseen side.
    body_detail = body_pixels - gaussian_filter(body_pixels, (10, 10, 0))
    forearm.visual.material.baseColorTexture = Image.fromarray((np.clip(baseline + body_detail * .35, 0, 1) * 255).astype('uint8'))
    return scene

def flashlight_atlas(source_path):
    """Bake the retained TripoSR surface onto a cylindrical texture domain.

    The reconstruction supplies color/wear. The reference supplies the straight
    circular profile and the separate rubber, lens, ribs and switch geometry.
    """
    source = trimesh.load_scene(source_path, process=False).to_mesh()
    v = source.vertices - source.vertices.mean(axis=0)
    _, basis = np.linalg.eigh(np.cov(v.T))
    axis = basis[:, -1]
    axial = v @ axis
    radial = np.linalg.norm(v - axial[:, None] * axis, axis=1)
    limits = np.quantile(axial, [.05, .3, .7, .95])
    left = radial[(axial > limits[0]) & (axial < limits[1])].mean()
    right = radial[(axial > limits[2]) & (axial < limits[3])].mean()
    if left < right:
        axis = -axis
    up = np.array([0., 1., 0.]); up -= axis * np.dot(up, axis); up /= np.linalg.norm(up)
    right_axis = np.cross(up, axis)
    canonical = v @ np.column_stack((right_axis, up, axis))
    source_min, source_max = np.quantile(canonical[:, 2], [.005, .995])
    bins = np.linspace(source_min, source_max, 80)
    radii = []
    for z in bins:
        section = canonical[np.abs(canonical[:, 2]-z) < .005]
        radii.append(np.median(np.linalg.norm(section[:, :2], axis=1)) if len(section) else .025)
    width, height = 1024, 1024
    u, vv = np.meshgrid(np.linspace(0,1,width), np.linspace(1,0,height))
    z = source_min + vv * (source_max-source_min)
    radius = np.interp(z, bins, radii)
    points = np.stack((radius*np.cos(u*2*np.pi),radius*np.sin(u*2*np.pi),z),axis=-1)
    _, nearest = cKDTree(canonical).query(points.reshape(-1,3), workers=2)
    uv = source.visual.uv[nearest]
    atlas = np.asarray(source.visual.material.baseColorTexture.convert('RGB'))
    pixels = atlas[np.clip(((1-uv[:,1])*(atlas.shape[0]-1)).round().astype(int),0,atlas.shape[0]-1),
                   np.clip((uv[:,0]*(atlas.shape[1]-1)).round().astype(int),0,atlas.shape[1]-1)].reshape(height,width,3)/255
    # Preserve reconstructed wear while correcting material bleeding and the
    # baked lighting on the originally fused reconstruction.
    luminance = pixels @ np.array([.3,.59,.11])
    wear = np.clip((luminance-.22)/.48,0,1)
    rng = np.random.default_rng(42)
    grain = rng.normal(0,.016,(height,width))
    yellow = np.clip(np.array([.81,.63,.085]) * (.65 + .35*wear[...,None]) + grain[...,None],0,1)
    rubber = np.clip(np.array([.072,.078,.074]) * (.65+.55*wear[...,None]) + grain[...,None]*.18,0,1)
    return Image.fromarray((yellow*255).astype('uint8')), Image.fromarray((rubber*255).astype('uint8'))

def lathe(profile, name, material, segments=96, ribs=False, polygon=None):
    vertices, uv, faces = [], [], []
    for z, radius in profile:
        for j in range(segments+1):
            theta = 2*np.pi*j/segments
            r = radius
            if ribs:
                envelope = np.clip(min((z+.073)/.008,(.066-z)/.008),0,1)
                r += .0016 * max(0,np.cos(theta*14))**4 * envelope
            if polygon:
                r *= np.cos(np.pi/polygon)/np.cos((theta+np.pi/polygon)%(2*np.pi/polygon)-np.pi/polygon)
            vertices.append([r*np.cos(theta),r*np.sin(theta),z])
            uv.append([j/segments,(z+.171)/.257])
    for i in range(len(profile)-1):
        for j in range(segments):
            a=i*(segments+1)+j; b=a+1; c=a+segments+1; d=c+1
            faces.extend([[a,b,c],[b,d,c]])
    mesh=trimesh.Trimesh(vertices=vertices,faces=faces,visual=TextureVisuals(uv=uv,material=material),process=False)
    return smooth_normals(mesh)

def bevel_box(extents, centre, bevel, material):
    x,y,z=np.array(extents)/2
    outline=np.array([[-x+bevel,-z], [x-bevel,-z], [x,-z+bevel], [x,z-bevel], [x-bevel,z], [-x+bevel,z], [-x,z-bevel], [-x,-z+bevel]])
    vertices=[]
    for yy, scale in [(-y,.9),(-y+bevel,1),(y-bevel,1),(y,.9)]:
        vertices.extend([[p[0]*scale,yy,p[1]*scale] for p in outline])
    faces=[]
    for i in range(3):
        for j in range(8):
            a=i*8+j;b=i*8+(j+1)%8;c=a+8;d=b+8
            faces.extend([[a,c,b],[b,c,d]])
    for j in range(1,7):
        faces.extend([[0,j,j+1],[24,24+j+1,24+j]])
    mesh=trimesh.Trimesh(vertices=np.array(vertices)+centre,faces=faces,process=False)
    mesh.visual=TextureVisuals(uv=np.clip((mesh.vertices[:,[0,2]]+[.025,.171])/[.05,.257],0,1),material=material)
    return smooth_normals(mesh)

def guard(x, material):
    # Raised yellow rails protect the black sliding power switch.
    yz=np.array([[.020,-.099],[.038,-.084],[.040,-.059],[.025,-.040],[.019,-.044]])
    vertices=np.array([[xx,y,z] for xx in [x-.002,x+.002] for y,z in yz])
    faces=[]
    for j in range(1,4): faces.extend([[0,j+1,j],[5,5+j,5+j+1]])
    for j in range(5):
        a=j;b=(j+1)%5;faces.extend([[a,b,a+5],[b,b+5,a+5]])
    mesh=trimesh.Trimesh(vertices=vertices,faces=faces,process=False)
    mesh.fix_normals()
    mesh.visual=TextureVisuals(uv=np.column_stack(((vertices[:,0]+.023)/.046,(vertices[:,2]+.171)/.257)),material=material)
    return mesh

def prepare_flashlight(source):
    yellow_texture,rubber_texture=flashlight_atlas(source)
    yellow=PBRMaterial(name='Flashlight_worn_yellow',baseColorTexture=yellow_texture,metallicFactor=.03,roughnessFactor=.65)
    rubber=PBRMaterial(name='Flashlight_rubber',baseColorTexture=rubber_texture,metallicFactor=0,roughnessFactor=.84)
    metal=PBRMaterial(name='Flashlight_reflector',baseColorFactor=[.72,.75,.68,1],metallicFactor=.8,roughnessFactor=.19)
    lens=PBRMaterial(name='Flashlight_glass',baseColorFactor=[.65,.77,.71,.15],metallicFactor=.05,roughnessFactor=.12,alphaMode='BLEND',doubleSided=False)
    emitter=PBRMaterial(name='Flashlight_emitter',baseColorFactor=[.84,.78,.57,1],metallicFactor=0,roughnessFactor=.28,emissiveFactor=[.3,.27,.15])
    scene=trimesh.Scene()
    def add(mesh,name): scene.add_geometry(mesh,node_name=name,geom_name=name)
    body=[(-.126,.032),(-.12,.034),(-.111,.0335),(-.098,.03),(-.084,.0225),(-.077,.0215)]
    body += [(z,.0215) for z in np.linspace(-.073,.066,18)]
    body +=[(.070,.0225),(.073,.0225),(.073,0)]
    add(lathe(body,'housing',yellow,segments=112,ribs=True),'Flashlight_housing_ribs')
    rim=[(-.170,.032),(-.169,.0365),(-.165,.038),(-.128,.038),(-.123,.0355),(-.123,.0295),(-.164,.0295),(-.170,.032)]
    add(lathe(rim,'bezel',rubber,segments=72,polygon=12),'Flashlight_bezel')
    tail=[(.066,.0218),(.069,.024),(.075,.0248),(.087,.0248),(.091,.022),(.092,0)]
    add(lathe(tail,'tail',rubber,segments=72,polygon=12),'Flashlight_tailcap')
    reflector=[(-.165,.030),(-.163,.029),(-.159,.027),(-.154,.024),(-.147,.019),(-.14,.012),(-.138,.006),(-.138,.003)]
    # The reflector faces the lens (negative Z), so reverse its winding.
    bowl=lathe(reflector,'reflector',metal);bowl.invert();add(bowl,'Flashlight_reflector')
    glass=[(-.1668,0),(-.1665,.009),(-.166,.02),(-.165,.030),(-.1645,.030),(-.1655,.02),(-.166,.009),(-.1668,0)]
    add(lathe(glass,'lens',lens),'Flashlight_lens')
    led=trimesh.creation.icosphere(subdivisions=2,radius=.0037);led.apply_scale([1,1,.5]);led.apply_translation([0,0,-.140]);led.visual=TextureVisuals(material=emitter);add(led,'Flashlight_emitter')
    add(bevel_box([.025,.007,.036],[0,.028,-.069],.001,rubber),'Flashlight_switch')
    for i in range(3): add(bevel_box([.016,.002,.0018],[0,.032,-.061+i*.003],.0004,rubber),f'Flashlight_switch_ridge_{i}')
    add(guard(-.017,yellow),'Flashlight_switch_guard_left');add(guard(.017,yellow),'Flashlight_switch_guard_right')
    # One draw per material; preserve the physical components within each mesh.
    merged=trimesh.Scene()
    for material in [yellow,rubber,metal,lens,emitter]:
        parts=[g for g in scene.geometry.values() if g.visual.material is material]
        if not parts: continue
        vertices=[];faces=[];uv=[];offset=0
        for part in parts:
            vertices.append(part.vertices);faces.append(part.faces+offset)
            uv.append(part.visual.uv if part.visual.uv is not None else np.zeros((len(part.vertices),2)))
            offset+=len(part.vertices)
        mesh=trimesh.Trimesh(vertices=np.vstack(vertices),faces=np.vstack(faces),
            visual=TextureVisuals(uv=np.vstack(uv),material=material),process=False)
        smooth_normals(mesh)
        merged.add_geometry(mesh,node_name=material.name,geom_name=material.name)
    return merged

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=CACHE / 'assembled')
    parser.add_argument('--arm-only', action='store_true')
    parser.add_argument('--optimized-arm', type=Path, help='Use a reviewed simplified arm without repeating inference or retopology')
    parser.add_argument('--flashlight', type=Path, help='Reuse an already refined flashlight GLB unchanged')
    parser.add_argument('--arm-source',type=Path,default=ROOT/'public/assets/models/player/arms/flashlight-arms/source/trellis-arm-normalized.glb')
    parser.add_argument('--flashlight-source',type=Path,default=ROOT/'public/assets/models/items/flashlight/source/triposr-flashlight-normalized.glb')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    arm = trimesh.load_scene(args.optimized_arm,process=False) if args.optimized_arm else prepare_arm(args.arm_source)
    polish_arm_albedo(arm)
    arm.export(args.output/'right_arm.glb')
    print(json.dumps({'arm_triangles':sum(len(g.faces) for g in arm.geometry.values()), 'arm_bounds':arm.bounds.tolist()}, indent=2))
    if not args.arm_only:
        flashlight=trimesh.load_scene(args.flashlight,process=False) if args.flashlight else prepare_flashlight(args.flashlight_source)
        flashlight.export(args.output/'flashlight.glb')
        combined=arm.copy()
        for name,mesh in flashlight.geometry.items(): combined.add_geometry(mesh,geom_name=name,node_name=name)
        combined.graph.update(frame_to='Flashlight_beam_socket',matrix=trimesh.transformations.translation_matrix([0,0,-.171]))
        combined.export(args.output/'flashlight_arms.glb')
        print(json.dumps({'total_triangles':sum(len(g.faces) for g in combined.geometry.values()), 'bounds':combined.bounds.tolist()},indent=2))

if __name__ == '__main__':
    main()
