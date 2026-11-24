# SDD ledger — plan: docs/superpowers/plans/2026-11-24-admin-canvas-remediation.md

## Setup

- Baseline: working tree has no Git metadata; front-end 1.8.4, admin 1.8.8; Astro listeners on 4321-4324 (4321 uses this project, others use temp copies).
- Baseline `npm run check`: 0 errors, 0 warnings, 16 hints across 74 files.
- Baseline `npm run build`: content validator passed 28 files; 28 static pages built.
- Backup: `/private/tmp/linyongqi-homepage-admin-canvas-20261124/before/project-before.tar.gz`; isolated copy: `/private/tmp/linyongqi-homepage-admin-canvas-20261124/work` (excludes node_modules, dist, .astro, backups, .superpowers, .wrangler, 临时图片库).
- The referenced `交接与修改记录写作指南.md` is absent from this workspace; follow the supplied AGENTS.md format.
- No single design spec is named by the plan; plan is the execution authority. Rulings remain provisional where runtime evidence is unavailable.
- Pre-flight: task 1 produces cross-restart pending-media protection consumed by task 4 cleanup; task 2 produces link rewrites consumed by task 3 conflict versioning and task 4 batch validation; task 3 version preconditions are consumed by task 4 atomic batch commit; task 5 editor rendering shares components with tasks 6 and 8; tasks 7/9 affect client save/history state changed in task 3/4. Sequence per plan and validate shared interfaces after each.

## Execution status

- Implemented plan items 1–9. Added shared-link rewrite, pending-media manifest, content versions, batch validation/rollback, URL parsing for online video, shared Gallery 2 conversion, template transition helper, dead canvas cleanup, and baseline-derived move dirtiness.
- Follow-up discovered that move/rename rewrites could overwrite newer reference work from another tab. Added client version maps to both requests and server checks only for records that actually reference the target. Integration and storage tests verify HTTP 409 leaves source/reference unchanged.
- `node --test scripts/*.test.mjs src/lib/admin/*.test.mjs src/lib/content/*.test.js src/lib/content/*.test.mjs`: 49/49 pass. `npm run check`: 0 errors, 0 warnings, 15 hints. `npm run build`: validates 28 content files and emits 28 pages.
- Browser read-only inspection on 4321 opened Research Log and admin for the same Fractal work. Existing PID 63370 could not be restarted from this execution environment. The isolated copy did launch on 4331 after approved sandbox escalation; GET /admin/ returned 200, GET /works/research returned 500 with Astro ClientRouter virtual-style compile-metadata error caused by the symlinked node_modules path, and the CUA browser could not connect to 4331. Latest grouped iframe aspect-ratio change therefore remains visually unverified.
- Still unverified manually: real GIF/MP4 upload + save/reload + cross-tab cleanup; complete two-tab UI flows; failed batch retry against disk; link click after move; move/rename/undo combinations; template switch roundtrip; canvas/video comparison after reload at desktop/tablet/mobile. No real content JSON was modified.
- Final product versions: frontend 1.8.4 (public output semantics unchanged), admin 1.9.0. Not published or pushed.
- No Git metadata; pre-change archive: `/private/tmp/linyongqi-homepage-admin-canvas-20261124/before/project-before.tar.gz`. Isolated work copy: `/private/tmp/linyongqi-homepage-admin-canvas-20261124/work`.
