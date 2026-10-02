// Shared by offline validation and the first-person Babylon inspection page.
// Collision uses metre-sized circles against oriented furniture boxes, not mesh picking.
export function createNavigation(data) {
 const radius=data.playerRadius, rise=data.floorRise, body=data.bodyHeight;
 const stair=data.stair.rect; let solids=data.colliders;
 // Room-sized buckets keep frequent movement and enemy route queries local.
 // Bounds include the player's radius so narrow doorway checks stay exact.
 const bucketSize=2, buckets=new Map();
 function indexSolids(){
  buckets.clear();
  for(const c of solids){
   const co=Math.cos(c.yaw??0),si=Math.sin(c.yaw??0);
   const halfX=c.center?(Math.abs(co)*c.size[0]+Math.abs(si)*c.size[2])/2:0;
   const halfZ=c.center?(Math.abs(si)*c.size[0]+Math.abs(co)*c.size[2])/2:0;
   const minX=(c.center?c.center[0]-halfX:c.min[0])-radius;
   const maxX=(c.center?c.center[0]+halfX:c.max[0])+radius;
   const minZ=(c.center?c.center[2]-halfZ:c.min[2])-radius;
   const maxZ=(c.center?c.center[2]+halfZ:c.max[2])+radius;
   for(let x=Math.floor(minX/bucketSize);x<=Math.floor(maxX/bucketSize);x++)for(let z=Math.floor(minZ/bucketSize);z<=Math.floor(maxZ/bucketSize);z++){
    const key=`${x},${z}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(c);
   }
  }
 }
 indexSolids();
 const rects=[[],[]];
 for(const room of data.rooms) if(room.id!=='F03') rects[room.floor].push(...room.rects);
 rects[0].push([-4.6,-1.4,-15,-12],[-1.4,1.4,0,2]);
 const inside=(x,z,b)=>x>=b[0]&&x<=b[1]&&z>=b[2]&&z<=b[3];
 function height(x,z,level){
  if(level===0 && inside(x,z,stair)) return rise*(z-stair[2])/(stair[3]-stair[2]);
  return rects[level].some(b=>inside(x,z,b)) ? level*rise : null;
 }
 function blocked(x,y,z){
  for(const c of buckets.get(`${Math.floor(x/bucketSize)},${Math.floor(z/bucketSize)}`)??[]){
   let px=x,pz=z, minX,maxX,minZ,maxZ,minY,maxY;
   if(c.center){
    const dx=x-c.center[0],dz=z-c.center[2],co=Math.cos(c.yaw),si=Math.sin(c.yaw);
    px=dx*co-dz*si;pz=dx*si+dz*co;
    minX=-c.size[0]/2;maxX=-minX;minZ=-c.size[2]/2;maxZ=-minZ;
    minY=c.center[1]-c.size[1]/2;maxY=c.center[1]+c.size[1]/2;
   }else{[minX,minY,minZ]=c.min;[maxX,maxY,maxZ]=c.max;}
   if(y+.09>=maxY||y+body<=minY)continue;
   const dx=px-Math.max(minX,Math.min(maxX,px));
   const dz=pz-Math.max(minZ,Math.min(maxZ,pz));
   if(dx*dx+dz*dz<radius*radius)return c.id;
  }
  return null;
 }
 function point(x,z,level){const y=height(x,z,level);return y===null||blocked(x,y,z)?null:{x,y,z,level};}
 function move(p,dx,dz,slide=true){
  let cur={...p};const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.045));
  function step(x,z){
   const candidates=[point(x,z,cur.level),point(x,z,1-cur.level)].filter(q=>q&&Math.abs(q.y-cur.y)<.20);
   candidates.sort((a,b)=>Math.abs(a.y-cur.y)-Math.abs(b.y-cur.y));
   if(candidates.length){cur=candidates[0];return true;}return false;
  }
  for(let i=0;i<n;i++)if(!step(cur.x+dx/n,cur.z+dz/n)&&slide){step(cur.x+dx/n,cur.z);step(cur.x,cur.z+dz/n);}
  return cur;
 }
 function segment(a,b){const q=move(a,b.x-a.x,b.z-a.z,false);return Math.hypot(q.x-b.x,q.z-b.z)<.005&&Math.abs(q.y-b.y)<.08;}
 const cell=.2, cache=new Map(), edges=new Map();
 function grid(ix,iz,level){
  const key=`${ix},${iz},${level}`;
  if(cache.has(key))return cache.get(key);
  const p=point(ix*cell,iz*cell,level);if(p){p.key=key;p.ix=ix;p.iz=iz;}
  cache.set(key,p);return p;
 }
 function snap(p){
  let best=null,dist=Infinity;
  for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++){
   const q=grid(Math.round(p.x/cell)+a,Math.round(p.z/cell)+b,p.level);
   if(q&&Math.hypot(p.x-q.x,p.z-q.z)<dist&&segment(p,q)){best=q;dist=Math.hypot(p.x-q.x,p.z-q.z);}
  }return best;
 }
 function path(start,end){
  const sp=point(start.x,start.z,start.floor??start.level),ep=point(end.x,end.z,end.floor??end.level);
  if(!sp||!ep)throw Error(`Blocked route endpoint: ${!sp?start.name??JSON.stringify(start):end.name??JSON.stringify(end)}`);
  if(segment(sp,ep))return [sp,ep];
  const s=snap(sp),e=snap(ep);if(!s||!e)throw Error('Endpoint has no clear grid connection');
  const heap=[],cost=new Map([[s.key,0]]),prev=new Map(),closed=new Set();
  function push(v){heap.push(v);let i=heap.length-1;while(i){const j=(i-1)>>1;if(heap[j].f<=v.f)break;heap[i]=heap[j];i=j;}heap[i]=v;}
  function pop(){const v=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=last.f)break;heap[i]=heap[c];i=c;}heap[i]=last;}return v;}
  const heuristic=q=>Math.hypot(q.x-e.x,q.y-e.y,q.z-e.z);
  push({p:s,f:heuristic(s)});
  while(heap.length){
   const {p}=pop();if(closed.has(p.key))continue;closed.add(p.key);
   if(p.key===e.key){let q=p,result=[ep];while(q){result.push({x:q.x,y:q.y,z:q.z,level:q.level});q=prev.get(q.key);}result.push(sp);return result.reverse();}
   if(!edges.has(p.key)){
    const neighbors=[];
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]])for(const level of [p.level,1-p.level]){
     const q=grid(p.ix+dx,p.iz+dz,level);
     if(q&&Math.abs(q.y-p.y)<=.20&&segment(p,q))neighbors.push(q);
    }
    edges.set(p.key,neighbors);
   }
   for(const q of edges.get(p.key)){
    if(closed.has(q.key))continue;
    const g=cost.get(p.key)+Math.hypot(q.x-p.x,q.y-p.y,q.z-p.z);
    if(g<(cost.get(q.key)??Infinity)){cost.set(q.key,g);prev.set(q.key,p);push({p:q,f:g+heuristic(q)});}
   }
  }
  throw Error(`No collision-safe route: ${start.name} → ${end.name}`);
 }
 // Gameplay gates share the same collision and pathfinding as the house preview.
 function setDynamicColliders(extra){solids=data.colliders.concat(extra);cache.clear();edges.clear();indexSolids();}
 return {point,move,path,blocked,height,segment,radius,setDynamicColliders};
}
