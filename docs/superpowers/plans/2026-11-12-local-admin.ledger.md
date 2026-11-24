# SDD ledger — plan: docs/superpowers/plans/2026-11-12-local-admin.md

Ruling: This workspace has no `.git` directory, so a Git worktree, branch, commits, and git-based rollback are unavailable — implement directly in the approved project folder and preserve original content files until the migrated site builds — cost if wrong: partial edits are less convenient to revert, so staged migrations and file backups are required.

Ruling: The project owner explicitly requires production build and local page inspection; keep checks focused on those plus targeted built-in Node behavior checks for file-writing security — no external test framework or broad suite — cost if wrong: an untested behavior may need manual repair.

Task 1: complete — moved all editable public content to categorized JSON files, added typed local readers, and migrated public renderers. The legacy `src/data/portfolio.ts` copy was removed after migration.

Task 2: complete — added a dev-only loopback middleware, same-origin mutations, local JSON/image storage, atomic writes, and validation. Storage and migration checks pass with Node's built-in test runner.

Task 3: complete — built `/admin/` with settings, About, Contact, category/work editors, image controls, template/block ordering, and live pre-save preview. Verified entry opens in a new tab and the editor loads in the local browser.

Task 4: complete — removed Sanity/Cloudflare/Worker code and dependencies, retained the ignored root `.env` and `studio/.env` files without reading them, switched to static output, and updated docs/Pages workflow. The remote Sanity project was not accessed or changed.

Task 5: complete — 8 targeted Node tests pass; `npm run build` produced all 28 public pages; production `dist/` has no Sanity, Worker, `/admin/`, or admin API references. Browser checks verified the dev-only link opens `/admin/` in a new tab, the editor loads, work title save/restore works, background zoom/position previews update, and detail blocks reorder. Temporary values were restored. Narrow-screen CSS breakpoints are present but were not separately inspected in a resized browser viewport.
