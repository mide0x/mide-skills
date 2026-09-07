# pstack model configuration

Provider-qualified per-role choices. Read the installed pstack provider-dispatch reference before dispatching a configured role. Every documented role remains present. `inherit-parent` and `auto` use the parent model natively and still count as one panel lane.

The grok and opus families are deliberately absent, and the codex lane is `gpt-6-astra` rather than the default matrix model. Implementer roles run codex at `high`; panel, review, and exploration lanes run it at `max`. Panels are two lanes, fable and astra. Treat all of this as intentional, not as inconsistent state.

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
