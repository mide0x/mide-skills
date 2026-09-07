import fs from 'node:fs';
import path from 'node:path';
import { exists, write } from './manifest.mjs';

const include = '@~/.claude/pstack-models.md';
const begin = '<!-- pstack:models:begin -->';
const end = '<!-- pstack:models:end -->';
const append = (text, block) => `${text}${text && !text.endsWith('\n') ? '\n' : ''}${block}`;
export function claudeIntegration(text) {
  let seen = false;
  const result = text.split('\n').filter(line => {
    if (line.trim() !== include) return true;
    if (seen) return false;
    seen = true;
    return true;
  }).map(line => line.trim() === include ? include : line).join('\n');
  return seen ? result : append(result, `${include}\n`);
}
export function codexIntegration(text, sheet) {
  const starts = text.split(begin).length - 1;
  const ends = text.split(end).length - 1;
  if (starts !== ends || starts > 1 || (starts && text.indexOf(begin) > text.indexOf(end))) {
    throw new Error('Malformed pstack model markers in Codex AGENTS.md: require one ordered begin/end pair, or neither marker.');
  }
  const block = `${begin}\n${sheet}${sheet.endsWith('\n') ? '' : '\n'}${end}`;
  return starts ? text.slice(0, text.indexOf(begin)) + block + text.slice(text.indexOf(end) + end.length) : append(text, `${block}\n`);
}
export const TARGETS = {
  claude: { cli: 'claude', skills: '~/.claude/skills', agents: '~/.claude/agents', sheet: '~/.claude/pstack-models.md', startup: '~/.claude/CLAUDE.md', integrate: claudeIntegration },
  codex: { cli: 'codex', skills: '~/.agents/skills', agents: null, sheet: '~/.codex/pstack-models.md', startup: '~/.codex/AGENTS.md', integrate: codexIntegration },
};
export function onPath(cli, ctx) {
  return (ctx.env.PATH || '').split(path.delimiter).some(dir => {
    const file = path.resolve(ctx.cwd, dir, cli);
    try { fs.accessSync(file, fs.constants.X_OK); return fs.statSync(file).isFile(); } catch { return false; }
  });
}
export function detectTargets(ctx, tools) {
  const requested = tools === undefined ? Object.keys(TARGETS) : tools.split(',');
  for (const name of requested) if (!Object.hasOwn(TARGETS, name)) throw new Error(`Unknown target: ${name}`);
  const detected = Object.keys(TARGETS).filter(name => onPath(TARGETS[name].cli, ctx));
  console.log(`Detected targets: ${detected.join(', ') || 'none'}`);
  if (tools !== undefined && requested.some(name => !detected.includes(name))) throw new Error(`Missing requested CLIs: ${requested.filter(name => !detected.includes(name)).join(', ')}`);
  const selected = detected.filter(name => requested.includes(name));
  if (!selected.length) throw new Error('No target CLI found on PATH. Install claude or codex first.');
  return selected.map(name => ({ name, ...Object.fromEntries(Object.entries(TARGETS[name]).map(([key, value]) => [key, typeof value === 'string' && value.startsWith('~/') ? path.join(ctx.home, value.slice(2)) : value])) }));
}
export function parseLanes(sheet) {
  const lanes = {};
  for (const [descriptor, provider] of sheet.matchAll(/\b(claude|codex|grok):[a-z0-9.-]+@(low|medium|high|xhigh|max)\b/g)) {
    lanes[provider] = [...new Set([...(lanes[provider] || []), descriptor])];
  }
  return lanes;
}
export function verifyLanes(sheet, ctx) {
  const lanes = parseLanes(sheet);
  if (!Object.keys(lanes).length) throw new Error('No provider:model@effort descriptors found in config/pstack-models.md.');
  const missing = Object.keys(lanes).filter(provider => !onPath(provider, ctx));
  if (missing.length) throw new Error(`Missing provider CLIs:\n${missing.map(provider => `${provider}: ${lanes[provider].join(', ')}`).join('\n')}`);
  return Object.keys(lanes);
}
export const readText = file => exists(file) ? fs.readFileSync(file, 'utf8') : '';
export function linkStatus(destination, source) {
  const entry = exists(destination);
  if (!entry) return 'missing';
  if (!entry.isSymbolicLink()) return 'foreign';
  return path.resolve(path.dirname(destination), fs.readlinkSync(destination)) === source && exists(source) ? 'linked' : 'stale';
}
export function syncLinks(directory, sourceRoot, names) {
  fs.mkdirSync(directory, { recursive: true });
  const result = { linked: [], pruned: [], conflicts: [] };
  for (const name of names) {
    const destination = path.join(directory, name);
    const status = linkStatus(destination, path.join(sourceRoot, name));
    if (status === 'foreign') { result.conflicts.push(destination); continue; }
    if (status === 'stale') fs.unlinkSync(destination);
    if (status !== 'linked') fs.symlinkSync(path.join(sourceRoot, name), destination);
    result.linked.push(destination);
  }
  for (const name of fs.readdirSync(directory)) {
    const destination = path.join(directory, name);
    if (names.includes(name) || !fs.lstatSync(destination).isSymbolicLink()) continue;
    const resolved = path.resolve(directory, fs.readlinkSync(destination));
    const relative = path.relative(resolveMissing(sourceRoot), resolveMissing(resolved));
    if (relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
      fs.unlinkSync(destination);
      result.pruned.push(destination);
    }
  }
  return result;
}
function resolveMissing(file, depth = 0) {
  if (depth > 40) throw new Error(`Symlink loop: ${file}`);
  if (exists(file)?.isSymbolicLink()) return resolveMissing(path.resolve(path.dirname(file), fs.readlinkSync(file)), depth + 1);
  try { return fs.realpathSync(file); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return path.join(resolveMissing(path.dirname(file), depth + 1), path.basename(file));
  }
}
export function writeSheet(target, sheet) {
  const integrated = target.integrate(readText(target.startup), sheet.toString());
  write(target.sheet, sheet);
  write(target.startup, integrated);
}
