# SDD ledger — plan: docs/superpowers/plans/2026-11-20-component-copy-paste.md

Pre-flight: Task 1 produces copy/paste data helpers consumed by Task 2; API signatures and zone representation match. Reviewed current Puck data: root drop zone is `root`/`data.content`, named drop zones are in `data.zones`.

Ruling: The supplied workspace has no `.git` directory, so a linked worktree and git-based task scripts cannot run — implement in the explicitly writable shared project directory, keeping changes scoped to this feature — cost if wrong: changes are not isolated from other local edits.

Task 1: complete — `node --test src/lib/admin/component-clipboard.test.js` → 4/4 passing. RED was observed with three expected assertion failures before implementing snapshot, nested-zone remapping, and insert helpers.

Task 2: complete — Puck copy/paste events keep a page-session clipboard across work editor remounts. Copy writes a small text marker to the native clipboard so paste shortcuts still produce a browser paste event when the system clipboard was empty; text-edit targets and text selections bypass the component handler. Browser verification: ⌘C from Product「1」, switch to Product「樓」, ⌘V inserts the image; Undo removes it. Native copy/paste in the Type field preserves `Lighting`.

Task 3: complete — `npm run build` generated 28 pages. Handoff and modification records updated; admin version bumped to 1.2.6, frontend remains 1.3.3. No publish/push. Browser showed one unsaved item after undo; save was not clicked. Redo was not verified.
