# Dream Protocol website and publishing system

The site is generated as ordinary HTML. Search engines and visitors receive complete content without waiting for JavaScript. The homepage, service pages, industry examples, regional hub, pricing, and resource library share one layout and navigation.

## Editing

- `content/services.mjs`: service scope, pricing, industry copy, and related service paths.
- `content/guides.mjs`: original guides and their publication dates.
- `content/partials/`: the retained homepage demo, industry interaction, and contact form markup.
- `scripts/build.mjs`: layouts, page relationships, structured data, sitemap, RSS, and publication selection.
- `assets/site.css`: shared responsive design.
- `assets/site.js`: interior-page navigation and the existing FormSubmit delivery behavior.

Run `npm run build`, `npm run check`, and `npm test` after editing. `npm run preview` serves the result at http://127.0.0.1:4173. No package installation or API key is needed for generation.

The original homepage analyzer and Vapi code, public configuration, and lead recipient are retained. Actual voice calls require the production origins configured with Vapi; local checks cannot validate microphone audio or live delivery. `INTEGRATIONS.md` describes the existing setup.

## Automatic content updates

Two guides launch immediately. Six more are prepared for September 21 through October 26, 2026, one per week. A guide with `status: 'scheduled'` appears on the first successful build on or after its `publishOn` date (UTC). Every build refreshes the resource library, contextual service links, homepage reading cards, sitemap, and RSS together. Publication dates are not rewritten just to make pages look newer.

Add a new original guide with a unique slug, descriptive title, summary, service relationship, sections, checklist, and publication date. Use `status: 'draft'` while working. Only change to `scheduled` when the content is complete and reviewed. Do not add invented results, clients, ratings, revenue, locations, or qualifications. Update price references when the offer changes. The resource library identifies AI assistance rather than claiming unperformed human review.

The queue is finite, not an unlimited AI article generator. The workflow reports remaining guides and warns when fewer than two remain. Replenish the queue from actual business questions, project lessons approved for publication, and Search Console queries. No external provider subscription or automatic paid generation is introduced.

## Deployment activation

The `site.yml` workflow tests pull requests without deploying them. On `main`, it builds and deploys through GitHub Pages after pushes, manual runs, and the Monday 16:17 UTC schedule. Scheduled runs may be delayed by GitHub. GitHub can disable scheduled workflows in inactive public repositories after 60 days; review the Actions page if publication stops.

Before first production deployment, set **Repository Settings → Pages → Build and deployment → Source → GitHub Actions**. Preserve the custom domain `dreamprotocol.ai` and HTTPS configuration. This is a required repository setting; adding the workflow alone does not switch it. Confirm the `github-pages` environment permits deployment from `main`.

The workflow packages the generated site without editorial source, drafts, scripts, or repository metadata. It preserves the existing `/btc/` files as an independent destination without adding them to the commercial SEO sitemap. Published content is rebuilt from source on each deployment; scheduled publication does not create repository commits.

Rollback: revert the merge commit on `main` and run the previous known-good deployment. If returning to branch publishing, restore the original Pages source setting. Do not reset shared history.

## Search and measurement

Verify ownership in Google Search Console and submit https://dreamprotocol.ai/sitemap.xml. No verification token or analytics property was available during this build, so neither is invented. Existing campaign attribution is retained and sent with inquiries. It records landing page and campaign context but is not a replacement for full traffic/conversion analytics.

Prioritize qualified inquiries and demo starts, then inspect query impressions, clicks, and indexed pages. Use actual search data to decide what to deepen next. Service-area content describes all nine Bay Area counties without asserting a physical office in each. Industry workflows are explicitly examples, not client case studies.

References:
- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- https://developers.google.com/search/docs/fundamentals/using-gen-ai-content
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
