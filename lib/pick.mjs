import fs from 'node:fs';
import path from 'node:path';
import { ask, clone, exists, git, localRepo, readManifest, validName, write, writeManifest } from './manifest.mjs';
import { updateDictionary, unsummarized } from './dictionary.mjs';

export const rewritePrefix = text => text.replace(/pstack:(?!models:)(?=[a-z])/g, '');
export function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === '.DS_Store') return [];
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Source symlinks are unsupported: ${file}`);
    return entry.isDirectory() ? files(file) : [file];
  });
}
export function dependencies(directory, available) {
  const found = new Set();
  for (const file of files(directory)) {
    for (const [, name] of fs.readFileSync(file, 'utf8').matchAll(/\.\.\/([a-z0-9][a-z0-9_-]*)\//g)) {
      if (available.includes(name)) found.add(name);
    }
  }
  return [...found];
}
export function closeDependencies(selected, root, available) {
  const closed = new Set(selected);
  for (const name of closed) {
    for (const dependency of dependencies(path.join(root, name), available)) {
      if (closed.has(dependency)) continue;
      console.log(`${name} needs ${dependency} (referenced by relative path), adding it`);
      closed.add(dependency);
    }
  }
  return [...closed];
}
export function frontmatter(text) {
  const header = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] || '';
  return Object.fromEntries(['name', 'description'].map(key => {
    const match = header.match(new RegExp(`^${key}:\\s*([^\\n]*)(?:\\n((?:[ \\t]+[^\\n]*(?:\\n|$))*))?`, 'm'));
    let value = match?.[1]?.trim() || '';
    if (/^[>|][-+]?$/.test(value)) value = (match[2] || '').trim().replace(/\s+/g, ' ');
    else if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    return [key, value];
  }));
}
export function credits(text, manifest) {
  const begin = '<!-- credits:begin -->', end = '<!-- credits:end -->';
  if (text.split(begin).length !== 2 || text.split(end).length !== 2 || text.indexOf(begin) > text.indexOf(end)) throw new Error('README.md needs one ordered credits:begin/credits:end marker pair.');
  const lines = Object.entries(manifest.sources).filter(([, source]) => source.repo).map(([name, source]) => {
    const names = group => Object.keys(manifest[group]).filter(item => manifest[group][item].source === name).sort().join(', ') || 'none';
    return `- **${name}**: ${source.credit}. Source: ${source.repo}. Skills: ${names('skills')}. Agents: ${names('agents')}.`;
  });
  return text.slice(0, text.indexOf(begin) + begin.length) + '\n' + lines.join('\n') + '\n' + text.slice(text.indexOf(end));
}
export default async function pick(ctx, { source: input, subdir }, prompts) {
  const repo = localRepo(ctx), manifest = readManifest(repo);
  let name = Object.hasOwn(manifest.sources, input) ? input : Object.keys(manifest.sources).find(key => manifest.sources[key].repo === input);
  if (!name) {
    if (!/^(https?:\/\/|ssh:\/\/|git:\/\/|git@|file:\/\/)/.test(input)) throw new Error(`Unknown source or invalid git URL: ${input}`);
    name = validName(input.replace(/\/$/, '').split(/[/:]/).at(-1).replace(/\.git$/, ''));
    if (Object.hasOwn(manifest.sources, name)) throw new Error(`Source name collision: ${name}`);
    const credit = await ask('text', { message: `Credit for ${name}:`, validate: value => value?.trim() ? undefined : 'Credit is required.' }, prompts);
    if (!credit.trim()) throw new Error('Credit is required.');
    manifest.sources[name] = { repo: input, subdir: subdir || '', credit: credit.trim() };
  }
  const source = manifest.sources[name];
  if (!source.repo) throw new Error(`Source ${name} is local. Use add <name>.`);
  if (subdir !== undefined) source.subdir = subdir;
  const cache = path.join(ctx.home, '.cache/mide-skills', name);
  const root = path.resolve(cache, source.subdir || '');
  if (root !== cache && !root.startsWith(`${cache}${path.sep}`)) throw new Error('Source subdir must stay inside its clone.');
  fs.mkdirSync(path.dirname(cache), { recursive: true });
  if (!exists(cache)) clone(source.repo, cache, repo, ctx);
  else {
    if (git(['remote', 'get-url', 'origin'], cache, ctx) !== source.repo) throw new Error(`Cached source URL differs: ${cache}`);
    git(['fetch', 'origin'], cache, ctx);
    git(['reset', '--hard', 'origin/HEAD'], cache, ctx);
  }
  const commit = git(['rev-parse', 'HEAD'], cache, ctx);
  const selected = {}, available = {};
  for (const group of ['skills', 'agents']) {
    const directory = path.join(root, group);
    if (group === 'skills' && !exists(directory)) throw new Error(`Missing source skills directory: ${directory}`);
    available[group] = exists(directory) ? fs.readdirSync(directory, { withFileTypes: true }).filter(entry => group === 'skills' ? entry.isDirectory() && exists(path.join(directory, entry.name, 'SKILL.md')) : entry.isFile() && entry.name.endsWith('.md')).map(entry => validName(group === 'skills' ? entry.name : entry.name.slice(0, -3))).sort() : [];
    const options = available[group].map(item => {
      const info = frontmatter(fs.readFileSync(path.join(directory, group === 'skills' ? `${item}/SKILL.md` : `${item}.md`), 'utf8'));
      return { value: item, label: info.name || item, hint: info.description.slice(0, 80) };
    });
    selected[group] = options.length ? await ask('multiselect', { message: `Select ${group} from ${name}`, options, initialValues: available[group].filter(item => manifest[group][item]?.source === name), required: false }, prompts) : [];
  }
  selected.skills = closeDependencies(selected.skills, path.join(root, 'skills'), available.skills);
  const readme = path.join(repo, 'README.md'), original = fs.readFileSync(readme, 'utf8');
  credits(original, manifest);
  for (const group of ['skills', 'agents']) {
    for (const item of selected[group]) {
      const owner = manifest[group][item]?.source;
      const destination = path.join(repo, group, group === 'skills' ? item : `${item}.md`);
      if ((owner && owner !== name) || (!owner && exists(destination))) throw new Error(`Refusing to overwrite ${group}/${item}: belongs to ${owner || 'an unregistered entry'}.`);
      if (group === 'skills') files(path.join(root, group, item));
    }
  }
  const previous = structuredClone(manifest);
  // Persist ownership first so an interrupted copy can be retried without a false collision.
  for (const group of ['skills', 'agents']) {
    for (const item of selected[group]) manifest[group][item] = { source: name, commit };
  }
  writeManifest(repo, manifest);
  for (const group of ['skills', 'agents']) {
    for (const item of selected[group]) {
      const filename = group === 'skills' ? item : `${item}.md`;
      const destination = path.join(repo, group, filename);
      fs.rmSync(destination, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.cpSync(path.join(root, group, filename), destination, { recursive: true, filter: file => path.basename(file) !== '.DS_Store' });
      for (const file of group === 'skills' ? files(destination) : [destination]) {
        if (file.endsWith('.md')) fs.writeFileSync(file, rewritePrefix(fs.readFileSync(file, 'utf8')));
      }
      console.log(`${previous[group][item] ? 'Updated' : 'Added'} ${group}/${item}`);
      manifest[group][item] = { source: name, commit };
    }
    for (const item of Object.keys(manifest[group])) {
      if (manifest[group][item].source !== name || selected[group].includes(item)) continue;
      fs.rmSync(path.join(repo, group, group === 'skills' ? item : `${item}.md`), { recursive: true, force: true });
      delete manifest[group][item];
      console.log(`Removed ${group}/${item}`);
    }
  }
  writeManifest(repo, manifest);
  write(readme, credits(original, manifest));
  const changed = selected.skills.filter(item => previous.skills[item]?.commit !== commit);
  updateDictionary(repo, ctx, [...new Set([...changed, ...unsummarized(repo, selected.skills)])]);
}
