# Legacy Code Archaeology Skill

Use when modifying old, duplicated, transitional, or partially migrated code.

Process:
- Identify the canonical path and all legacy/parallel paths.
- Search references before deleting, renaming, or changing signatures.
- Distinguish dead code from dormant compatibility code, fallback code, mock code, and migration infrastructure.
- Read nearby documentation, comments, environment switches, scripts, and CI before judging code as obsolete.
- Preserve observable behavior first; refactor second.
- When replacing an implementation, create a compatibility seam where useful and migrate consumers deliberately.
- Do not infer that a file is unused from naming alone; prove it from repository references and runtime wiring.
- Record architectural decisions and deprecations in .memory.
