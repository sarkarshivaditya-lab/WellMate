# Natural Language → Engineering Command Chain

Use this process to translate normal user language into controlled execution.

## Input

The user's natural-language request.

## Transform

### 1. Intent

State exactly what the user wants changed.

### 2. Scope

Determine:

- feature
- subsystem
- files likely affected
- files explicitly protected

### 3. Constraints

Extract:

- explicit user constraints
- CLAUDE.md constraints
- locked systems
- local-first requirements
- offline requirements
- platform requirements

### 4. Research

Determine whether external research is necessary.

Use authoritative sources first.

### 5. Inspection

Inspect the actual repository before deciding implementation details.

### 6. Execution plan

Convert intent into a sequence:

inspect → modify → validate → review → record → commit

### 7. Command chain

Commands should be:

- explicit
- reversible where possible
- minimal
- ordered
- observable

### 8. Verification

Every implementation chain must end with concrete validation.

### 9. Reporting

Report:

- changed files
- what changed
- architecture impact
- validation performed
- remaining risks
- commit/rollback point

Never convert ambiguous language into destructive commands without confirmation.
