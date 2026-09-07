import fs from 'node:fs';
import path from 'node:path';
import { exists, findRepo, readManifest, stateRepo } from './manifest.mjs';
import { detectTargets, linkStatus, readText } from './targets.mjs';

export default function doctor(ctx) {
  const repo = findRepo(ctx.cwd) || stateRepo(ctx);
  const manifest = readManifest(repo);
  const sheet = fs.readFileSync(path.join(repo, 'config/pstack-models.md'));
  let healthy = true;
  for (const target of detectTargets(ctx)) {
    for (const group of ['skills', 'agents']) {
      if (!target[group]) continue;
      for (const name of Object.keys(manifest[group])) {
        const filename = group === 'agents' ? `${name}.md` : name;
        const status = linkStatus(path.join(target[group], filename), path.join(repo, group, filename));
        console.log(`${target.name} ${group}/${name}: ${status}`);
        if (status !== 'linked') healthy = false;
      }
    }
    const matches = exists(target.sheet) && fs.readFileSync(target.sheet).equals(sheet);
    let integrated = false;
    try { const text = readText(target.startup); integrated = target.integrate(text, sheet.toString()) === text; }
    catch (error) { console.log(error.message); }
    console.log(`${target.name} sheet: ${matches ? 'matches' : 'missing or differs'}; integration: ${integrated ? 'present' : 'missing or invalid'}`);
    if (!matches || !integrated) healthy = false;
  }
  if (!healthy) throw new Error('Doctor found problems. Run install to repair links and model settings.');
}
