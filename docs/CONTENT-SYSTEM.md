# Dream Protocol website and publishing system

The site is generated as ordinary HTML. Search engines and visitors receive complete content without waiting for JavaScript. The homepage, service pages, industry examples, regional hub, pricing, and resource library share one layout and navigation.

## Editing

- `content/services.mjs`: service scope, pricing, industry copy, and related service paths.
- `content/guides.mjs`: original guides and their publication dates.
- `content/partials/`: the retained homepage demo, industry interaction, and contact form markup.
- `scripts/build.mjs`: layouts, page relationships, structured data, sitemap, RSS, and publication selection.
- `assets/site.css`: shared responsive design.
- `assets/site.js`: interior-page navigation and the existing FormSubmit delivery behavior.

Run `npm run build`, `npm run check`, and `npm test` after editing. `npm run preview` serves the result at http://127.0.0.1:4173. No package installation or API key is needed to build existing content. New AI-authored content requires the repository secret described below.

The original homepage analyzer and Vapi code, public configuration, and lead recipient are retained. Actual voice calls require the production origins configured with Vapi; local checks cannot validate microphone audio or live delivery. `INTEGRATIONS.md` describes the existing setup.

## Automatic content updates

Two guides launch immediately. Six more are prepared for September 21 through October 26, 2026, one per week. A guide with `status: 'scheduled'` appears on the first successful build on or after its `publishOn` date (UTC). Every build refreshes the resource library, contextual service links, homepage reading cards, sitemap, and RSS together. Publication dates are not rewritten just to make pages look newer.

Add a new original guide with a unique slug, descriptive title, summary, service relationship, sections, checklist, and publication date. Use `status: 'draft'` while working. Only change to `scheduled` when the content is complete and reviewed. Do not add invented results, clients, ratings, revenue, locations, or qualifications. Update price references when the offer changes. The resource library identifies AI assistance rather than claiming unperformed human review.

### Researched weekly articles

The Monday workflow now attempts one additional, original researched article per UTC week. The six prepared guides retain their dates, so the launch period can publish a prepared guide and a researched guide in the same week. Afterwards, the AI process continues without a finite prewritten queue. Manual workflow runs also attempt generation, but never make another paid attempt in a week with a saved reservation. Pushes and pull requests only build existing content.

`scripts/editorial.mjs` uses the OpenAI Responses API with `gpt-5.4-mini`. The first request researches a distinct business question with web search restricted to official Microsoft, Google Workspace, OpenAI, HubSpot, and Salesforce domains. The second writes structured JSON from the research and approved service scope. A separate third request searches and reviews the cited evidence. It must approve the article and retrieve every cited source before publication. These are automated quality checks, not a claim of human review or a guarantee of factual accuracy.

Local checks reject missing citations, unsafe URLs, near-identical titles, invalid service relationships, malformed content, thin articles, and prohibited claims. The complete site build, link/metadata checks, and tests must also pass before an article is committed. Every article carries source links beside its sections and a visible AI-assistance disclosure. All model output is JSON data, escaped by the existing templates; it never becomes executable JavaScript or raw HTML.

Approved articles persist in `content/generated/YYYY-MM-DD.json`, using the Monday of their UTC week. Reservation and outcome records persist in `content/runs/`. The workflow commits a reservation **before** calling the paid service, then commits only approved, validated content. Three API requests maximum, seven web-tool calls maximum, bounded input/output, timeouts, and no automatic API retries limit runaway usage. This is a request limit, not an exact dollar cap. Model and tool usage is billed by OpenAI separately from ChatGPT. Configure the API account's spending controls independently.

### One-time AI connection

1. Create an API key in your OpenAI project with permission to create Responses; ensure API billing and model access are active.
2. GitHub repository Settings → Secrets and variables → Actions → New repository secret.
3. Name it `OPENAI_API_KEY`, paste the key privately, and save. Never commit it or paste it into an issue/chat.
4. Actions → Build, check, and publish website → Run workflow on `main`.
5. Confirm the editorial and deployment jobs complete, then inspect the new resource page and its cited sources.

Missing credentials fail the editorial job before reserving a week; existing content can still build and deploy. Failed research, review, or validation holds the new article and marks the workflow failed for attention while retaining the existing site. GitHub workflow notifications follow the owner's GitHub notification settings; no external email integration is added. Inspect the Actions log and weekly run record. A failed attempt is deliberately not retried automatically. To authorize another attempt after fixing the cause, remove that week's run record in a reviewed commit and run the workflow again; this can incur another API charge.

To pause paid generation, remove `OPENAI_API_KEY`; normal builds and prepared publication still work. To withdraw an article, remove its generated JSON and run the workflow. The packaged site is rebuilt from current sitemap paths, so withdrawn pages are excluded. Do not delete the weekly reservation when withdrawing an article unless another paid attempt is intended.

## Deployment activation

The `site.yml` workflow tests pull requests without deploying them. On `main`, it builds and deploys through GitHub Pages after pushes, manual runs, and the Monday 16:17 UTC schedule. Scheduled runs may be delayed by GitHub. GitHub can disable scheduled workflows in inactive public repositories after 60 days; review the Actions page if publication stops.

Before first production deployment, set **Repository Settings → Pages → Build and deployment → Source → GitHub Actions**. Preserve the custom domain `dreamprotocol.ai` and HTTPS configuration. This is a required repository setting; adding the workflow alone does not switch it. Confirm the `github-pages` environment permits deployment from `main`.

The workflow packages the generated site without editorial source, drafts, scripts, or repository metadata. It preserves the existing `/btc/` files as an independent destination without adding them to the commercial SEO sitemap. Publication builds use current `main` after the editorial job, preventing a reservation or article commit from being lost on the next deployment. A content-generation failure does not block deployment of already approved content.

Rollback: revert the merge commit on `main` and run the previous known-good deployment. If returning to branch publishing, restore the original Pages source setting. Do not reset shared history.

## Search and measurement

Verify ownership in Google Search Console and submit https://dreamprotocol.ai/sitemap.xml. No verification token or analytics property was available during this build, so neither is invented. Existing campaign attribution is retained and sent with inquiries. It records landing page and campaign context but is not a replacement for full traffic/conversion analytics.

Prioritize qualified inquiries and demo starts, then inspect query impressions, clicks, and indexed pages. Use actual search data to decide what to deepen next. Service-area content describes all nine Bay Area counties without asserting a physical office in each. Industry workflows are explicitly examples, not client case studies.

References:
- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- https://developers.google.com/search/docs/fundamentals/using-gen-ai-content
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
