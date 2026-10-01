// Validate existing GLBs without rewriting them; output the full Khronos report.
import fs from 'node:fs/promises';
import path from 'node:path';
import validator from 'gltf-validator';

const files = process.argv.slice(2);
if (!files.length) throw new Error('Usage: node validate.mjs asset.glb [asset.glb ...]');
for (const file of files) {
  const bytes = await fs.readFile(file);
  const report = await validator.validateBytes(new Uint8Array(bytes), { uri: path.basename(file), maxIssues: 100 });
  await fs.writeFile(path.join(path.dirname(file), 'validation-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ file, errors: report.issues.numErrors, warnings: report.issues.numWarnings, infos: report.issues.numInfos }));
  if (report.issues.numErrors) process.exitCode = 1;
}
