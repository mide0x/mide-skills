import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

export const context = ({ home = process.env.HOME || os.homedir(), cwd = process.cwd(), env = process.env } = {}) => ({
  home, cwd, env, state: path.join(home, '.config/mide-skills/state.json'),
});
export function exists(file) {
  try { return fs.lstatSync(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
export function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, content);
  fs.renameSync(`${file}.tmp`, file);
}
export function validName(name) {
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(name)) throw new Error(`Invalid name: ${name}`);
  return name;
}
export function readManifest(repo) {
  const manifest = JSON.parse(fs.readFileSync(path.join(repo, 'manifest.json'), 'utf8'));
  for (const group of ['sources', 'skills', 'agents']) {
    if (!manifest[group] || typeof manifest[group] !== 'object' || Array.isArray(manifest[group])) throw new Error(`Invalid manifest: ${group}`);
    for (const name of Object.keys(manifest[group])) validName(name);
  }
  for (const item of [...Object.values(manifest.skills), ...Object.values(manifest.agents)]) {
    if (!Object.hasOwn(manifest.sources, item?.source)) throw new Error(`Unknown manifest source: ${item?.source}`);
  }
  return manifest;
}
export const writeManifest = (repo, manifest) => write(path.join(repo, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
export function findRepo(cwd) {
  for (let dir = path.resolve(cwd); ; dir = path.dirname(dir)) {
    if (exists(path.join(dir, 'manifest.json')) && exists(path.join(dir, 'package.json')) &&
        JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).name === 'mide-skills') return dir;
    if (dir === path.dirname(dir)) return;
  }
}
export function stateRepo(ctx) {
  if (!exists(ctx.state)) throw new Error('No mide-skills state. Run install first.');
  const { repo } = JSON.parse(fs.readFileSync(ctx.state, 'utf8'));
  if (typeof repo !== 'string' || !path.isAbsolute(repo) || findRepo(repo) !== repo) throw new Error('Saved checkout is missing or invalid. Run install first.');
  return repo;
}
export function localRepo(ctx) {
  const repo = findRepo(ctx.cwd);
  if (!repo) throw new Error('Run this command from a mide-skills checkout.');
  return repo;
}
export function git(args, cwd, ctx) {
  try { return execFileSync('git', args, { cwd, env: ctx.env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch (error) { throw new Error(`git ${args.join(' ')} failed: ${error.stderr?.toString().trim() || error.message}`); }
}
export function pull(repo, ctx) {
  const before = git(['rev-parse', '--short', 'HEAD'], repo, ctx);
  git(['pull', '--ff-only'], repo, ctx);
  const after = git(['rev-parse', '--short', 'HEAD'], repo, ctx);
  console.log(before === after ? 'Already up to date.' : `${before}..${after}`);
}
export function clone(url, destination, cwd, ctx) {
  const staging = `${destination}.mide-skills-clone`;
  fs.rmSync(staging, { recursive: true, force: true });
  git(['clone', '--', url, staging], cwd, ctx);
  fs.renameSync(staging, destination);
}
export async function ask(method, options, prompts) {
  if (!prompts && !process.stdin.isTTY) throw new Error('Interactive terminal required. Use install --yes for unattended installation.');
  const ui = prompts || await import('@clack/prompts');
  const answer = await ui[method](options);
  if (ui.isCancel(answer)) throw new Error('Cancelled.');
  return answer;
}
