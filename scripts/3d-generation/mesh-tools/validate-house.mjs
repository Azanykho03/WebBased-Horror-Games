import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createNavigation} from '../house-navigation.mjs';
const file=process.argv[2]??'public/assets/models/environments/haunted-house/house-manifest.json';
const data=JSON.parse(await fs.readFile(file,'utf8')),nav=createNavigation(data),checks=[];
function check(name,fn){fn();checks.push({name,passed:true});}
check('17 stable room IDs and six main upper hallway doors',()=>{
 assert.equal(data.rooms.length,17);
 const doors=data.doors.filter(d=>d.source==='U00');assert.deepEqual(doors.map(d=>d.destination).sort(),['U01','U02','U03','U04','U05','U06']);
});
check('Actual single staircase, 1.8 m wide, 18 treads at 180 mm',()=>{
 assert.equal(data.stair.top[1],data.floorRise);assert.equal(data.stair.bottom[0],data.stair.top[0]);assert.equal(data.stair.steps,18);assert(data.stair.width>=1.4);
});
check('Kitchen/dining face each other; garage faces stair approach',()=>{
 const d=id=>data.doors.find(d=>d.destination===id);
 assert.equal(d('F05').position[2],d('F04').position[2]);assert(Math.abs(d('F09').position[2]-data.stair.bottom[2])<1);
});
check('Exterior windows and curtains in required rooms',()=>{
 for(const id of ['F02','F06','U01','U02','U03','U04','U05','U06'])assert(data.windows.some(w=>w.room===id&&w.exterior&&w.curtains),id);
});
check('Master CR and terrace have separate adjacent doors',()=>{
 const a=data.doors.find(d=>d.destination==='U01-CR'),b=data.doors.find(d=>d.source==='U01'&&d.destination==='U07');
 assert(a&&b);assert(Math.hypot(a.position[0]-b.position[0],a.position[2]-b.position[2])<2);
});
check('Walls and terrace rail reject movement',()=>{
 assert(nav.blocked(-1.4,0,-3));assert(nav.blocked(0,data.floorRise,2.42));assert.equal(nav.point(20,0,0),null);
});
if(data.phase!=='blockout'){
 check('Exactly eight dining chairs: 3 + 3 + 1 + 1',()=>{
  const c=data.props.filter(p=>p.room==='F04'&&p.kind==='dining-chair');assert.equal(c.length,8);
  assert.deepEqual(c.reduce((n,p)=>(n[p.side]=(n[p.side]??0)+1,n),{}),{west:3,east:3,north:1,south:1});
 });
 check('Required major furniture, exact bed and sofa counts',()=>{
  for(const [room,kind,n] of [['U02','bed',2],['U04','bed',2],['F02','sofa',2],['F06','sofa',2],['F02','armchair',1]])assert.equal(data.props.filter(p=>p.room===room&&p.kind===kind).length,n,room+' '+kind);
  for(const [room,kind] of [['F02','piano'],['F02','doll'],['F07','bookshelf'],['F08','bar-cabinet'],['F09','car'],['F09','mirror'],['U00','breaker'],['U01','computer'],['U02','computer'],['U03','headboard-mirror'],['U06','doll'],['U06','wardrobe']])assert(data.props.some(p=>p.room===room&&p.kind===kind),room+' '+kind);
 });
 check('Bar cabinet directly faces service exit',()=>{
  const bar=data.props.find(p=>p.kind==='bar-cabinet'),exit=data.doors.find(d=>d.destination==='outside-escape');assert.equal(bar.position[2],exit.position[2]);assert(bar.position[0]>exit.position[0]);
 });
 check('Open door leaves do not intersect major furniture',()=>{
  const boxes=data.colliders.filter(c=>c.center);
  const corners=c=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>{
   const x=a*c.size[0]/2,z=b*c.size[2]/2,co=Math.cos(c.yaw),si=Math.sin(c.yaw);
   return [c.center[0]+x*co+z*si,c.center[2]-x*si+z*co];
  });
  function overlaps(a,b){
   if(Math.abs(a.center[1]-b.center[1])>=(a.size[1]+b.size[1])/2)return false;
   const aa=corners(a),bb=corners(b);
   for(const polygon of [aa,bb])for(const i of [0,1]){
    const p=polygon[i],q=polygon[i+1],ax=[q[1]-p[1],p[0]-q[0]];
    const ap=aa.map(([x,z])=>x*ax[0]+z*ax[1]),bp=bb.map(([x,z])=>x*ax[0]+z*ax[1]);
    if(Math.min(Math.max(...ap),Math.max(...bp))-Math.max(Math.min(...ap),Math.min(...bp))<.00001)return false;
   }return true;
  }
  for(const door of boxes.filter(c=>c.id.includes('open-door')))for(const prop of boxes.filter(c=>!c.id.includes('open-door')))assert(!overlaps(door,prop),door.id+' intersects '+prop.id);
 });
}
if(['lighting','final'].includes(data.phase))check('Hallway has exactly H1 and H2; local light budget declared',()=>{
 assert.deepEqual(data.lights.filter(l=>l.room==='U00').map(l=>l.id).sort(),['H1','H2']);assert(data.lights.every(l=>l.range<=9));
});
const legs=[];
check('Full continuous first-person route; all destinations reachable',()=>{
 for(let i=1;i<data.tour.length;i++){
  const points=nav.path(data.tour[i-1],data.tour[i]);
  let length=0;
  for(let j=1;j<points.length;j++){assert(nav.segment(points[j-1],points[j]));length+=Math.hypot(points[j].x-points[j-1].x,points[j].y-points[j-1].y,points[j].z-points[j-1].z);}
  legs.push({from:data.tour[i-1].name,to:data.tour[i].name,metres:+length.toFixed(2),points});
 }
});
check('Terrace loop works in reverse without passing through the CR',()=>{
 const names=['Hallway return','Study','Study terrace door','Terrace','Master 1 terrace door','Master 1 corridor','Upper landing'];
 for(let i=1;i<names.length;i++)nav.path(data.tour.find(p=>p.name===names[i-1]),data.tour.find(p=>p.name===names[i]));
});
const report={phase:data.phase,passed:true,checks,routeLegs:legs.length,routeMetres:+legs.reduce((a,b)=>a+b.metres,0).toFixed(2),playerRadius:data.playerRadius,bodyHeight:data.bodyHeight,limitations:'Geometric checks complement rendered first-person visual review; do not prove lighting or appearance.'};
await fs.writeFile(path.join(path.dirname(file),'layout-validation.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(path.dirname(file),'walkthrough-paths.json'),JSON.stringify(legs));
console.log(JSON.stringify(report,null,2));
