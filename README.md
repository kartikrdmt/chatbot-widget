# Myra Technolabs Chatbot Widget

An AI chat assistant you can drop into any website. A visitor clicks the chat button, asks a
question, and gets an answer from Google's Gemini, written as the assistant for Myra Technolabs.

You can add it to a site in two ways:

- **One `<script>` tag.** Works on anything: plain HTML, PHP, WordPress, React, Next.js, you name it.
- **An npm package** with a `<ChatbotWidget />` React component, for React and Next.js projects.

Both look and behave the same, and both are styled from the same options (colours, title, subtitle
and so on) that you give them. Nothing is hard-coded to one brand.

## What's in this repo

| Folder | What it is |
| --- | --- |
| [`client/`](client) | The web app (Next.js) with the demo page, and the source of the widget. `npm run build:widget` bundles the chat into one file, `public/widget.js`, which customers add to their sites. |
| [`server/`](server) | The API (NestJS). It talks to Gemini, keeps the list of sites that are allowed to use the widget, and handles the live chat connection. |
| [`packages/chatbot-widget/`](packages/chatbot-widget) | The npm package for React and Next.js. See its [README](packages/chatbot-widget/README.md). |

## How it works, in short

1. A customer's page loads `widget.js` (from the `client`). It adds a round chat button.
2. When a visitor clicks the button, the chat opens. The whole chat lives inside a **Shadow DOM**:
   a private, sealed-off area on the page with its own styles. The customer's CSS can't change how
   the chat looks, and the chat's CSS can't change their page. (It's one self-contained file: the
   chat interface and its styles are both inside `widget.js`.)
3. The visitor's message goes from their browser straight to the `server` over a socket. The server sends it, with the recent
   conversation, to Gemini and sends the answer back.
4. The conversation is saved in the visitor's browser, so a page refresh keeps the chat open and the
   messages in place.

## Running it on your computer

You need **Node.js 20.12 or newer** (this was built with Node 24) and a **Gemini API key**
(get one at <https://aistudio.google.com/apikey>).

### 1. Start the server

```bash
cd server
npm install
cp .env.example .env     # then open .env and paste your key after GEMINI_API_KEY=
npm run start:dev
```

It runs on <http://localhost:4000>.

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
NEXT_PUBLIC_WIDGET_KEY=demo-key
NEXT_PUBLIC_API_URL=http://localhost:4000
```

> `NEXT_PUBLIC_CHAT_TRANSPORT=socket` means "talk to the real server and Gemini". If you set it to
> `mock`, the chat gives fake canned replies instead, which is handy when you have no API key.

**Both must be running.** If the server is down, or the site isn't on the allowed list, the chat
button simply doesn't appear, because the widget first asks the server whether this site may use it.

`npm run dev` rebuilds `public/widget.js` for you each time it starts. If you change the widget's
code while it's running, run `npm run build:widget` (or `npm run build:widget -- --watch`) to
rebuild it.

## See it working

With both servers running, open either of these:

- **<http://localhost:3000>**: the home page. The chat button in the bottom-right corner is the real
  widget, added with a script tag and styled from its `data-*` attributes (green theme).
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
  data-key="your-site-key"
  data-api-url="https://YOUR-API-DOMAIN"
  data-title="Myra Technolabs"
  data-subtitle="AI assistant"
  data-accent-color="#16a34a"
></script>
```

Only `data-key` and `data-api-url` are required. Everything else is optional.

| Attribute | What it does |
| --- | --- |
| `data-key` | Your site's widget key. |
| `data-api-url` | Where the server lives. |
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

Colours can be anything CSS understands: `#16a34a`, `rgb(22 163 74)`, `green`, and so on.

**React, Next.js and tag managers:** you can also add the script from code. Create a `<script>`
element, set its `src` and `data-*` attributes, and append it to `document.body`.

### With the npm package (React / Next.js)

```bash
npm install @myra-technolabs/chatbot-widget
```

```tsx
import { ChatbotWidget } from '@myra-technolabs/chatbot-widget';

<ChatbotWidget
  widgetKey="your-site-key"
  widgetUrl="https://YOUR-WIDGET-DOMAIN"   // where widget.js is hosted
  apiUrl="https://YOUR-API-DOMAIN"
  position="left-center"
  accentColor="#16a34a"
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
address is in `WIDGET_SITES`.

The package isn't on npm yet. To publish it you need your own npm account:

```bash
cd packages/chatbot-widget
npm run build
npm publish --access public
```

## Letting a new website use the widget

For safety, a site can only use the widget if you've allowed it. The server checks the website's
address on every request and on every chat connection. This is set on the server with the
`WIDGET_SITES` setting in `server/.env`: a list of keys and the website addresses allowed to use
each one.

```
WIDGET_SITES=[{"key":"acme","allowedOrigins":["https://acme.com","https://www.acme.com"]}]
```

- The address must be exactly the origin (`https://acme.com`), with no path and no trailing slash.
- You can add an optional `"position"` per site, for example `"position":"bottom-left"`.
- If `WIDGET_SITES` isn't set, only the `demo-key` key on `localhost:3000` works, and only while
  running in development.

## Settings (environment variables)

**Server** (`server/.env`)

| Name | What it's for |
| --- | --- |
| `GEMINI_API_KEY` | Your Gemini key. Required for real answers. |
| `GEMINI_MODEL` | Which Gemini model to use. Defaults to `gemini-3.1-flash-lite`, a small, cheap model. |
| `PORT` | Port to listen on. Defaults to `4000`. |
| `CORS_ORIGINS` | Comma-separated list of origins allowed to call the API. Defaults to `http://localhost:3000`. Set it to the address of your deployed client. |
| `WIDGET_SITES` | Sites allowed to use the widget (above). |

**Client** (`client/.env.local`)

| Name | What it's for |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Where the server lives. |
| `NEXT_PUBLIC_WIDGET_KEY` | The key the demo pages use. |
| `NEXT_PUBLIC_CHAT_TRANSPORT` | `socket` for the real server and Gemini, `mock` for fake replies. |

Keep your Gemini key secret. `server/.env` is already git-ignored, so don't paste the key anywhere
that gets committed or shared.

## Changing what the assistant says

The assistant's personality is a short instruction (a "system prompt") in
[`server/src/widget/widget.constants.ts`](server/src/widget/widget.constants.ts). It currently tells
Gemini to act as the chatbot AI assistant for Myra Technolabs: friendly, short answers, and honest
when it doesn't know something. Edit that text to change how it talks, and add facts about the
company there if you want it to answer questions about them accurately. The default greeting and
subtitle live in the same file.

## Putting it live

1. Deploy the **server** and the **client** somewhere with real `https` addresses.
2. On the server, set `GEMINI_API_KEY`, `CORS_ORIGINS` (your client's address) and `WIDGET_SITES`
   (every customer website).
3. On the client, set `NEXT_PUBLIC_API_URL` to the server's address and
   `NEXT_PUBLIC_CHAT_TRANSPORT=socket`.
4. Give customers the script tag (or the npm package) with your real `https` addresses instead of
   `localhost`.

## Handy commands

```bash
# server
npm run start:dev    # run with auto-restart
npm test             # run the tests
npm run build        # production build

# client
npm run dev          # run in development
npm run build        # production build
npm run lint         # check the code
```

## Good to know

- `public/widget.js` is generated by `npm run build:widget` (it runs automatically before
  `npm run dev` and `npm run build`), so you shouldn't edit it by hand. It is about 470 KB
  (roughly 140 KB gzipped), since it includes the chat interface, its styles and the socket library.
- The widget uses `rem` units, so a host page that changes the root font size will scale it a little.

- The chat history is stored in the visitor's own browser (per widget key), not on the server.
  Clearing site data or switching browsers starts a fresh chat.
- Only the last 20 messages are sent to Gemini with each question, to keep answers quick and cheap.
- Links in answers open in a new tab.
- If Gemini can't be reached, the visitor sees a short apology instead of an error.
