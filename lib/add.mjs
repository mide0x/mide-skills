import path from 'node:path';
import fs from 'node:fs';
import { exists, localRepo, readManifest, validName, write, writeManifest } from './manifest.mjs';

export default function add(ctx, { name }) {
  validName(name);
  const repo = localRepo(ctx);
  const manifest = readManifest(repo);
  const folder = path.join(repo, 'skills', name);
  if (exists(folder) || (manifest.skills[name] && manifest.skills[name].source !== 'local')) throw new Error(`Skill already exists: ${name}`);
  const file = path.join(folder, 'SKILL.md');
  const staging = path.join(repo, 'skills', `.mide-skills-add-${name}`);
  write(path.join(staging, 'SKILL.md'), `---\nname: ${name}\ndescription: Describe what this skill does and when to use it.\n---\n\n# ${name}\n`);
  manifest.skills[name] = { source: 'local' };
  writeManifest(repo, manifest);
  fs.renameSync(staging, folder);
  console.log(file);
}
