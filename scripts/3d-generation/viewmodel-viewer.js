/* Local inspection of source and final viewmodels. No gameplay state is changed. */
const B = BABYLON, canvas = document.querySelector('canvas');
const engine = new B.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
const folder = '/public/assets/models/player/arms/flashlight-arms/';
const paths = {
  combined: folder + 'flashlight_arms.glb',
  flashlight: '/public/assets/models/items/flashlight/flashlight.glb',
  arm: folder + 'right_arm.glb',
  'source-flashlight': '/public/assets/models/items/flashlight/source/trellis-rejected.glb',
  'source-arm': folder + 'source/trellis-arm-normalized.glb',
  triposr: '/public/assets/models/items/flashlight/source/triposr-flashlight-normalized.glb',
  assembly: '/.cache/3d-generation/flashlight-refinement/assembled/flashlight_arms.glb',
  'posed-arm': '/.cache/3d-generation/flashlight-refinement/assembled/right_arm.glb',
  old: folder + 'source/previous-20261003/flashlight_arms.glb',
};
let scene, camera, meshes = [], centre, extent, root, materials, current, clay = false, wire = false;
const requested = new URLSearchParams(location.search).get('asset') || 'combined';
document.querySelector('#asset').value = requested;
function view(mode) {
  if (!camera || !centre) return;
  root.position.setAll(0); root.rotation.setAll(0); root.scaling.setAll(1);
  camera.target.copyFrom(centre); camera.radius = extent * 1.85;
  camera.fov = .72; camera.beta = Math.PI / 2; camera.alpha = -Math.PI / 2;
  if (mode === 'back') camera.alpha = Math.PI / 2;
  if (mode === 'left') camera.alpha = Math.PI;
  if (mode === 'right') camera.alpha = 0;
  if (mode === 'top') { camera.alpha = Math.PI / 2; camera.beta = .01; }
  if (mode === 'quarter') { camera.alpha = -Math.PI / 3; camera.beta = Math.PI / 2.6; }
  if (mode === 'player') {
    root.position.set(.20*Math.min(1,engine.getAspectRatio(camera)/1.3), -.20, -.42); root.rotation.set(0,.14,0); root.scaling.setAll(1);
    camera.fov = 1.16; camera.target.set(0, 0, -1); camera.setPosition(B.Vector3.Zero());
  }
}
async function load(key) {
  current = key; centre = null; clay = false; wire = false;
  if (scene) scene.dispose();
  document.querySelector('#status').textContent = 'Loading ' + key;
  scene = new B.Scene(engine); scene.useRightHandedSystem = true;
  scene.clearColor = new B.Color4(.115,.135,.16,1);
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
  const sky = new B.HemisphericLight('studio-sky', new B.Vector3(0,1,0), scene);
  sky.intensity = .9; sky.groundColor.set(.3,.34,.4);
  const light = new B.DirectionalLight('studio-key', new B.Vector3(-.6,-1,.5), scene); light.intensity = 2.1;
  const fill = new B.DirectionalLight('studio-fill', new B.Vector3(.6,-.3,-.8), scene); fill.intensity = 1;
  camera = new B.ArcRotateCamera('orbit', -Math.PI/3, 1.1, 1, B.Vector3.Zero(), scene);
  camera.minZ = .001; camera.wheelPrecision = 350; camera.attachControl(canvas,true);
  root = new B.TransformNode('inspection-root',scene);
  try {
    const path = paths[key], slash = path.lastIndexOf('/');
    const result = await B.SceneLoader.ImportMeshAsync(null, path.slice(0,slash+1), path.slice(slash+1) + '?v=' + Date.now(), scene);
    for (const m of result.meshes) if (!m.parent) m.parent = root;
    meshes = result.meshes.filter(m=>m.getTotalVertices());
    materials = meshes.map(m=>m.material);
    await scene.whenReadyAsync();
    let min = new B.Vector3(Infinity,Infinity,Infinity), max = min.negate();
    for (const m of meshes) {
      const transform=m.computeWorldMatrix(true), positions=m.getVerticesData('position');
      for (let i=0;i<positions.length;i+=3) { const p=B.Vector3.TransformCoordinates(B.Vector3.FromArray(positions,i),transform); min=B.Vector3.Minimize(min,p); max=B.Vector3.Maximize(max,p); }
    }
    centre = min.add(max).scale(.5); extent = Math.max(...max.subtract(min).asArray());
    const report = { loaded: true, asset:key, babylonVersion:B.Engine.Version, meshCount:meshes.length, triangles:meshes.reduce((sum,m)=>sum+m.getTotalIndices()/3,0), vertices:meshes.reduce((sum,m)=>sum+m.getTotalVertices(),0), min:min.asArray(), max:max.asArray(), textures:scene.textures.map(t=>({name:t.name,ready:t.isReady()})), skeletons:result.skeletons.length, animations:result.animationGroups.length };
    document.querySelector('#report').textContent = JSON.stringify(report,null,2);
    document.querySelector('#status').textContent = `${key} · ${report.triangles.toLocaleString()} triangles · ${(extent*100).toFixed(1)} cm · textures ready: ${report.textures.every(t=>t.ready)}`;
    view('quarter');
    scene.onPointerObservable.add(event=>{if(event.type===B.PointerEventTypes.POINTERPICK && event.pickInfo?.hit) document.querySelector('#picked').textContent=event.pickInfo.pickedMesh.name+': '+event.pickInfo.pickedPoint.asArray().map(x=>x.toFixed(5)).join(', ');});
  } catch(e) { document.querySelector('#status').textContent='LOAD FAILED: '+e.message; }
}
document.querySelector('#asset').onchange=e=>load(e.target.value);
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));
document.querySelector('#clay').onclick=()=>{clay=!clay;const mat=scene.getMaterialByName('clay')||new B.StandardMaterial('clay',scene);mat.diffuseColor.set(.62,.67,.72);mat.specularColor.set(.12,.12,.12);meshes.forEach((m,i)=>m.material=clay?mat:materials[i]);};
document.querySelector('#wire').onclick=()=>{wire=!wire;meshes.forEach(m=>m.material.wireframe=wire);};
document.querySelector('#save').onclick=()=>{scene.render();const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download=current+'-preview.png';a.click();};
window.addEventListener('resize',()=>engine.resize());engine.runRenderLoop(()=>{if(scene)scene.render();});load(requested);
