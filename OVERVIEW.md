# Obsidian links

Adds an **Open in Obsidian** button to every message in the transcript that links to an Obsidian note, whether the agent wrote the link or you did.

Two link shapes are recognized. A direct Obsidian URI, such as `obsidian://open?vault=Bear&file=Notes%2FPlan.md`, and an HTTPS link from a redirect service, such as `https://go.43v.de/open?vault=Bear&file=Notes%2FPlan.md`. The second shape also covers any HTTPS link whose path ends in `/open` and that carries a `file=` parameter. Both are normalized to a canonical `obsidian://open` URI before anything opens, following the [Obsidian URI format](https://obsidian.md/help/uri).

Each button names the note, and the line under it shows the vault and the path. The button appears while the message is still streaming, as soon as the link is.

## How a link reaches Obsidian

Paseo's own external opener accepts HTTP(S) links only, so an `obsidian://` URL cannot be opened from the app itself. The plugin asks the daemon, which runs on the same machine as the desktop app, to pass the URI to the operating system's URL handler, which launches whichever app registered the `obsidian://` scheme. No browser tab opens in between.

If the daemon cannot do that, a redirect-service link still works: the app hands the HTTPS link to the browser, which forwards it to Obsidian. A direct `obsidian://` link has no such fallback, and the button reports why it failed. On iOS and Android the app opens the URI itself, so it reaches that phone's Obsidian rather than the daemon machine's.

The daemon needs a URL opener for its platform: `open` on macOS, `xdg-open` on Linux, or `cmd /c start` on Windows. The button works without Obsidian installed, but nothing will appear.

## What it changes in the transcript

A message that contains an Obsidian link is rendered by this plugin: prose, headings, lists, quotes, tables, fenced code, and inline formatting, followed by one button per link. Paseo's Markdown is richer than this renderer, so a message without such a link keeps Paseo's own rendering and only messages that gain a button switch.

Within a replaced message, images appear as links rather than pictures, and inline links open the same way the buttons do. A replaced message is drawn by the plugin alone.

User-pasted links are covered too, so a message you send with an Obsidian link in it is also rendered by the plugin.
