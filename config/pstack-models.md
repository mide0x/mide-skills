# pstack model configuration

Provider-qualified per-role choices. Read the installed pstack provider-dispatch reference before dispatching a configured role. Every documented role remains present. `inherit-parent` and `auto` use the parent model natively and still count as one panel lane.

Deviation (2026-09-02): the grok family is deliberately absent. No Grok CLI is installed and no Grok subscription exists. A future /setup-pstack rerun should treat the missing family as intentional, not as inconsistent state.

Deviation (2026-09-07): the codex lane is `gpt-6-astra`, not the matrix's `gpt-5.6-sol`. The runner passes `--model` through unchanged and both efforts were probed live (`codex exec --model gpt-6-astra`). Implementer roles run it at `high`; panel, review, and exploration lanes run it at `max`. The opus family is also deliberately absent: every panel that carried it already carries fable, and the two are the same family, so the opus lane was pure token cost. Panels are two lanes (fable + astra). Treat all of this as intentional, not as inconsistent state.

feature, refactoring: codex:gpt-6-astra@high
bug-fix: codex:gpt-6-astra@high
perf-issue: codex:gpt-6-astra@high
hillclimb: codex:gpt-6-astra@high
judgment and prose: claude:fable@max
hardest tasks: claude:fable@max
how explorer: codex:gpt-6-astra@max
how explainer: claude:fable@max
how critics: claude:fable@max, codex:gpt-6-astra@max
why investigators, synthesizer: inherit-parent
reflect tooling, judgment, divergent, synthesizer: inherit-parent
arena runners: claude:fable@max, codex:gpt-6-astra@max
arena cross-judge pool: claude:fable@max, codex:gpt-6-astra@max
swarm workers: codex:gpt-6-astra@high
architect runners: claude:fable@max, codex:gpt-6-astra@max
interrogate reviewers: claude:fable@max, codex:gpt-6-astra@max
