---
name: wellmate-verification
description: Verify WellMate changes before they are considered complete.
---

# WellMate Verification

A change is not complete merely because the code compiles locally.

## Required verification

For TypeScript application changes:

- run the relevant TypeScript/build command
- inspect compiler errors
- inspect lint output where applicable
- inspect the final Git diff

## Architecture verification

Confirm:

- local-first behavior remains intact
- offline behavior remains intact
- Convex is not accidentally made authoritative
- authentication is not accidentally required for local functionality
- locked files were not modified without permission
- no unnecessary dependency was introduced

## UI verification

For UI changes confirm:

- mobile layout
- touch targets
- responsive behavior
- accessibility
- animation behavior
- reduced-motion behavior where relevant
- no visual regression in surrounding components

## Completion gate

Do not claim completion until:

1. implementation exists
2. validation has been performed
3. diff has been reviewed
4. known failures have been reported
5. scope remains aligned with the request
