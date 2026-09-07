# mide-skills

This repository is mide's source of truth for personal Claude Code and Codex skills and Claude Code subagents. The manifest records each entry's source and the upstream commit used for vendored copies. Local skills are credited to mide.

Install with Node 22 or newer and Git:

```sh
npx github:mide0x/mide-skills install
```

From a checkout, run `npm install`, then `node bin/cli.mjs <command>`.

- `install [--tools claude,codex] [--yes]` discovers the checkout, verifies providers, and links entries into available tools.
- `update [--yes]` pulls the saved checkout with `git pull --ff-only` and reinstalls into all available tools without prompting.
- `pick <source> [--subdir <path>]` selects and vendors upstream skills and agents through interactive checklists.
- `add <name>` scaffolds and registers a local skill.
- `doctor` checks links, model sheets, and startup integration for every available tool.

Use `pick open-pstack` for pstack skills, or pass another git URL and its skill directory with `--subdir`. New sources require an attribution. Selection includes skills referenced through relative sibling paths. Imported Markdown loses the `pstack:` plugin prefix. Unchecking an entry removes its vendored copy. Imports refuse collisions with another source or unregistered content. Source symlinks are unsupported. Sources remain in the registry after their last entry is removed.

Use `add my-skill` for your own skill, then edit `skills/my-skill/SKILL.md`. Names use lowercase letters, digits, underscores, and hyphens. Run `install` after adding or picking entries. Commit and push repository changes yourself, then run `npx github:mide0x/mide-skills update` on other machines.

Install uses the current checkout or a parent checkout when its package name is `mide-skills`. Elsewhere it clones or updates `~/.mide-skills`. It saves only the absolute checkout path in `~/.config/mide-skills/state.json`. Keep that checkout in place because installed entries are symlinks. Pick and add require a checkout as the current directory or a parent. Doctor uses the current checkout or the saved path.

Claude skills link into `~/.claude/skills` and agents into `~/.claude/agents`. Codex skills link into `~/.agents/skills`. Real files and directories at those destinations are conflicts that the owner moves or removes. Installation replaces outdated symlinks and prunes removed entries only when their links resolve inside the checkout's corresponding skills or agents directory.

`config/pstack-models.md` is the shared model sheet. Installation copies it to `~/.claude/pstack-models.md` and `~/.codex/pstack-models.md`. Claude loads it through one `@~/.claude/pstack-models.md` line in `~/.claude/CLAUDE.md`. Codex receives its contents inside a managed marker block in `~/.codex/AGENTS.md`. Malformed Codex markers require manual repair.

Every provider named by a `provider:model@effort` descriptor must have its CLI on PATH. Missing providers stop installation with their required descriptors. The check verifies executable availability, not authentication or model access. `--tools` narrows installation targets and does not relax this check. The seeded sheet requires Claude and Codex. An explicitly requested missing target also stops installation.

<!-- credits:begin -->
- **open-pstack**: Lauren Tan (pstack), Eric Litman (open-pstack). Source: https://github.com/ericlitman/open-pstack. Skills: none. Agents: none.
<!-- credits:end -->
