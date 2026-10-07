# Myra Technolabs Chatbot Widget

An AI chat assistant you can drop into any website. A visitor clicks the chat button, asks a
question, and gets an answer from Google's Gemini, or from a company's own scraped website through
the Python engine. Every customer site has its own look, texts, prompt and limits, saved on the
server and managed through an admin API.

You can add it to a site in two ways:

- **One `<script>` tag.** Works on anything: plain HTML, PHP, WordPress, React, Next.js, you name it.
- **An npm package** with a `<ChatbotWidget />` React component, for React and Next.js projects.

Both look and behave the same, and both are styled from the same options (colours, title, subtitle
and so on) that you give them. Nothing is hard-coded to one brand.

## What's in this repo

| Folder | What it is |
| --- | --- |
| [`client/`](client) | The web app (Next.js) with the demo pages, and the source of the widget in [`client/widget/`](client/widget). `npm run build:widget` builds it into a tiny loader plus the chat (see below). |
| [`server/`](server) | The API (NestJS): site settings, the admin API, tenant isolation, limits and usage, and the live chat connection that gets answers from Gemini or the engine. |
| [`packages/contracts/`](packages/contracts) | `@myra/contracts`: the one set of shapes (config, settings, messages, socket events) the widget and the server share. |
| [`packages/chatbot-widget/`](packages/chatbot-widget) | The npm package for React and Next.js. See its [README](packages/chatbot-widget/README.md). |
| [`docs/`](docs) | Notes for the developer who merges this into the main myra-ai project. |

## How it works, in short

1. A customer's page loads the **loader** (`widget.js`, about 5 KB gzipped). It asks the server for
   the site's settings, using the site token, and draws the round chat button in the site's
   colours and position.
2. The first time a visitor opens the chat, the **chat file** (about 140 KB gzipped) loads. The
   whole chat lives inside a **Shadow DOM**: a sealed-off area with its own styles, so the
   customer's CSS can't change it and it can't change their page.
3. The visitor's message goes straight to the server over a socket. The server checks the site is
   on, the visitor isn't over a limit and the company still has messages left this month, then
   asks the answer provider (Gemini, or the engine) and streams the reply back with source links.
4. The conversation is stored on the server, per visitor. A page refresh, or a second tab, shows the
   same chat.

## The pieces, and who may see what

- **Tenants.** Every company is a tenant. All sites, visitors, conversations, messages and usage
  carry the tenant, and the database layer adds that filter to every query on its own
  (`tenantPlugin`), so one company can never read another's data.
- **Site token vs secret key.** The token (`st_…`) goes in the page and is not a secret. Each site
  also gets a secret key (`sk_…`), shown once when it is created or rotated; only a hash is kept.
- **Session.** The widget gets a 15-minute signed session from the server. It carries the tenant,
  site, visitor and website, and is renewed automatically. A token copied to another website
  doesn't work.

## Running it on your computer

You need:

- **Node.js 20.12 or newer** (this was built with Node 24).
- A **Gemini API key** (get one at <https://aistudio.google.com/apikey>).
- **MongoDB**, running and reachable. The server keeps sites, visitors and conversations there, and
  it won't start without it. Either install it locally (it then listens on
  `mongodb://localhost:27017`) or create a free cluster on MongoDB Atlas and use its connection
  string as `MONGODB_URI`.

### 1. Start the server

```bash
cd server
npm install
cp .env.example .env     # then open .env: paste your key after GEMINI_API_KEY= and check MONGODB_URI
npm run start:dev
```

It runs on <http://localhost:4000>. In development it also creates a demo site on first start (site
token `st_demo`, allowed on `localhost:3000`), so the demo pages work with no manual database setup.

### 2. Start the client

In a second terminal:

```bash
cd client
npm install
npm run dev
```

It runs on <http://localhost:3000>. The file `client/.env.local` needs these three lines
(they're already there in this repo):

```
NEXT_PUBLIC_CHAT_TRANSPORT=socket
NEXT_PUBLIC_WIDGET_KEY=st_demo
NEXT_PUBLIC_API_URL=http://localhost:4000
```

> `NEXT_PUBLIC_CHAT_TRANSPORT=socket` means "talk to the real server and Gemini". If you set it to
> `mock`, the chat gives fake canned replies instead, which is handy when you have no API key.

**Both must be running, and MongoDB too.** If the server is down, or the site isn't on the allowed list, the chat
button simply doesn't appear, because the widget first asks the server whether this site may use it.

`npm run dev` rebuilds `public/widget.js` for you each time it starts. If you change the widget's
code while it's running, run `npm run build:widget` (or `npm run build:widget -- --watch`) to
rebuild it.

## See it working

With both servers running, open either of these:

- **<http://localhost:3000>**: the home page. The chat button in the bottom-right corner is the real
  widget, added with a script tag and styled from its `data-*` attributes (navy theme).
- **<http://localhost:3000/embed-demo.html>**: a plain HTML page with the same script tag. This is
  what a customer's website looks like. Open the file in your editor too: it has a comment above
  the tag explaining every option.

Things to try: send a message, then refresh the page. The chat stays open and your messages are
still there.

## Adding the widget to a website

### With the script tag

Paste this just before `</body>`:

```html
<script
  src="https://YOUR-WIDGET-DOMAIN/widget.js"
  data-site-token="st_your_site_token"
  data-api-url="https://YOUR-API-DOMAIN"
  data-title="Myra Technolabs"
  data-subtitle="AI assistant"
  data-accent-color="#162E56"
></script>
```

Only `data-site-token` is required (and `data-api-url` unless the widget was built with a default API address). Everything else is optional.

| Attribute | What it does |
| --- | --- |
| `data-site-token` | Your site's public token (starts with `st_`). The old `data-key` still works as an alias. |
| `data-api-url` | Where the server lives. Optional: if you leave it out, the widget uses the API address it was built with (`NEXT_PUBLIC_API_URL` when you ran `npm run build:widget`). |
| `data-position` | Where the chat button sits: `bottom-right` (default), `bottom-left`, `bottom-center`, `top-right`, `top-left`, `top-center`, `left-center`, `right-center`. |
| `data-offset` | Gap in pixels between the button and the screen edge (default 24). |
| `data-width`, `data-height` | The largest size of the chat window, in pixels or CSS (for example `420` or `90vw`). |
| `data-container` | A CSS selector such as `#chat`. The chat then shows **inside that element** instead of floating, so you can put it in the middle of a page. |
| `data-title`, `data-subtitle` | Header title and the small line under it. |
| `data-greeting` | The bot's first message. |
| `data-placeholder` | Placeholder text in the message box. |
| `data-avatar-text` | One or two letters shown in the bot's avatar. |
| `data-accent-color` | The main colour: header, chat button, send button, your message bubbles, bot avatar. |
| `data-accent-text-color` | Text and icons drawn on top of the main colour. |
| `data-background-color` | Chat window and the bot's message bubbles. |
| `data-chat-background-color` | The area behind the messages. |
| `data-text-color` | Main text colour. |
| `data-muted-color` | Quieter text: timestamps and the placeholder. |
| `data-border-color` | Borders and divider lines. |
| `data-radius` | Corner style of the window, bubbles, buttons and launcher: `square`, `rounded` (default) or `pill`. |
| `data-font` | A Google Font name such as `Inter`. Loaded into the page and used by the chat. |

Colours can be anything CSS understands: `#162E56`, `rgb(22 46 86)`, `navy`, and so on.

**React, Next.js and tag managers:** you can also add the script from code. Create a `<script>`
element, set its `src` and `data-*` attributes, and append it to `document.body`.

### With the npm package (React / Next.js)

```bash
npm install @myra-technolabs/chatbot-widget
```

```tsx
import { ChatbotWidget } from '@myra-technolabs/chatbot-widget';

<ChatbotWidget
  siteToken="st_your_site_token"
  widgetUrl="https://YOUR-WIDGET-DOMAIN"   // where widget.js is hosted
  apiUrl="https://YOUR-API-DOMAIN"
  position="left-center"
  accentColor="#162E56"
  title="Myra Technolabs"
/>
```

Every script-tag option is a prop with the same meaning, written in camelCase
(`data-accent-color` becomes `accentColor`). Add `inline` to place the chat inside your layout
instead of floating. Full details are in the
[package README](packages/chatbot-widget/README.md).

### Using the package straight from a clone (before it's on npm)

The package is only a small loader. The chat itself comes from `widget.js`, so the **client and
server must be running (or deployed)** wherever the package is used. Then, in the project that
should use it:

```bash
# one-time: build the package (npm install in that folder does it for you)
cd packages/chatbot-widget && npm install

# in your other React / Next.js project
npm install /path/to/Chatbot-widget/packages/chatbot-widget
```

Point `widgetUrl` and `apiUrl` at your running client and server, and make sure that project's
address is in that site's allowed origins (see below).

The package isn't on npm yet. To publish it you need your own npm account:

```bash
cd packages/chatbot-widget
npm run build
npm publish --access public
```

## Managing sites (the admin API)

A site is a record in MongoDB. The admin panel creates and changes it through these endpoints.

**Authentication (a placeholder):** send `x-admin-key: <ADMIN_API_KEY>` and the company as
`x-tenant-id: <tenant>`. With no `ADMIN_API_KEY` set, the admin API is switched off. The main
project replaces this with its own login.

| Call | What it does |
| --- | --- |
| `POST /admin/sites` | Create a site: `{ name, allowedOrigins, settings? }`. Returns the token, a ready-to-paste snippet and the secret key (once). |
| `GET /admin/sites`, `GET /admin/sites/:id` | List or read this company's sites. |
| `PATCH /admin/sites/:id` | Change `name`, `allowedOrigins`, or `status` (`disabled` is the emergency switch). |
| `PATCH /admin/sites/:id/settings` | Change some settings; whatever isn't sent keeps its value. |
| `PUT /admin/sites/:id/settings` | Replace all settings with exactly what is sent. |
| `POST /admin/sites/:id/rotate-secret` | New secret key (shown once); the old one stops working. |
| `GET /admin/usage` | This month's messages, the company's allowance, and a count per site. |

Everything is checked against the shared contract before it is saved: a bad colour, an unknown
setting or a website address with a trailing slash is refused with a precise message.

```bash
curl -X POST http://localhost:4000/admin/sites \
  -H "content-type: application/json" -H "x-admin-key: $ADMIN_API_KEY" -H "x-tenant-id: acme" \
  -d '{ "name": "Acme", "allowedOrigins": ["https://acme.com"] }'

curl -X PATCH http://localhost:4000/admin/sites/<id>/settings \
  -H "content-type: application/json" -H "x-admin-key: $ADMIN_API_KEY" -H "x-tenant-id: acme" \
  -d '{ "theme": { "accent": "#162E56", "radius": "pill" }, "copy": { "title": "Acme Support" } }'
```

**What a site's settings can hold** (all optional):

| Setting | Sent to the widget? | What it does |
| --- | --- | --- |
| `theme` | yes | `accent`, `accentForeground`, `surface`, `raised`, `foreground`, `muted`, `border` (CSS colours), `radius` (`square`, `rounded`, `pill`), `font` (a Google Font name) |
| `copy` | yes | `title`, `subtitle`, `greeting`, `placeholder`, `offlineMessage`, `avatarText` |
| `launcher` | yes | `position` (one of 8), `offset`, `width`, `height` |
| `features` | yes | `streaming`, `showSources` |
| `systemPrompt` | no | The company's tone and topics. Sits inside the platform's fixed rules. |
| `llmModel` | no | Overrides the default model for this site. |
| `messagesPerMinute`, `messagesPerDay` | no | Per-visitor limits (default 10 a minute). |
| `siteMessagesPerMinute` | no | Limit for the whole site (default 600 a minute). |

Settings the widget never needs (the prompt, the model, the limits) are never sent to it.

**Limits, all checked before the model is called:** 2,000 characters per message; per visitor,
per IP address (30 a minute, 5 connections) and per site; a monthly allowance per company (1,000
by default, with a log warning at 80%); replies capped at 1,024 tokens; the model sees the last
10 messages. In development the server also creates the demo site `st_demo`, with its own look and
prompt saved in the database like any other site.

## Settings (environment variables)

**Server** (`server/.env`, see `server/.env.example`)

| Name | What it's for |
| --- | --- |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Your Gemini key, and the default model (`gemini-3.1-flash-lite`). |
| `MONGODB_URI`, `MONGODB_DB` | The database. Name it in the URI, or set `MONGODB_DB`. |
| `JWT_SECRET` | Signs chat sessions. Use a long random value in production. |
| `ADMIN_API_KEY` | Key for `/admin/*`. Unset = the admin API is off. |
| `API_PORT` (or `PORT`) | Port to listen on. Defaults to `4000`. |
| `CORS_ORIGINS` | Extra origins allowed to call the API (your dashboard, for example). Customer sites are allowed automatically through their site records. |
| `TENANT_HEADER`, `DEFAULT_TENANT_ID`, `ALLOW_DEFAULT_TENANT` | Same meaning as in the main project. Set `ALLOW_DEFAULT_TENANT=false` in production. |
| `ANSWER_PROVIDER` | `gemini` (default) answers directly; `engine` asks the Python engine. |
| `ENGINE_URL`, `ENGINE_TIMEOUT_MS` | Where the engine is, for `ANSWER_PROVIDER=engine`. |
| `WIDGET_PUBLIC_URL`, `API_PUBLIC_URL` | The addresses put in the generated snippet. |
| `TRUST_PROXY` | `true` behind a reverse proxy, so per-IP limits see the visitor's real address. |

**Client** (`client/.env.local`)

| Name | What it's for |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Where the server lives. It is also built into the loader as its default API address. |
| `NEXT_PUBLIC_WIDGET_KEY` | The site token the demo home page uses (`st_demo`). |
| `NEXT_PUBLIC_CHAT_TRANSPORT` | `socket` for the real server, `mock` for fake replies. |

Keep your Gemini key and secrets out of anything that gets committed: `server/.env` is git-ignored.

## Changing what the assistant says

Each site's own prompt is its `systemPrompt` setting (see above). It always sits **inside** the
platform's fixed rules in [`server/src/widget/widget.constants.ts`](server/src/widget/widget.constants.ts)
(stay on topic, never invent contact details or placeholders, never reveal the instructions, treat
retrieved text as data), so a customer can set tone and topics but can't switch those off. The demo
site's prompt is in [`server/src/widget/demo-site.ts`](server/src/widget/demo-site.ts).

Where answers come from is chosen with `ANSWER_PROVIDER`. `gemini` calls the model directly, with
the prompt only. `engine` asks the Python engine's `POST /chat`, which does the retrieval over the
scraped site and returns the answer with citations; those become the source links under the reply.

## Putting it live

1. Deploy the **server** and the **client** with real `https` addresses.
2. On the server set `GEMINI_API_KEY`, `MONGODB_URI`, a strong `JWT_SECRET` and `ADMIN_API_KEY`,
   `NODE_ENV=production`, `ALLOW_DEFAULT_TENANT=false`, `WIDGET_PUBLIC_URL`, `API_PUBLIC_URL`, and
   `TRUST_PROXY=true` if there is a reverse proxy.
3. On the client set `NEXT_PUBLIC_API_URL` to the server's address and
   `NEXT_PUBLIC_CHAT_TRANSPORT=socket`, then run `npm run build` (it builds the widget too).
4. Create a site for each customer with the admin API, and give them the snippet it returns.

### The published files

`npm run build:widget` writes, under `client/public/`:

| File | What it is |
| --- | --- |
| `v1.0.0/widget.js` | The loader, pinned. Never changes; cached for a year. |
| `v1.0.0/chat.<hash>.js` | The chat. The hash is in the name, so it can be cached for good. |
| `v1.0.0/integrity.json` | The SRI hashes. Put one in the script tag: `integrity="sha384-…" crossorigin="anonymous"`. A tampered file then won't run. |
| `v1/widget.js` and `widget.js` | Aliases that always serve the latest 1.x (checked on every page load). |

The version comes from `widgetVersion` in `client/package.json`. The build fails if the loader
grows past 16 KB gzipped, so it can't quietly get heavy again.

## Handy commands

```bash
# server
npm run start:dev    # run with auto-restart
npm test             # run the tests
npm run build        # production build
node scripts/migrate-tenant-ids.mjs   # one-off: bring an older database to the tenant format

# client
npm run dev          # run in development (builds the widget first)
npm run build:widget # build the loader + chat into client/public
npm run lint         # check the code
npm test             # widget tests: Markdown safety, layout, theme rules

# packages/contracts
npm test             # the shared schemas
```

`npm install` in `client/` and `server/` links `@myra/contracts` from `packages/contracts`, and every
`dev`, `build`, `start` and `test` script builds it first if it is missing or out of date.

## Good to know

- `client/public/widget.js` and `client/public/v*/` are generated by `npm run build:widget`. Don't
  edit them by hand; they are git-ignored.
- The loader uses `rem` units for its radius values, so a host page that changes the root font size
  scales the chat a little.
- Links in answers open in a new tab, and Markdown in answers is filtered (only `http`, `https`,
  `mailto` and `tel` links; no raw HTML).
- If Gemini (or the engine) can't answer, the visitor sees a short apology instead of an error.
- The widget stays out of the way when it can't be shown: an unknown token, a website that isn't
  allowed, a disabled site or an unreachable API each log one clear line in the browser console.
- Still to do, and listed for the merge: Redis for limits across several servers, the Python
  engine's `/chat` answer and search, the website crawler, and real admin login.
