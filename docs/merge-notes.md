# Merging the widget into myra-ai

Written for: the developer merging this demo into the `myra-ai` monorepo.

This repo is the chat widget built to the same conventions as `myra-ai`, so the merge is mostly
copying files into the matching folders. This page says which files go where, where the code
deliberately differs from `myra-ai`, and what `myra-ai` still has to provide.

## Where each part goes

| This repo | In myra-ai | Notes |
| --- | --- | --- |
| `packages/contracts/src/widget.ts` | `packages/contracts/src/widget.ts` | Replaces the old file. Keep widget types out of `contractRegistry` (the engine has no use for them). |
| `packages/contracts/src/common.ts`, `chat.ts` | same | Copied unchanged from myra-ai; nothing to do. |
| `server/src/widget/**` | `apps/api/src/widget/**` | Replaces `WidgetSitesService`, `widget-sites.*` and the static replies. |
| `server/src/admin/**` | `apps/api/src/admin/**` | New: the API the dashboard calls. |
| `server/src/common/**` | `apps/api/src/common/**` | Same files as myra-ai plus `tenancy.module.ts`; see the differences below. |
| `server/src/config/configuration.ts` | `apps/api/src/config/configuration.ts` | Same shape and env names; adds the `widget` and `admin` sections, drops `widget.sites`. |
| `server/scripts/migrate-tenant-ids.mjs` | `apps/api/scripts/` | Only for a database created by the older demo. |
| `client/widget/**`, `client/scripts/build-widget.mjs` | `apps/web/widget/**`, `apps/web/scripts/` | Replaces the iframe: delete `app/embed`, `middleware.ts`, `lib/widget-embed-policy.ts`, `components/chat-widget/chat-embed.tsx`, `chat-widget.tsx` and `public/widget.js`. |
| `client/src/components/chat-widget/**`, `hooks/use-chat.ts`, `lib/chat/**`, `lib/theme-vars.ts`, `lib/widget-appearance.ts` | same paths under `apps/web/src` | |
| `client/next.config.ts` (the `headers()` part) | `apps/web/next.config.ts` | CORS and cache headers for the published widget files. |
| `packages/chatbot-widget/**` | `packages/chatbot-widget/**` | The npm package. |

Widget dependencies to add to `apps/web`: `esbuild`, `@tailwindcss/cli`, `react-markdown`,
`socket.io-client`, `lucide-react`; dev: `vitest`. To `apps/api`: `@nestjs/jwt`, `@nestjs/config`
(already there) and `zod` (already there). Use `@nestjs/jwt@^11` with Nest 11.

## Where this differs from myra-ai, on purpose

1. **`tenantPlugin` stamps the tenant in `validate`, not only `save`.** myra-ai's version marks
   `tenantId` as `required` but stamps it in `pre('save')`. Mongoose checks `required` first, so
   `create({ ... })` without an explicit `tenantId` fails with "tenantId is required". myra-ai's
   `create` methods are still stubs, so it has not been hit yet. Fixed in
   `common/plugins/tenant.plugin.ts`, with a test on a real model (`tenant.plugin.spec.ts`).
   Take this file over theirs.
2. **`TenantGuard` ignores non-HTTP contexts** (one line). `APP_GUARD` also runs for socket events,
   which have no HTTP headers.
3. **A `TenancyModule`** provides the single `TenantContextService` to every module. myra-ai
   registers it in `AppModule`; other modules need it too, and it must stay one instance.
4. **Two deliberate unscoped queries**, both marked `skipTenant: true` in `site.service.ts`: finding
   a site by its public token (that is how the tenant is discovered) and listing every site's
   origins for CORS. Everything after the token lookup runs inside
   `tenantContext.run(site.tenantId, …)`. Review these two first.
5. **The widget's HTTP and socket entry points do not use the tenant header.** `WidgetController` is
   `@SkipTenant()` and takes the tenant from the site; the gateway takes it from the verified
   session token. This is stronger than the unverified `x-tenant-id` header (see SECURITY.md).
6. **Config defaults:** the port falls back to `PORT`, then 4000 (myra-ai uses 3001), and
   `mongodb.dbName` is only passed when `MONGODB_DB` is set, so a database named in the URI is kept.
7. **Module format.** This demo is ESM (Nest 12) and imports end in `.js`. myra-ai is CommonJS
   (Nest 11); the `.js` suffixes still resolve there. Verified: with Nest 11 as CommonJS, all server
   tests pass and the server boots with every route mapped. The only change needed is `main.ts`,
   which uses a top-level `await` (myra-ai already has its own `main.ts`; keep theirs and add the
   few lines that register CORS and the socket adapter).

## What myra-ai still has to provide

- **The engine's `POST /chat`.** `EngineAnswerProvider` already calls it with myra-ai's own
  `ChatRequest` and parses `ChatResponse` (answer plus citations), so no contract change is needed
  to start. Set `ANSWER_PROVIDER=engine`. **Gap:** `ChatRequest` has a `tenantId` but no site, so a
  tenant with several sites cannot restrict retrieval to one. Add an optional `siteId` (or
  `sourceIds`) to `ChatRequest`, then pass it in `engine-answer.provider.ts`.
- **Retrieval for the direct-Gemini path.** `RagService.retrieve()` returns nothing today. Either
  stay on the engine provider, or implement it against Qdrant (filter by tenant and site).
- **Linking a crawl to a site.** `Source` (what to crawl) and `Site` (where the widget runs) are
  separate. Store the site (or source) id on each stored chunk so answers can be limited to it.
- **Real admin login.** `AdminGuard` is a shared-key placeholder. Replace it with the dashboard's
  authentication and take the tenant from the logged-in user, not from `x-tenant-id`.
- **Redis, when more than one API server runs.** `RateLimitService` is in memory behind an `async`
  interface (`checkAll`), so only its body changes. The socket also needs
  `@socket.io/redis-adapter`.
- **A `tenants` record per customer.** The `tenants` collection here holds `plan`,
  `monthlyMessageLimit` and `status`; `ensureTenant` creates one on first use. Move this to
  wherever myra-ai keeps companies.

## How to check it still works

```bash
cd packages/contracts && npm test       # the shared schemas
cd server && npm test                    # tenancy, admin API, limits, gateway, providers
cd client && npm test && npm run lint    # Markdown safety, layout, theme rules
cd client && npm run build:widget        # prints the sizes; fails if the loader is over budget
```

For a real run, start the server, create a site with `POST /admin/sites`, save some settings with
`PATCH /admin/sites/:id/settings`, and open a page that has only the snippet it returned.

## Known gaps, so nobody assumes otherwise

- Usage counts **messages**, not tokens, and there are no hourly spend alerts; the 80% warning is a
  log line.
- SRI protects the **loader**. The chat file is content-hashed by name and fetched by the loader,
  but the browser does not verify it separately.
- Limits are per server process until Redis is added.
- Fonts come from Google Fonts, so a site with a strict CSP needs `fonts.googleapis.com` allowed.
