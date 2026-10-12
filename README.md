# paseo-obsidian-button

A [Paseo](https://paseo.sh) plugin that adds an **Open in Obsidian** button to every message in the transcript that links to an Obsidian note — whether the agent wrote the link or you did.

```text
┌───────────────────────────────────────────────┐
│ Here are the plans:                           │
│ pi-agent/plans/docker/…-service.md            │
│                                               │
│  📄 obsidian-url-redirect-service          ↗  │
│     Bear · pi-agent/plans/docker/…-service.md │
└───────────────────────────────────────────────┘
```

## Install

```bash
paseo plugin add https://github.com/343max/paseo-obsidian-button.git
```

On another daemon:

```bash
paseo --host ssh://user@example.com plugin add https://github.com/343max/paseo-obsidian-button.git
```

Requires Paseo 0.11.2 or later. Plugins are trusted, unsandboxed code: the daemon half runs `open`, `xdg-open`, or `cmd /c start` on the daemon machine.

## Link shapes

Both are normalized to a canonical `obsidian://open` URI before anything opens:

| Written in the message | Opened as |
| --- | --- |
| `obsidian://open?vault=Bear&file=Notes%2FPlan.md` | unchanged |
| `https://go.43v.de/open?vault=Bear&file=Notes%2FPlan.md` | `obsidian://open?vault=Bear&file=Notes%2FPlan.md` |
| any `https://…/open?file=…` link | same rewrite |

Links are found in prose, in inline Markdown (`[label](…)`), and inside a sentence's punctuation. Each distinct URI gets one button; the button shows the note name, the vault, and the path.

To recognize another redirect host explicitly, add it to `REDIRECT_HOSTS` in [`shared/obsidian-link.ts`](shared/obsidian-link.ts).

## Why the daemon opens it

Paseo's own external opener accepts `http(s)` URLs only, so an `obsidian://` URL cannot be opened from the app itself. The plugin's client half therefore asks its daemon — which runs on the same machine as the desktop app — to pass the URI to the operating system's URL handler, and that launches the app registered for `obsidian://`.

When the daemon cannot do that (remote daemon, no Obsidian, unknown platform), a redirect-service link falls back to the browser through the app's own opener, and a bare `obsidian://` link reports the failure on the row. On iOS and Android the app opens the URI itself.

A headless daemon is the common case for the fallback: `xdg-open` is installed but has no desktop session to hand the URI to, so the button opens the redirect link in the browser of whichever device you are looking at.

## Rendering

A timeline entry can only be replaced as a whole, so a message that gains a button is rendered by this plugin: prose, headings, lists, quotes, tables, fenced code, and inline formatting. Messages without an Obsidian link keep Paseo's own (richer) Markdown. Inside a replaced message, images appear as links rather than pictures.

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest run
paseo plugin reload paseo-obsidian-button
```

| Path | Runs in | Contents |
| --- | --- | --- |
| `index.client.tsx`, `client/` | Paseo app | Timeline transformer, renderer, opener chain |
| `index.server.ts`, `server/` | Daemon subprocess | `obsidian.open` RPC that runs the platform URL opener |
| `shared/` | Both | Link recognition, Markdown reader, Zod contracts |
| `tests/` | Vitest | Link recognition and Markdown cases |

`paseo plugin logs paseo-obsidian-button` shows daemon-side output, including an opener that failed.
