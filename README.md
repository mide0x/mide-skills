# mide-skills

My personal skills for Claude Code and Codex, kept in one repo and installed on every machine with one command.

The repo holds the skills and subagents I want. A small CLI links them into both tools. When I add a skill here and push, every other machine picks it up with `update`.

## Set up a new machine

Install Node 22 or newer, Claude Code, and Codex. Then run:

```sh
npx github:mide0x/mide-skills install
```

That clones this repo to `~/.mide-skills`, links every skill and agent into Claude and Codex, and writes the model sheet. It asks one confirmation. Add `--yes` to skip it.

## Add a skill to the repo

Do this on the machine where you keep this checkout. There are two cases.

**Someone else wrote it.** Give `pick` the git repo it lives in. You get a checklist of every skill in that repo. Tick the ones you want.

```sh
node bin/cli.mjs pick https://github.com/someone/their-skills
```

The first time you pass a URL, `pick` asks for a credit line for the README. After that you can use the short name it saved, which is the last part of the URL:

```sh
node bin/cli.mjs pick their-skills
```

pstack is already registered as `open-pstack`, so for it you run:

```sh
node bin/cli.mjs pick open-pstack
```

Untick a skill on a later run to remove it. If a skill reads another skill, by file path or by name, `pick` adds that one too and tells you. That covers pstack's `principle-*` helpers, which cannot be invoked on their own.

You never choose agents. `pick` reads `config/pstack-models.md`, adds the subagent file for every Claude lane the sheet names, and adds any other agent a picked skill mentions. Change the sheet and rerun `pick` to change the agents.

**You are writing it yourself.** Scaffold it with `add`, then edit the file it prints.

```sh
node bin/cli.mjs add my-skill
```

Every `pick` and `add` also refreshes `skill-dictionary.md`, a plain-English list of when to use each skill. Picked skills get a one-sentence summary written by Claude right away. A skill you scaffold with `add` gets a placeholder, so once you finish writing it run:

```sh
node bin/cli.mjs dictionary my-skill
```

**Then, in both cases,** link it here and push:

```sh
node bin/cli.mjs install --yes
git add -A && git commit -m "Add my-skill" && git push
```

## Update the other machines

```sh
npx github:mide0x/mide-skills update
```

That pulls the repo and relinks. New skills appear. Removed skills are unlinked.

## Commands

| Command | What it does |
|---|---|
| `install [--tools claude,codex] [--yes]` | Link everything in the repo into the tools on this machine. |
| `update` | Pull the repo and run install again. |
| `pick <repo url or name> [--subdir <path>]` | Choose skills from another repo and copy them in, with the agents they need. |
| `add <name>` | Scaffold a new personal skill. |
| `doctor` | Report whether every link and the model sheet are in place. |
| `dictionary [name...] [--all]` | Rewrite the plain-English summaries in `skill-dictionary.md`. No names fills in placeholders, `--all` redoes everything. |

Run them as `node bin/cli.mjs <command>` from this checkout, or as `npx github:mide0x/mide-skills <command>` anywhere.

## How it works

Skills are linked, not copied. Claude Code reads `~/.claude/skills` and `~/.claude/agents`. Codex reads `~/.agents/skills`. Each entry there is a symlink into this repo, so the checkout has to stay where it is. On a machine set up with the one-liner that is `~/.mide-skills`. On the machine where you run commands from a checkout, it is that checkout.

Every provider named in the sheet must have its CLI on the path. If one is missing, install stops and lists what is needed. This is deliberate. I install the same tools on every machine and would rather fix the machine than get a half working setup.

## Credits

<!-- credits:begin -->
- **open-pstack**: Lauren Tan (pstack), Eric Litman (open-pstack). Source: https://github.com/ericlitman/open-pstack. Skills: architect, arena, blast-radius, bro, create-verification-skill, deslop, fix-merge-conflicts, how, interrogate, maintain-verification-skill, no-comments, poteto-mode, principle-boundary-discipline, principle-build-the-lever, principle-encode-lessons-in-structure, principle-exhaust-the-design-space, principle-experience-first, principle-fix-root-causes, principle-foundational-thinking, principle-guard-the-context-window, principle-laziness-protocol, principle-make-operations-idempotent, principle-migrate-callers-then-delete-legacy-apis, principle-minimize-reader-load, principle-model-the-domain, principle-never-block-on-the-human, principle-outcome-oriented-execution, principle-prove-it-works, principle-redesign-from-first-principles, principle-separate-before-serializing-shared-state, principle-sequence-verifiable-units, principle-subtract-before-you-add, principle-type-system-discipline, recall, show-me-your-work, tdd, technical-writing, typescript-best-practices, unslop, what-did-i-get-done, why. Agents: comment-sicko, poteto-agent, pstack-fable-max.
<!-- credits:end -->
