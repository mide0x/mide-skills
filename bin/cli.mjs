#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { context } from '../lib/manifest.mjs';

const commands = {
  install: { tools: { type: 'string' }, yes: { type: 'boolean' } },
  update: { yes: { type: 'boolean' } },
  pick: { subdir: { type: 'string' } },
  add: {},
  doctor: {},
  dictionary: { all: { type: 'boolean' } },
};
const positionalKeys = { pick: 'source', add: 'name', dictionary: 'names' };
const help = `mide-skills
  install [--tools claude,codex] [--yes]  Link skills and model settings
  update [--yes]                         Pull and reinstall without prompting
  pick <source> [--subdir <path>]         Vendor skills and agents
  add <name>                            Scaffold a local skill
  doctor                                Check links and model settings
  dictionary [name...] [--all]          Rewrite plain-English summaries in skill-dictionary.md`;
try {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h') console.log(help);
  else {
    if (!Object.hasOwn(commands, command)) throw new Error(`Unknown command: ${command}\n${help}`);
    const { values, positionals } = parseArgs({ args, options: { ...commands[command], help: { type: 'boolean', short: 'h' } }, allowPositionals: true });
    if (values.help) console.log(help);
    else {
      const key = positionalKeys[command];
      if (key !== 'names' && positionals.length !== (key ? 1 : 0)) throw new Error(`Invalid arguments for ${command}\n${help}`);
      const { default: run } = await import(`../lib/${command}.mjs`);
      await run(context(), { ...values, ...(key === 'names' ? { names: positionals } : key ? { [key]: positionals[0] } : {}) });
    }
  }
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
