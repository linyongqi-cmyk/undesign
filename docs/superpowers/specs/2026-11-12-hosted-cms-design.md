# Portfolio Hosted CMS Design

**Status:** Ready for user approval  
**Scope:** Content architecture and publishing workflow for the LIN YONGQI portfolio.

## Intent

Give the portfolio owner a browser-based editing space for nearly all changing site content: works, images, detail copy and sections, home backgrounds, profile text, contact information, and category labels. Keep the public site fast and preserve its current visual identity.

The current project is an Astro static site deployed to GitHub Pages. Portfolio data is maintained in `src/data/portfolio.ts`; images are stored in categorized folders under `public/images/`; the deployment workflow builds on pushes to `main` and manual dispatch.

## Goals

- Manage projects and research entries without editing TypeScript: title, category, type, date, card image, visibility, order, details, and image galleries.
- Edit long-form copy as paragraphs with headings, links, and inline images.
- Choose a detail-page layout from a small set of authored templates, and arrange supported content sections within the chosen layout.
- Manage homepage background images, rotation order, focal point, zoom, and timing.
- Manage existing About content in Japanese and Chinese, plus profile facts, portrait, contact links, category labels, and page metadata.
- Publish content changes through the existing static build and GitHub Pages deployment flow.
- Keep editor-only credentials out of browser code and the public repository.

## Non-goals

- Let editors write arbitrary HTML, CSS, JavaScript, or new page templates in the CMS.
- Redesign the current portfolio or make its layout visually different as part of the CMS migration.
- Add general multi-user approval roles or localization beyond languages already present, unless required after review.
- Change the public production site to server-side rendering in the first phase.

## Constraints

- Public output remains a static Astro site and keeps the current category and project routes.
- Publishing from Sanity must trigger a new GitHub Actions build because GitHub Pages does not fetch CMS content at request time.
- The CMS model must support the current About page's Japanese and Chinese text and the mixed-language project titles already in the portfolio.
- Existing content and image files remain available until their CMS copies have been verified in local and deployed builds.

## Approaches

1. **Git-backed editor (considered, not selected):** Decap or Keystatic edits repository content and images. It fits a static build and keeps content versioned beside code, but authentication and the desired flexible rich-text/page-section model require extra configuration. Decap's editorial workflow uses branches and pull requests; Keystatic supports GitHub storage and Markdoc fields.
2. **Hosted headless CMS (selected: Sanity):** Store structured content and media in a managed CMS; Astro reads published data at build time. A GROQ webhook triggers the existing GitHub Actions deployment after published content changes. This offers the best fit for structured project records, rich text, reusable page sections, and a media library while retaining the static public site. Sanity's Astro visual-editing overlay requires server-rendered pages, so direct click-to-edit is not included in the first phase.
3. **Custom backend (considered, not selected):** Build a private admin UI, API, database, media storage, and authentication. This could match a bespoke editing workflow exactly, but introduces ongoing hosting, security, and maintenance work.

## Proposed content model

- **Site settings (singleton):** homepage cover list and per-image crop/zoom/order, rotation interval, site title/description, logo asset, and navigation labels.
- **Categories:** stable route slug, editable display label, sort order, and visibility.
- **Works:** stable route slug, category reference, title, type, date, cover image, alt text, sort order, publication state, chosen detail template, gallery, and ordered content sections.
- **Research entries:** title, type, ordering, publication state, and rich-text body; allow image sections where needed.
- **About/profile (singleton):** portrait, profile facts, and Japanese/Chinese biography paragraphs.
- **Contact settings (singleton):** contact labels, destinations, and visibility.
- **SEO/page metadata:** editable titles and descriptions with useful defaults from the project or work title.

Detail templates are authored in the site code and exposed as a limited choice in the CMS (for example, standard project, gallery-led, and research essay). Each template accepts a controlled list of content blocks such as rich text, image with caption, gallery, image-and-text, and quote. Editors can choose a template and order supported blocks; adding a new block type or changing the visual design remains a code change.

## Publishing and preview

- Editors make drafts, preview the rendered draft page, then publish it in Sanity Studio when ready. Preview is read-only; editors do not need to click page elements to edit fields.
- Draft preview uses a protected preview runtime or deployment that can fetch Sanity draft content. The public production site remains statically generated on GitHub Pages. The preview hosting target and URL are implementation details; the preview must not expose unpublished content publicly.
- A webhook filtered to published content changes calls a protected GitHub Actions `workflow_dispatch` endpoint. Draft keystrokes do not trigger production deployments.
- Use a least-privilege GitHub credential stored only in the CMS webhook configuration or a secure relay; never embed it in Astro client code. Validate webhook origin and duplicate deliveries.
- GitHub Actions installs dependencies, fetches published Sanity content during the build, generates the static site, and deploys to GitHub Pages.
- Local development uses a non-production dataset or draft preview mode.
- The CMS Studio is hosted separately from the static Pages output. Direct click-on-page visual editing is deferred because Sanity's Astro visual editing requires SSR.

## Migration and rollout

1. Define schemas and a local development dataset, then implement read-only Astro queries against sample content.
2. Migrate current categories, works, research entries, profile/contact content, home covers, and image assets into Sanity.
3. Render local routes from CMS data and compare them with the existing site before removing the TypeScript data source.
4. Configure publish-triggered builds and verify that failed builds leave the last successful Pages deployment intact.
5. Keep the original assets until migration and route coverage are verified; then remove only files proven unused.

## Success criteria

- The owner can add, edit, reorder, unpublish, and republish a work through the CMS, including its cover, gallery, and paragraph-based details.
- The owner can update homepage background images and their scale/focal position without code changes.
- The owner can view a protected rendered draft preview before publishing, and unpublished drafts are not accessible from the public site.
- Existing About language switching, contact destinations, category routes, and visual treatment continue to work.
- Publishing a CMS change triggers a static build and deployment without a manual code commit.
- Required fields, unique route slugs, image alt text, and template/block compatibility are validated before publish/build.

## Confirmed decisions

- **CMS provider:** Sanity.
- **Template management:** editors choose from predefined templates and reorder supported content blocks; creating a new template remains a code change.
- **Preview:** an editor-facing form and a protected, read-only rendered preview before publishing; click-to-edit visual editing is not required.

## Builder calls

- Keep the public production website statically generated on GitHub Pages.
- Provide a separate protected runtime or preview deployment for draft rendering, since the static public site cannot read draft content per request. Select its hosting target and URL during implementation without exposing draft data.
- Use Sanity Studio as a separately hosted editing interface and keep its tokens out of the public frontend.

## References

- [Sanity and Astro introduction](https://www.sanity.io/docs/astro/introduction)
- [Sanity visual editing with Astro](https://www.sanity.io/docs/astro/astro-visual-editing)
- [Sanity GROQ-powered webhooks](https://www.sanity.io/docs/content-lake/webhooks)
- [GitHub workflow dispatch API](https://docs.github.com/en/rest/actions/workflows)
- [Keystatic GitHub mode](https://keystatic.com/docs/github-mode)
- [Decap editorial workflow](https://decapcms.org/docs/editorial-workflows/)
