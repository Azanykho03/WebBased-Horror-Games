import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const directory = 'public/assets/models/player/legs/';
const bytes = readFileSync(directory + 'student-uniform-legs.glb');
const jsonLength = bytes.readUInt32LE(12), gltf = JSON.parse(bytes.subarray(20,20+jsonLength).toString());
function values(index: number): number[] {
  const a=gltf.accessors[index],v=gltf.bufferViews[a.bufferView], components=({SCALAR:1,VEC3:3,VEC4:4,MAT4:16} as Record<string,number>)[a.type];
  const size=a.componentType===5123?2:4, start=28+jsonLength+(v.byteOffset??0)+(a.byteOffset??0);
  return Array.from({length:a.count*components},(_,i)=>a.componentType===5126?bytes.readFloatLE(start+i*size):a.componentType===5123?bytes.readUInt16LE(start+i*size):bytes.readUInt32LE(start+i*size));
}
test('uniform preserves its source and fits a small runtime asset budget',()=>{
  const report=JSON.parse(readFileSync(directory+'leg-integration-report.json','utf8'));
  assert.equal(createHash('sha256').update(readFileSync(directory+'source/female_skinny_bottom_part.glb')).digest('hex'),report.sourceSHA256);
  assert.equal(bytes.length,report.runtimeBytes);assert(bytes.length<2_000_000);assert(report.runtimeTriangles<55_000);
  assert.equal(gltf.meshes.length,3);assert(gltf.materials[0].pbrMetallicRoughness.roughnessFactor>.85);
});
test('pants, waistband and shoes use a connected normalized hip/knee/ankle skin',()=>{
  assert.equal(gltf.skins.length,1);const skin=gltf.skins[0];assert.equal(skin.joints.length,7);
  const names=skin.joints.map((i:number)=>gltf.nodes[i].name);
  assert.deepEqual(names,['Pelvis','Thigh.L','Shin.L','Foot.L','Thigh.R','Shin.R','Foot.R']);
  for(const side of ['L','R']) {
    const thigh=skin.joints[names.indexOf(`Thigh.${side}`)], shin=skin.joints[names.indexOf(`Shin.${side}`)], foot=skin.joints[names.indexOf(`Foot.${side}`)];
    assert(gltf.nodes[skin.skeleton].children.includes(thigh));assert(gltf.nodes[thigh].children.includes(shin));assert(gltf.nodes[shin].children.includes(foot));
  }
  for(const mesh of gltf.meshes)for(const p of mesh.primitives){
    const weights=values(p.attributes.WEIGHTS_0), joints=values(p.attributes.JOINTS_0),positions=values(p.attributes.POSITION);
    assert(positions.every(Number.isFinite));assert.equal(weights.length,joints.length);
    for(let i=0;i<weights.length;i+=4){
      assert(Math.abs(weights.slice(i,i+4).reduce((a,b)=>a+b,0)-1)<1e-6);
      const active=joints.slice(i,i+4).filter((_,n)=>weights[i+n]>.001);
      assert(active.every(j=>j>=0&&j<7));
      assert(!(active.some(j=>j>=1&&j<=3)&&active.some(j=>j>=4)), 'A vertex cannot be weighted to opposite legs');
    }
  }
});
