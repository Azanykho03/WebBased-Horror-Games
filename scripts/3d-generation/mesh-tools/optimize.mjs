// Simplify a chosen mesh while keeping its embedded texture bytes unchanged.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { weld, simplifyPrimitive, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import validator from 'gltf-validator';

const [input, output, meshName = 'Ghost_head', ratioText = '0.2'] = process.argv.slice(2);
const ratio = Number(ratioText);
if (!input || !output || !(ratio > 0 && ratio <= 1)) {
  throw new Error('Usage: node optimize.mjs input.glb output.glb [mesh-name] [ratio]');
}
try { await fs.access(output); throw new Error('Output exists; use a new filename.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await MeshoptSimplifier.ready;
const io = new NodeIO();
const document = await io.read(input);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const beforeTextures = document.getRoot().listTextures().map(t => hash(t.getImage())).sort();
const count = () => document.getRoot().listMeshes().map(mesh => ({
  name: mesh.getName(), triangles: mesh.listPrimitives().reduce((n,p) => n + p.getIndices().getCount()/3, 0),
}));
const before = count();
await document.transform(weld());
let matched = 0;
for (const mesh of document.getRoot().listMeshes()) {
  if (mesh.getName() !== meshName) continue;
  for (const primitive of mesh.listPrimitives()) {
    simplifyPrimitive(primitive, { simplifier: MeshoptSimplifier, ratio, error: 0.003, lockBorder: true });
  }
  matched++;
}
if (!matched) throw new Error(`No mesh named ${meshName}`);
await document.transform(prune());
const afterTextures = document.getRoot().listTextures().map(t => hash(t.getImage())).sort();
if (JSON.stringify(beforeTextures) !== JSON.stringify(afterTextures)) throw new Error('Texture data unexpectedly changed.');
await io.write(output, document);
const bytes = await fs.readFile(output);
const validation = await validator.validateBytes(new Uint8Array(bytes), { uri:path.basename(output), maxIssues:100 });
await fs.writeFile(output + '.validation.json', JSON.stringify(validation, null, 2));
const summary = { before, after:count(), textureBytesPreserved:true, fileSize:bytes.length,
  errors:validation.issues.numErrors, warnings:validation.issues.numWarnings, ratio, errorTolerance:0.003 };
await fs.writeFile(output + '.optimization.json', JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (validation.issues.numErrors) process.exitCode = 1;
