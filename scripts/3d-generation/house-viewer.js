import {createNavigation} from './house-navigation.mjs?v=2';
const $=id=>document.getElementById(id),B=window.BABYLON;
let scene,engine,walkCamera,overviewCamera,data,nav,paths,meshes=[],fixtures=[],flashlight,sky,rat;
let position={x:0,y:0,z:-.55,level:0},yaw=-Math.PI/2,pitch=0,walking=false,overview=false,tour=null,last=0,elapsed=0,roomId='F01',frameTick=0;
const keys=new Set(),errors=[],samples=[],v=(x,y,z)=>new B.Vector3(x,y,z);
let soundEnabled=false,audio=null,audioMaster,wind,localTone,localGain,nextSound=12;
const soundZones={F01:['wood','Wood settles near the entrance.'],F02:['piano','A faint piano note resonates.'],F03:['wood','A stair tread creaks.'],F04:['flies','A fly circles the abandoned meal.'],F05:['water','Water drips into the sink.'],F06:['static','The CRT murmurs with static.'],F07:['water','A slow drip echoes beyond the books.'],F08:['glass','Glass softly rattles inside the cabinet.'],F09:['metal','The car body ticks as the room cools.'],U00:['wood','Timber creaks along the hallway.'],U01:['paper','Paper rustles by the old computer.'],U02:['paper','A loose page brushes the desk.'],U03:['wood','A quiet knock inside the wardrobe.'],U04:['fabric','Old fabric brushes against wood.'],U05:['water','A tap drips into the cracked basin.'],U06:['fabric','Hanging clothes rustle in the wardrobe.'],U07:['metal','A loose railing fitting taps in the wind.']};
function soundEvent(){
 if(!audio||audio.state!=='running')return;
 const [type,cue]=soundZones[roomId]??soundZones.F01,t=audio.currentTime;
 const gain=audio.createGain();gain.connect(audioMaster);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.1,t+.04);gain.gain.exponentialRampToValueAtTime(.0001,t+1.8);
 if(['static','flies','paper','fabric','wood'].includes(type)){
  const source=audio.createBufferSource(),buffer=audio.createBuffer(1,audio.sampleRate*2,audio.sampleRate),a=buffer.getChannelData(0);
  for(let i=0;i<a.length;i++)a[i]=(Math.random()*2-1)*(.35+.3*Math.sin(i*.002));source.buffer=buffer;
  const filter=audio.createBiquadFilter();filter.type='bandpass';filter.frequency.value={static:1400,flies:220,paper:2400,fabric:680,wood:110}[type];filter.Q.value=type==='wood'?15:2;
  source.connect(filter);filter.connect(gain);source.start(t);source.stop(t+2);
 }else{
  const base={piano:130.81,water:880,glass:1661,metal:277}[type];
  for(const multiplier of [1,2.01,3.97]){
   const osc=audio.createOscillator(),g=audio.createGain();osc.frequency.setValueAtTime(base*multiplier,t);if(type==='water')osc.frequency.exponentialRampToValueAtTime(base*multiplier*.48,t+.16);
   g.gain.value=.26/multiplier;osc.connect(g);g.connect(gain);osc.start(t);osc.stop(t+1.9);
  }
 }
 $('sound-cue').textContent=cue;
}
window.addEventListener('error',e=>errors.push(e.message));
window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
function status(text){$('status').textContent=text;}
function audioSetup(){
 if(audio)return;
 audio=new AudioContext();audioMaster=audio.createGain();audioMaster.gain.value=+$('volume').value;audioMaster.connect(audio.destination);
 const buffer=audio.createBuffer(1,audio.sampleRate*4,audio.sampleRate),arr=buffer.getChannelData(0);
 let previous=0;for(let i=0;i<arr.length;i++){previous=(previous+(Math.random()*2-1)*.015)/1.015;arr[i]=previous;}
 const source=audio.createBufferSource();source.buffer=buffer;source.loop=true;
 const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=330;
 wind=audio.createGain();wind.gain.value=.38;source.connect(filter);filter.connect(wind);wind.connect(audioMaster);source.start();
 localTone=audio.createOscillator();localTone.type='sine';localTone.frequency.value=92;
 localGain=audio.createGain();localGain.gain.value=.02;localTone.connect(localGain);localGain.connect(audioMaster);localTone.start();
}
function syncAudio(){if(!audio)return;if(soundEnabled&&(walking||tour)&&!document.hidden)audio.resume();else audio.suspend();}
function updateAudio(){if(!audio||!soundEnabled)return;
 const f={F01:58,F02:130.8,F03:72,F04:182,F05:108,F06:58,F07:260,F08:196,F09:49,U00:61.7,U01:98,U02:146.8,U03:82.4,U04:110,U05:245,U06:174.6,U07:64}[roomId]??80;
 localTone.frequency.setTargetAtTime(f,audio.currentTime,.6);
 const pulse=Math.pow(Math.max(0,Math.sin(elapsed*.17+f)),12);
 localGain.gain.setTargetAtTime(.002+pulse*.035,audio.currentTime,.2);
 wind.gain.setTargetAtTime(roomId==='U07'?.85:.25,audio.currentTime,.5);
 if((walking||tour)&&elapsed>nextSound){soundEvent();nextSound=elapsed+16+Math.random()*22;}
}
function location(){
 if(position.y>.05&&position.y<data.floorRise-.05)return data.rooms.find(r=>r.id==='F03');
 const layer=position.y>2.9?1:0;
 return data.rooms.find(r=>r.floor===layer&&r.id!=='F03'&&r.rects.some(([a,b,c,d])=>position.x>=a&&position.x<=b&&position.z>=c&&position.z<=d))??{id:'OUT',name:'Exterior service recess',floor:layer};
}
function setPosition(p){const q=nav.point(p.x,p.z,p.floor??p.level);if(!q)throw Error('Selected inspection position is blocked');position=q;}
function lookAt(x,z){yaw=Math.atan2(x-position.x,-(z-position.z));pitch=-.02;}
function pause(){walking=false;tour=null;keys.clear();$('enter').textContent='Explore';$('tour').textContent='Guided walkthrough';syncAudio();}
function updateCamera(){
 walkCamera.position.set(position.x,position.y+data.eyeHeight,position.z);
 const dir=v(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
 walkCamera.setTarget(walkCamera.position.add(dir));
 flashlight.position.copyFrom(walkCamera.position);flashlight.direction.copyFrom(dir);
}
function setOverview(value){
 overview=value;scene.activeCamera=value?overviewCamera:walkCamera;
 if(value){pause();overviewCamera.attachControl($('scene'),true);$('overview').textContent='Return to first person';}
 else{overviewCamera.detachControl();$('overview').textContent='Cutaway overview';}
 updateVisibility();
}
function updateVisibility(){
 const upper=position.y>2.0,nearStairs=position.x>-1.4&&position.x<3.7&&position.z>-8;
 for(const m of meshes){
  const name=m.name,roof=name.startsWith('roof'),ceiling=name.includes('ceiling');
  const isUp=name.startsWith('U'),isDown=name.startsWith('F');
  const visible=overview?!roof&&!ceiling:!roof&&(!isUp||upper||nearStairs)&&(!isDown||!upper||nearStairs||name.startsWith('F03')||ceiling);
  m.setEnabled(visible);
 }
}
function updateLighting(){
 const brightness=+$('brightness').value;
 sky.intensity=(overview?.9:.30)*brightness;
 flashlight.intensity=$('flashlight').checked&&!overview?2.1*brightness:0;
 const currentFloor=position.y>2.0?1:0;
 const eligible=fixtures.filter(f=>(f.room.startsWith('U')?1:0)===currentFloor||f.room==='F03').map(f=>({f,d:Math.hypot(f.x-position.x,f.y-position.y-1.4,f.z-position.z)+(f.room===roomId?-3:0)})).sort((a,b)=>a.d-b.d);
 const selected=new Set(eligible.slice(0,6).map(x=>x.f));
 for(const f of fixtures){
  const active=!overview&&selected.has(f);f.light.setEnabled(active);
  if(active){const wave=(!$('flicker').checked&&f.electric)? .86+.10*Math.sin(elapsed*2*Math.PI/f.period+f.phase)+.04*Math.sin(elapsed*.57+f.phase*1.8):1;f.light.intensity=f.power*wave*brightness;}
 }
}
function drawPlan(){
 if($('map-panel').hidden)return;const c=$('map'),ctx=c.getContext('2d'),layer=position.y>2.7?1:0;
 ctx.clearRect(0,0,c.width,c.height);ctx.save();ctx.translate(24,44);const s=26;
 const X=x=>(x+7.6)*s,Z=z=>(z+22)*s;
 ctx.strokeStyle='#c5b98e';ctx.lineWidth=2;ctx.font='20px Georgia';ctx.textAlign='center';
 for(const room of data.rooms.filter(r=>r.floor===layer))for(const [a,b,d,e] of room.rects){
  ctx.fillStyle=room.id===roomId?'#525c3b':'#263228';ctx.fillRect(X(a),Z(d),(b-a)*s,(e-d)*s);ctx.strokeRect(X(a),Z(d),(b-a)*s,(e-d)*s);ctx.fillStyle='#c6c3ab';ctx.fillText(room.id,X((a+b)/2),Z((d+e)/2)+6);
 }
 for(const door of data.doors.filter(d=>d.floor===layer)){
  const [x,,z]=door.position;ctx.strokeStyle='#a1ba94';ctx.lineWidth=7;ctx.beginPath();
  if(door.axis==='x'){ctx.moveTo(X(x-door.width/2),Z(z));ctx.lineTo(X(x+door.width/2),Z(z));}else{ctx.moveTo(X(x),Z(z-door.width/2));ctx.lineTo(X(x),Z(z+door.width/2));}ctx.stroke();
 }
 ctx.fillStyle='#f7df97';ctx.beginPath();ctx.arc(X(position.x),Z(position.z),6,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#f7df97';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(X(position.x),Z(position.z));ctx.lineTo(X(position.x)+Math.sin(yaw)*20,Z(position.z)-Math.cos(yaw)*20);ctx.stroke();ctx.restore();$('map-floor').textContent=layer?'· Upper':'· Ground';
}
function report(){
 const value={renderer:B.Engine.Version,phase:data.phase,loaded:true,room:roomId,position:{x:+position.x.toFixed(3),y:+position.y.toFixed(3),z:+position.z.toFixed(3)},meshes:meshes.length,triangles:meshes.reduce((n,m)=>n+m.getTotalIndices()/3,0),activeLocalLights:fixtures.filter(f=>f.light.isEnabled()).length,upstairsHallFixtures:data.lights.filter(l=>l.room==='U00').map(l=>l.id),diningChairs:data.props.filter(p=>p.kind==='dining-chair').length,averageFps:samples.length?+(samples.reduce((a,b)=>a+b,0)/samples.length).toFixed(1):null,textureProblems:scene.textures.filter(t=>!t.isReady()).map(t=>t.name),audio:{enabled:soundEnabled,state:audio?.state??'not-started'},tour:tour?{leg:tour.leg+1,total:paths.length,destination:paths[tour.leg]?.to}:completedTour,errors};
 $('review').textContent=JSON.stringify(value,null,2);
}
let completedTour=null;
function tick(){
 const now=performance.now();const dt=Math.min((now-last)/1000,.05)||.016;last=now;
 if(!document.hidden){elapsed+=dt;
  if(tour){
   const leg=paths[tour.leg],point=leg.points[tour.index];
   if(!point){
    tour.visited.push(leg.to);tour.leg++;tour.index=0;tour.rest=.35;
    if(tour.leg>=paths.length){
     completedTour={completed:true,continuous:true,visited:tour.visited,collisions:tour.blocked,metres:paths.reduce((n,l)=>n+l.metres,0)};
     pause();$('tour-progress').style.width='100%';status('Walkthrough complete · both floors, terrace loop and escape approach traversed.');
    }
   }else if(tour.rest>0){tour.rest-=dt;}
   else{
    const dx=point.x-position.x,dz=point.z-position.z,distance=Math.hypot(dx,dz),step=+$('speed').value*dt;
    if(distance<.018){tour.index++;}
    else{
     const before=position;position=nav.move(position,dx/distance*Math.min(distance,step),dz/distance*Math.min(distance,step),false);
     if(Math.hypot(position.x-before.x,position.z-before.z)<.0001){tour.blocked++;if(tour.blocked>8){errors.push('Guided route blocked at '+leg.to);pause();status('Route blocked. Review validation report.');}}
     const targetYaw=Math.atan2(dx,-dz),delta=Math.atan2(Math.sin(targetYaw-yaw),Math.cos(targetYaw-yaw));yaw+=delta*Math.min(1,dt*7);pitch=-.045;
    }
   }
   if(tour){$('tour-progress').style.width=(tour.leg/paths.length*100)+'%';status(`Walkthrough ${tour.leg+1}/${paths.length} · ${paths[tour.leg].to}`);}
  }else if(walking&&!overview){
   let fw=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);
   let side=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);
   if(keys.has('ArrowLeft'))yaw-=dt*1.35;if(keys.has('ArrowRight'))yaw+=dt*1.35;
   const speed=keys.has('ShiftLeft')?2.4:1.6,norm=Math.hypot(fw,side)||1;
   position=nav.move(position,(Math.sin(yaw)*fw+Math.cos(yaw)*side)*speed*dt/norm,(-Math.cos(yaw)*fw+Math.sin(yaw)*side)*speed*dt/norm);
  }
  updateCamera();
  // One rare, decorative vermin crossing. No AI, triggers, combat or collision.
  if(rat){const phase=elapsed%78,visible=position.y>3&&phase>34&&phase<36.4&&!overview;rat.setEnabled(visible);if(visible)rat.position.set(-1.17+(phase-34)*.97,data.floorRise+.058,-12.7);}
  if(frameTick++%12===0){
   const r=location();roomId=r.id;$('location').textContent=r.name;$('floor-label').textContent=(r.floor?'UPPER FLOOR':'GROUND FLOOR')+' / '+r.id;
   updateLighting();updateVisibility();drawPlan();updateAudio();report();
   if(engine.getFps()>0){samples.push(engine.getFps());if(samples.length>90)samples.shift();}
  }
 }
 scene.render();
}
async function init(){
 if(!B)throw Error('Babylon.js did not load. Serve this directory with the bundled vendor files.');
 engine=new B.Engine($('scene'),true,{preserveDrawingBuffer:true,stencil:true,powerPreference:'high-performance'});engine.setHardwareScalingLevel(Math.max(1,devicePixelRatio/1.5));
 scene=new B.Scene(engine);scene.useRightHandedSystem=true;scene.clearColor=new B.Color4(.019,.029,.025,1);
 scene.ambientColor=new B.Color3(.05,.06,.05);scene.fogMode=B.Scene.FOGMODE_EXP2;scene.fogDensity=.013;scene.fogColor=new B.Color3(.022,.034,.029);
 const responses=await Promise.all([fetch('house-manifest.json'),fetch('walkthrough-paths.json')]);
 if(responses.some(r=>!r.ok))throw Error('Missing manifest or validated walkthrough paths. Run the generation and validation commands in README.');
 [data,paths]=await Promise.all(responses.map(r=>r.json()));nav=createNavigation(data);
 walkCamera=new B.FreeCamera('inspection-camera',v(0,1.65,-.55),scene);walkCamera.minZ=.055;walkCamera.maxZ=85;walkCamera.fov=1.16;
 overviewCamera=new B.ArcRotateCamera('overview',-Math.PI/2.8,.58,33,v(.5,2,-10),scene);overviewCamera.minZ=.1;overviewCamera.wheelPrecision=14;
 scene.activeCamera=walkCamera;sky=new B.HemisphericLight('ambient',v(.1,1,.2),scene);sky.groundColor=new B.Color3(.21,.25,.23);
 flashlight=new B.SpotLight('inspection-flashlight',walkCamera.position,v(0,0,-1),1.18,20,scene);flashlight.diffuse=new B.Color3(.94,.90,.72);flashlight.range=12;
 const imported=await B.SceneLoader.ImportMeshAsync(null,'./','haunted-house.glb',scene);meshes=imported.meshes.filter(m=>m.getTotalVertices()>0);
 // Standard shading keeps the portable PBR GLB inexpensive on browser hardware.
 // The underlying asset retains PBR materials for later engine integration.
 const converted=new Map();
 for(const mesh of meshes){
  const original=mesh.material;if(!converted.has(original)){
   const m=new B.StandardMaterial(original.name+'-preview',scene);m.diffuseColor=original.albedoColor?.clone()??B.Color3.White();m.diffuseTexture=original.albedoTexture;m.specularColor=new B.Color3(.07,.065,.05);m.specularPower=24;m.maxSimultaneousLights=8;
   m.emissiveColor=original.emissiveColor?.clone()??B.Color3.Black();
   if(original.name==='window')m.emissiveColor=new B.Color3(.13,.18,.17);
   if(original.name==='stain'){m.useAlphaFromDiffuseTexture=true;m.diffuseTexture.hasAlpha=true;m.backFaceCulling=false;m.disableLighting=true;}
   if(original.name==='cabinet-glass'){m.alpha=.13;m.backFaceCulling=false;m.specularColor=new B.Color3(.35,.38,.33);}
   converted.set(original,m);
  }mesh.material=converted.get(original);mesh.isPickable=false;mesh.freezeWorldMatrix();
 }
 for(const [old] of converted)old.dispose(false,false);
 for(const def of data.lights){
  const [x,y,z]=def.position,l=new B.PointLight(def.id,v(x,y,z),scene);l.diffuse=B.Color3.FromArray(def.color);l.range=def.range;l.radius=.3;
  l.includedOnlyMeshes=meshes.filter(m=>m.name.startsWith(def.room)||(def.room==='U00'&&m.name.startsWith('F03'))||m.name==='F00-ceiling__plaster');
  fixtures.push({...def,x,y,z,power:def.intensity,light:l});
 }
 // Window spill is daylight, with no additional electric hallway fixtures.
 for(const [i,w] of data.windows.entries()){
  const [x,y,z]=w.position,l=new B.PointLight('window-spill-'+i,v(x,y+w.height*.6,z),scene);l.diffuse=new B.Color3(.44,.59,.63);l.range=4.5;
  l.includedOnlyMeshes=meshes.filter(m=>m.name.startsWith(w.room));fixtures.push({room:w.room,x,y:y+w.height*.6,z,power:.65,range:4.5,phase:i,period:18,light:l});
 }
 // One modest flashlight shadow map; room lights never allocate shadow maps.
 const shadow=new B.ShadowGenerator(512,flashlight);shadow.usePercentageCloserFiltering=true;shadow.filteringQuality=B.ShadowGenerator.QUALITY_LOW;shadow.bias=.003;shadow.normalBias=.025;
 for(const m of meshes){m.receiveShadows=true;if(!m.name.includes('floor')&&!m.name.includes('ceiling')&&!m.name.includes('stain')&&!m.name.startsWith('roof'))shadow.addShadowCaster(m);}
 await scene.whenReadyAsync();
 rat=new B.TransformNode('ambient-rat',scene);
 const ratMat=new B.StandardMaterial('rat-fur',scene);ratMat.diffuseColor=new B.Color3(.16,.145,.12);ratMat.specularColor=B.Color3.Black();
 const ratBody=B.MeshBuilder.CreateSphere('rat-body',{diameter:1,segments:6},scene);ratBody.scaling.set(.24,.095,.10);ratBody.material=ratMat;ratBody.parent=rat;
 const ratHead=B.MeshBuilder.CreateSphere('rat-head',{diameter:1,segments:6},scene);ratHead.scaling.set(.09,.075,.075);ratHead.position.x=.12;ratHead.material=ratMat;ratHead.parent=rat;
 const ratTail=B.MeshBuilder.CreateTube('rat-tail',{path:[v(-.1,0,0),v(-.22,-.02,.03),v(-.3,-.018,.01)],radius:.006,tessellation:5},scene);ratTail.material=ratMat;ratTail.parent=rat;rat.setEnabled(false);
 for(const r of data.rooms){
  const option=document.createElement('option');option.value=r.id;option.textContent=r.id+' · '+r.name;$('room').append(option);
 }
 $('load').hidden=true;for(const id of ['enter','tour','room'])$(id).disabled=false;
 lookAt(6,-1.0);updateCamera();updateVisibility();updateLighting();status('Explore the house, or take the continuous guided walkthrough.');
 engine.runRenderLoop(tick);window.addEventListener('resize',()=>engine.resize());
}
$('enter').onclick=()=>{if(overview)setOverview(false);if(walking||tour){pause();status('Paused. Explore to continue.');return;}walking=true;$('enter').textContent='Pause';$('scene').focus();syncAudio();status('Drag to look · WASD to walk · F toggles the flashlight.');};
$('tour').onclick=()=>{if(tour){pause();status('Walkthrough paused.');return;}if(overview)setOverview(false);setPosition(data.tour[0]);completedTour=null;tour={leg:0,index:0,rest:.3,blocked:0,visited:[data.tour[0].name]};walking=false;$('tour').textContent='Stop walkthrough';$('enter').textContent='Pause';syncAudio();};
$('room').onchange=e=>{
 if(!e.target.value)return;pause();if(overview)setOverview(false);
 const target={F01:'Front entrance',F02:'Living room',F03:'Stair foot',F04:'Dining room',F05:'Kitchen',F06:'TV room',F07:'Book passage',F08:'Escape-exit area',F09:'Garage entrance',U00:'Upper landing',U01:'Master 1 sleeping area',U02:'Study',U03:'Guest bedroom',U04:'Twin bedroom',U05:'Shared upstairs CR',U06:'Master bedroom 2',U07:'Terrace'}[e.target.value];
 setPosition(data.tour.find(t=>t.name===target));
 const aim={F01:[6,-1],F02:[6.3,-5],F03:[2.4,-1.6],F04:[5.5,-18.5],F05:[-4.7,-20.6],F06:[-4.7,-10.7],F07:[3.8,-7.8],F08:[1,-13.5],F09:[-4.65,-3.2],U00:[0,-8],U01:[6.6,-6.7],U02:[-4.6,-5.8],U03:[6,-13.3],U04:[-4.6,-13],U05:[-4,-18],U06:[5.6,-20],U07:[-3.8,1.3]}[e.target.value];
 lookAt(...aim);status('Inspection position · Explore to walk from here.');
};
$('settings-toggle').onclick=()=>{$('settings').hidden=!$('settings').hidden;};$('map-toggle').onclick=()=>{$('map-panel').hidden=!$('map-panel').hidden;drawPlan();};
$('overview').onclick=()=>setOverview(!overview);$('report-toggle').onclick=()=>{$('review').hidden=!$('review').hidden;report();};
$('sound').onclick=()=>{soundEnabled=!soundEnabled;if(soundEnabled)audioSetup();$('sound').textContent=soundEnabled?'Sound on':'Sound off';syncAudio();};
$('volume').oninput=()=>{if(audioMaster)audioMaster.gain.setTargetAtTime(+$('volume').value,audio.currentTime,.15);};
document.addEventListener('visibilitychange',()=>{keys.clear();last=performance.now();syncAudio();});
window.addEventListener('blur',()=>keys.clear());
window.addEventListener('keydown',e=>{if(/INPUT|SELECT/.test(e.target.tagName))return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==='KeyF')$('flashlight').checked=!$('flashlight').checked;if(e.code==='Escape'){pause();status('Paused.');}});
window.addEventListener('keyup',e=>keys.delete(e.code));
let dragging=false,previous=null;
$('scene').addEventListener('pointerdown',e=>{if(overview)return;dragging=true;previous=[e.clientX,e.clientY];$('scene').setPointerCapture(e.pointerId);});
$('scene').addEventListener('pointerup',()=>{dragging=false;previous=null;});
$('scene').addEventListener('pointermove',e=>{if(!dragging||overview||tour)return;yaw+=(e.clientX-previous[0])*.004;pitch=Math.max(-1.15,Math.min(1.15,pitch-(e.clientY-previous[1])*.004));previous=[e.clientX,e.clientY];});
for(const b of document.querySelectorAll('[data-move]')){
 const key={left:'KeyA',right:'KeyD',forward:'KeyW',back:'KeyS'}[b.dataset.move];b.onpointerdown=e=>{walking=true;keys.add(key);b.setPointerCapture(e.pointerId);};b.onpointerup=()=>keys.delete(key);b.onpointercancel=()=>keys.delete(key);
}
init().catch(error=>{errors.push(error.message);$('load-text').textContent=error.message;status('Environment load failed. See the message above.');console.error(error);});
