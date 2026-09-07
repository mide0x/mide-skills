import fs from 'node:fs';
import path from 'node:path';
import { ask, clone, exists, findRepo, pull, readManifest, write } from './manifest.mjs';
import { detectTargets, verifyLanes, syncLinks, writeSheet, readText } from './targets.mjs';

export async function installTargets(repo, ctx, { tools, yes = false } = {}, prompts) {
  const manifest = readManifest(repo);
  const targets = detectTargets(ctx, tools);
  const sheet = fs.readFileSync(path.join(repo, 'config/pstack-models.md'));
  const providers = verifyLanes(sheet.toString(), ctx);
  for (const [group, suffix] of [['skills', '/SKILL.md'], ['agents', '.md']]) {
    for (const name of Object.keys(manifest[group])) {
      const file = path.join(repo, group, `${name}${suffix}`);
      if (!exists(file)) throw new Error(`Missing manifest entry: ${file}`);
    }
  }
  for (const target of targets) target.integrate(readText(target.startup), sheet.toString());
  console.log(`Install: ${targets.map(t => t.name).join(', ')}; ${Object.keys(manifest.skills).length} skills; ${Object.keys(manifest.agents).length} agents; providers verified: ${providers.join(', ')}`);
  if (!yes && !await ask('confirm', { message: 'Install these skills and model settings?' }, prompts)) throw new Error('Cancelled.');
  const results = [];
  for (const target of targets) {
    for (const group of ['skills', 'agents']) {
      if (!target[group]) continue;
      const names = Object.keys(manifest[group]).map(name => group === 'agents' ? `${name}.md` : name);
      results.push(syncLinks(target[group], path.join(repo, group), names));
    }
  }
  const conflicts = results.flatMap(result => result.conflicts);
  if (conflicts.length) throw new Error(`Move or remove these real files/directories, then rerun install:\n${conflicts.join('\n')}`);
  for (const target of targets) writeSheet(target, sheet);
  console.log(`Linked ${results.flatMap(r => r.linked).length}; pruned ${results.flatMap(r => r.pruned).length}; wrote ${targets.length} model sheets and startup integrations.`);
}
export default async function install(ctx, options, prompts) {
  let repo = findRepo(ctx.cwd);
  if (!repo) {
    repo = path.join(ctx.home, '.mide-skills');
    if (exists(repo)) pull(repo, ctx);
    else clone('https://github.com/mide0x/mide-skills.git', repo, ctx.cwd, ctx);
    if (findRepo(repo) !== repo) throw new Error(`Invalid mide-skills checkout: ${repo}`);
  }
  write(ctx.state, `${JSON.stringify({ repo }, null, 2)}\n`);
  await installTargets(repo, ctx, options, prompts);
}
