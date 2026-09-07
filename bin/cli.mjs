#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { context } from '../lib/manifest.mjs';

const commands = {
  install: { tools: { type: 'string' }, yes: { type: 'boolean' } },
  update: { yes: { type: 'boolean' } },
  pick: { subdir: { type: 'string' } },
  add: {},
  doctor: {},
};
const help = `mide-skills
  install [--tools claude,codex] [--yes]  Link skills and model settings
  update [--yes]                         Pull and reinstall without prompting
  pick <source> [--subdir <path>]         Vendor skills and agents
  add <name>                            Scaffold a local skill
  doctor                                Check links and model settings`;
try {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h') console.log(help);
  else {
    if (!Object.hasOwn(commands, command)) throw new Error(`Unknown command: ${command}\n${help}`);
    const { values, positionals } = parseArgs({ args, options: { ...commands[command], help: { type: 'boolean', short: 'h' } }, allowPositionals: true });
    if (values.help) console.log(help);
    else {
      const positional = command === 'pick' ? 'source' : command === 'add' ? 'name' : null;
      if (positionals.length !== (positional ? 1 : 0)) throw new Error(`Invalid arguments for ${command}\n${help}`);
      const { default: run } = await import(`../lib/${command}.mjs`);
      await run(context(), { ...values, ...(positional ? { [positional]: positionals[0] } : {}) });
    }
  }
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
