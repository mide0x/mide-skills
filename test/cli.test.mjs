import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { context, readManifest, writeManifest, write, git, findRepo, stateRepo } from '../lib/manifest.mjs';
import { parseLanes, verifyLanes, claudeIntegration, codexIntegration, syncLinks, linkStatus, detectTargets } from '../lib/targets.mjs';
import pick, { rewritePrefix, dependencies, closeDependencies, frontmatter, credits, requiredAgents } from '../lib/pick.mjs';
import install, { installTargets } from '../lib/install.mjs';
import add from '../lib/add.mjs';
import doctor from '../lib/doctor.mjs';
import update from '../lib/update.mjs';
import dictionary, { parseDictionary, renderDictionary, updateDictionary, invocable, PLACEHOLDER } from '../lib/dictionary.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sheet = fs.readFileSync(path.join(root, 'config/pstack-models.md'), 'utf8');
function fixture(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mide-skills-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const repo = path.join(home, 'repo');
  for (const file of ['package.json', 'manifest.json', 'README.md', 'config/pstack-models.md']) write(path.join(repo, file), fs.readFileSync(path.join(root, file)));
  for (const name of ['explain', 'codex-first']) write(path.join(repo, 'skills', name, 'SKILL.md'), `---\nname: ${name}\ndescription: Fixture\n---\n`);
  const bin = path.join(home, 'bin');
  for (const cli of ['claude', 'codex']) { write(path.join(bin, cli), '#!/bin/sh\nexit 0\n'); fs.chmodSync(path.join(bin, cli), 0o755); }
  const ctx = context({ home, cwd: repo, env: { ...process.env, HOME: home, PATH: `${bin}:/usr/bin:/bin`, GIT_CONFIG_NOSYSTEM: '1' } });
  ctx.summarize = directory => `Summary of ${path.basename(directory)}.`;
  return ctx;
}
const prompts = selections => ({ multiselect: async () => selections.shift(), text: async () => 'Fixture author', isCancel: value => typeof value === 'symbol' });

test('manifest round trip, parent discovery, and missing state', t => {
  const ctx = fixture(t), manifest = readManifest(ctx.cwd);
  manifest.agents.reviewer = { source: 'open-pstack', commit: 'abc' };
  writeManifest(ctx.cwd, manifest);
  assert.deepEqual(readManifest(ctx.cwd), manifest);
  assert.equal(findRepo(path.join(ctx.cwd, 'skills/explain')), ctx.cwd);
  assert.throws(() => stateRepo(ctx), /Run install first/);
  manifest.skills.bad = { source: 'missing' };
  writeManifest(ctx.cwd, manifest);
  assert.throws(() => readManifest(ctx.cwd), /Unknown manifest source/);
});

test('seeded lanes require claude and codex and report missing descriptors', t => {
  const ctx = fixture(t);
  assert.deepEqual(Object.keys(parseLanes(sheet)).sort(), ['claude', 'codex']);
  assert.deepEqual(verifyLanes(sheet, ctx).sort(), ['claude', 'codex']);
  assert.deepEqual(parseLanes('grok:grok-4@high codex:gpt-6-astra@max codex:gpt-6-astra@max'), { grok: ['grok:grok-4@high'], codex: ['codex:gpt-6-astra@max'] });
  fs.unlinkSync(path.join(ctx.home, 'bin/codex'));
  assert.throws(() => verifyLanes(sheet, ctx), /codex: codex:gpt-6-astra@high/);
  assert.throws(() => detectTargets(ctx, 'codex'), /Missing requested CLIs/);
  assert.throws(() => detectTargets(ctx, 'unknown'), /Unknown target/);
});

test('prefix rewrite is precise and idempotent', () => {
  const original = 'pstack:tdd pstack:pstack-fable-max pstack:1 pstack:Upper <!-- pstack:models:begin -->';
  const rewritten = 'tdd pstack-fable-max pstack:1 pstack:Upper <!-- pstack:models:begin -->';
  assert.equal(rewritePrefix(original), rewritten);
  assert.equal(rewritePrefix(rewritten), rewritten);
});

test('dependency scanner closes cycles and scans nested non-Markdown files', t => {
  const ctx = fixture(t), directory = path.join(ctx.home, 'source');
  write(path.join(directory, 'a/SKILL.md'), '[B](../b/SKILL.md) ../missing/');
  write(path.join(directory, 'b/nested/run.sh'), '../c/reference/file');
  write(path.join(directory, 'c/SKILL.md'), '../a/SKILL.md');
  write(path.join(directory, 'a/.DS_Store'), '../c/');
  assert.deepEqual([...dependencies(path.join(directory, 'a'), ['a', 'b', 'c']).keys()], ['b']);
  write(path.join(directory, 'd/SKILL.md'), '---\nname: d\nuser-invocable: false\n---\n');
  write(path.join(directory, 'e/SKILL.md'), 'Read **d** and principle-d but not dd.');
  assert.equal(invocable(fs.readFileSync(path.join(directory, 'd/SKILL.md'), 'utf8')), false);
  assert.equal(invocable('---\nname: x\n---\n'), true);
  assert.deepEqual(closeDependencies(['e'], directory, ['a', 'b', 'c', 'd', 'e'], ['d']), ['e', 'd']);
  write(path.join(directory, 'f/SKILL.md'), 'Spawn poteto-agent here.');
  const agents = requiredAgents('x: claude:fable@max, codex:gpt-6-astra@high', directory, ['f'], ['pstack-fable-max', 'pstack-fable-high', 'pstack-opus-xhigh', 'poteto-agent', 'comment-sicko']);
  assert.deepEqual([...agents.keys()], ['pstack-fable-max', 'poteto-agent']);
  assert.deepEqual(closeDependencies(['a'], directory, ['a', 'b', 'c']), ['a', 'b', 'c']);
  assert.deepEqual(frontmatter('---\nname: "a"\ndescription: >-\n  First line\n  second line\n---\n'), { name: 'a', description: 'First line second line' });
});

test('Claude include appends, preserves content, and deduplicates', () => {
  const include = '@~/.claude/pstack-models.md';
  assert.equal(claudeIntegration(''), `${include}\n`);
  assert.equal(claudeIntegration('Personal notes'), `Personal notes\n${include}\n`);
  const text = `Before\n${include}\nAfter\n`;
  assert.equal(claudeIntegration(text), text);
  assert.equal(claudeIntegration(`${text}${include}\n`), text);
});

test('Codex block appends, replaces, and rejects all malformed marker shapes', () => {
  const begin = '<!-- pstack:models:begin -->', end = '<!-- pstack:models:end -->';
  const block = `${begin}\n${sheet}${end}`;
  assert.equal(codexIntegration('Notes', sheet), `Notes\n${block}\n`);
  const text = `Before\n${begin}\nold\n${end}\nAfter\n`;
  const result = `Before\n${block}\nAfter\n`;
  assert.equal(codexIntegration(text, sheet), result);
  assert.equal(codexIntegration(result, sheet), result);
  for (const malformed of [begin, end, `${end}${begin}`, `${begin}${begin}${end}`, `${begin}${end}${end}`, `${begin}${end}${begin}${end}`]) assert.throws(() => codexIntegration(malformed, sheet), /Malformed/);
});

test('links converge, preserve conflicts and outsiders, and prune owned dangling links', t => {
  const ctx = fixture(t), source = path.join(ctx.cwd, 'skills'), target = path.join(ctx.home, 'target');
  fs.mkdirSync(target);
  fs.mkdirSync(path.join(target, 'codex-first'));
  fs.symlinkSync('/different/repo/explain', path.join(target, 'explain'));
  fs.symlinkSync(path.join(source, 'removed'), path.join(target, 'removed'));
  fs.symlinkSync(path.join(ctx.home, 'other/absent'), path.join(target, 'outsider'));
  fs.symlinkSync(path.join(ctx.home, 'outside'), path.join(source, 'escape'));
  fs.symlinkSync(path.join(source, 'escape/missing'), path.join(target, 'escape'));
  const result = syncLinks(target, source, ['explain', 'codex-first']);
  assert.deepEqual(result.conflicts, [path.join(target, 'codex-first')]);
  assert.deepEqual(result.pruned, [path.join(target, 'removed')]);
  assert.equal(linkStatus(path.join(target, 'explain'), path.join(source, 'explain')), 'linked');
  assert.equal(linkStatus(path.join(target, 'codex-first'), path.join(source, 'codex-first')), 'foreign');
  assert.ok(fs.lstatSync(path.join(target, 'outsider')).isSymbolicLink());
  assert.ok(fs.lstatSync(path.join(target, 'escape')).isSymbolicLink());
  assert.equal(syncLinks(target, source, ['explain', 'codex-first']).pruned.length, 0);
});

test('install and doctor converge in an isolated home, including agents and malformed integration', async t => {
  const ctx = fixture(t), manifest = readManifest(ctx.cwd);
  manifest.agents.reviewer = { source: 'local' };
  writeManifest(ctx.cwd, manifest);
  write(path.join(ctx.cwd, 'agents/reviewer.md'), 'Reviewer');
  await install(ctx, { yes: true });
  await install(ctx, { yes: true });
  assert.equal(stateRepo(ctx), ctx.cwd);
  assert.doesNotThrow(() => doctor(ctx));
  assert.ok(fs.lstatSync(path.join(ctx.home, '.claude/agents/reviewer.md')).isSymbolicLink());
  write(path.join(ctx.home, '.codex/AGENTS.md'), '<!-- pstack:models:begin -->');
  await assert.rejects(installTargets(ctx.cwd, ctx, { yes: true }), /Malformed/);
  assert.throws(() => doctor(ctx), /Doctor found problems/);
  fs.unlinkSync(path.join(ctx.home, 'bin/codex'));
  await assert.rejects(installTargets(ctx.cwd, ctx, { tools: 'claude', yes: true }), /Missing provider CLIs/);
});

test('add scaffolds a local skill, rejects collisions and traversal', t => {
  const ctx = fixture(t);
  add(ctx, { name: 'mine' });
  assert.deepEqual(readManifest(ctx.cwd).skills.mine, { source: 'local' });
  assert.match(fs.readFileSync(path.join(ctx.cwd, 'skills/mine/SKILL.md'), 'utf8'), /name: mine/);
  assert.throws(() => add(ctx, { name: 'mine' }), /already exists/);
  assert.throws(() => add(ctx, { name: '../escape' }), /Invalid name/);
});

test('pick vendors local git fixtures, closes dependencies, propagates deletions, and updates credits', async t => {
  const ctx = fixture(t), upstream = path.join(ctx.home, 'upstream');
  write(path.join(upstream, 'skills/a/SKILL.md'), '---\nname: a\ndescription: A skill\n---\npstack:tdd ../b/SKILL.md reviewer');
  write(path.join(upstream, 'skills/a/obsolete.md'), 'Old');
  write(path.join(upstream, 'skills/a/.DS_Store'), 'Ignore');
  write(path.join(upstream, 'skills/b/SKILL.md'), 'pstack:bro');
  write(path.join(upstream, 'agents/reviewer.md'), 'pstack:pstack-fable-max');
  git(['init', '-b', 'main'], upstream, ctx);
  const commit = directory => { git(['add', '.'], directory, ctx); git(['-c', 'user.name=mide', '-c', 'user.email=midee247@gmail.com', 'commit', '-m', 'Fixture'], directory, ctx); };
  commit(upstream);
  const copy = fs.cpSync;
  const interrupted = t.mock.method(fs, 'cpSync', (...args) => { copy(...args); throw new Error('Simulated interruption'); });
  await assert.rejects(pick(ctx, { source: `file://${upstream}` }, prompts([['a']])), /Simulated interruption/);
  interrupted.mock.restore();
  await pick(ctx, { source: `file://${upstream}` }, prompts([['a']]));
  const manifest = readManifest(ctx.cwd);
  assert.equal(manifest.skills.b.source, 'upstream');
  assert.equal(manifest.skills.a.commit, git(['rev-parse', 'HEAD'], upstream, ctx));
  assert.match(fs.readFileSync(path.join(ctx.cwd, 'skills/a/SKILL.md'), 'utf8'), /tdd/);
  assert.equal(fs.existsSync(path.join(ctx.cwd, 'skills/a/.DS_Store')), false);
  assert.equal(fs.readFileSync(path.join(ctx.cwd, 'agents/reviewer.md'), 'utf8'), 'pstack-fable-max');
  assert.equal(parseDictionary(fs.readFileSync(path.join(ctx.cwd, 'skill-dictionary.md'), 'utf8')).get('b'), 'Summary of b.');
  const collision = readManifest(ctx.cwd);
  collision.skills.a.source = 'local';
  writeManifest(ctx.cwd, collision);
  await assert.rejects(pick(ctx, { source: 'upstream' }, prompts([['a']])), /Refusing to overwrite skills\/a/);
  writeManifest(ctx.cwd, manifest);
  fs.unlinkSync(path.join(upstream, 'skills/a/obsolete.md'));
  write(path.join(upstream, 'skills/a/SKILL.md'), '---\nname: a\ndescription: A skill\n---\npstack:tdd ../b/SKILL.md');
  commit(upstream);
  await pick(ctx, { source: 'upstream' }, prompts([['a']]));
  assert.equal(fs.existsSync(path.join(ctx.cwd, 'skills/a/obsolete.md')), false);
  assert.equal(fs.existsSync(path.join(ctx.cwd, 'agents/reviewer.md')), false);
  await pick(ctx, { source: 'upstream' }, prompts([[]]));
  assert.equal(fs.existsSync(path.join(ctx.cwd, 'skills/a')), false);
  assert.deepEqual(Object.keys(readManifest(ctx.cwd).skills).sort(), ['codex-first', 'explain']);
  assert.deepEqual([...parseDictionary(fs.readFileSync(path.join(ctx.cwd, 'skill-dictionary.md'), 'utf8')).keys()], ['codex-first', 'explain']);
  const readme = fs.readFileSync(path.join(ctx.cwd, 'README.md'), 'utf8');
  assert.equal(credits(readme, readManifest(ctx.cwd)), readme);
  assert.match(readme, /\*\*upstream\*\*: Fixture author/);
});

test('update pulls saved checkout and installs without prompting', async t => {
  const ctx = fixture(t);
  git(['init', '-b', 'main'], ctx.cwd, ctx);
  git(['add', '.'], ctx.cwd, ctx);
  git(['-c', 'user.name=mide', '-c', 'user.email=midee247@gmail.com', 'commit', '-m', 'Fixture'], ctx.cwd, ctx);
  const remote = path.join(ctx.home, 'remote.git');
  git(['clone', '--bare', ctx.cwd, remote], ctx.home, ctx);
  git(['remote', 'add', 'origin', remote], ctx.cwd, ctx);
  git(['fetch', 'origin'], ctx.cwd, ctx);
  git(['branch', '--set-upstream-to=origin/main'], ctx.cwd, ctx);
  write(ctx.state, JSON.stringify({ repo: ctx.cwd }));
  await update(ctx);
  assert.doesNotThrow(() => doctor(ctx));
});

test('CLI help, invalid flags, and doctor failures have deliberate exit codes', t => {
  const ctx = fixture(t);
  const run = args => spawnSync(process.execPath, [path.join(root, 'bin/cli.mjs'), ...args], { cwd: ctx.cwd, env: ctx.env, encoding: 'utf8' });
  assert.equal(run(['--help']).status, 0);
  assert.match(run(['--help']).stdout, /install[\s\S]*update[\s\S]*pick[\s\S]*add[\s\S]*doctor/);
  assert.equal(run(['install', '--wat']).status, 1);
  const result = run(['doctor']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Doctor found problems/);
  assert.doesNotMatch(result.stderr, /at .*\.mjs:/);
});

test('dictionary regenerates only what is asked, skips unchanged writes, and follows the manifest', t => {
  const ctx = fixture(t), calls = [], file = path.join(ctx.cwd, 'skill-dictionary.md');
  ctx.summarize = directory => { calls.push(path.basename(directory)); return `Summary of ${path.basename(directory)}.`; };
  const read = () => parseDictionary(fs.readFileSync(file, 'utf8'));
  updateDictionary(ctx.cwd, ctx);
  assert.deepEqual([...read()], [['codex-first', PLACEHOLDER], ['explain', PLACEHOLDER]]);
  assert.equal(renderDictionary(read()), fs.readFileSync(file, 'utf8'));
  dictionary(ctx, { names: ['explain'] });
  assert.equal(read().get('explain'), 'Summary of explain.');
  assert.equal(read().get('codex-first'), PLACEHOLDER);
  const mtime = fs.statSync(file).mtimeMs;
  calls.length = 0;
  updateDictionary(ctx.cwd, ctx);
  assert.equal(fs.statSync(file).mtimeMs, mtime);
  dictionary(ctx, {});
  assert.deepEqual(calls, ['codex-first']);
  dictionary(ctx, { all: true });
  assert.deepEqual(calls, ['codex-first', 'explain', 'codex-first']);
  assert.throws(() => dictionary(ctx, { names: ['nope'] }), /Not an invocable skill/);
  write(path.join(ctx.cwd, 'skills/helper/SKILL.md'), '---\nname: helper\nuser-invocable: false\n---\n');
  const withHelper = readManifest(ctx.cwd);
  withHelper.skills.helper = { source: 'local' };
  writeManifest(ctx.cwd, withHelper);
  dictionary(ctx, { all: true });
  assert.equal(read().has('helper'), false);
  assert.throws(() => dictionary(ctx, { names: ['helper'] }), /Not an invocable skill/);
  const manifest = readManifest(ctx.cwd);
  delete manifest.skills['codex-first'];
  writeManifest(ctx.cwd, manifest);
  assert.deepEqual(updateDictionary(ctx.cwd, ctx).dropped, ['codex-first']);
  add(ctx, { name: 'fresh' });
  assert.equal(read().get('fresh'), PLACEHOLDER);
});
