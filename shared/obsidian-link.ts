/**
 * Recognizes Obsidian links in message text.
 *
 * Agents write two shapes. Either a direct `obsidian://` URI, like
 * `obsidian://open?vault=Bear&file=Notes%2FPlan.md`, or an HTTPS link from a
 * redirect service, like `https://go.43v.de/open?vault=Bear&file=Notes%2FPlan.md`,
 * which answers with a page that forwards to the same URI. Both become one
 * canonical `obsidian://open` URI here, built the way the Obsidian URI
 * documentation describes (https://obsidian.md/help/uri), so every other module
 * deals with URIs only.
 */

import { z } from "zod";
import { trimLinkMarkup } from "./link-boundary";

/** Hosts that serve `/open?vault=…&file=…` links forwarding to Obsidian. */
const REDIRECT_HOSTS = new Set(["go.43v.de"]);

/**
 * The shape travels to the renderer as timeline item data, so the schema is the
 * single definition: the parser produces it and the renderer validates it.
 */
export const obsidianLinkSchema = z.object({
  /** The link as it appeared in the message. */
  href: z.string(),
  /** The `obsidian://` URI to hand to Obsidian. */
  uri: z.string(),
  vault: z.string().nullable(),
  file: z.string().nullable(),
  /** Button label: the note name, else the vault, else "Obsidian". */
  label: z.string(),
  /** Muted second line: the vault and the note path. */
  detail: z.string(),
});

export type ObsidianLink = z.infer<typeof obsidianLinkSchema>;

/** Anything that could be a link, ending at the first delimiter that cannot appear in one. */
const CANDIDATE = /(?:obsidian|https?):\/\/[^\s<>"'`]+/gi;
const OBSIDIAN_PROTOCOL = "obsidian:";

function toUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function noteName(file: string | null): string | null {
  if (!file) return null;
  const name = file.split("/").filter(Boolean).pop() ?? file;
  const withoutExtension = name.replace(/\.md$/i, "");
  return withoutExtension.length > 0 ? withoutExtension : name;
}

function describe(vault: string | null, file: string | null): { label: string; detail: string } {
  const path = (file ?? "").replace(/^\//, "");
  const label = noteName(file) ?? vault ?? "Obsidian";
  const detail = [vault, path].filter((part): part is string => Boolean(part)).join(" · ");
  return { label, detail: detail.length > 0 ? detail : "Obsidian" };
}

function fromObsidianUri(href: string): ObsidianLink | null {
  const url = toUrl(href);
  if (!url || url.protocol !== OBSIDIAN_PROTOCOL) return null;
  const vault = url.searchParams.get("vault");
  const file = url.searchParams.get("file") ?? url.searchParams.get("path");
  return { href, uri: href, vault, file, ...describe(vault, file) };
}

/** Builds the URI by hand so that `vault` and `file` keep the encoding Obsidian expects. */
function buildOpenUri(vault: string | null, file: string): string {
  const query = [
    ...(vault ? [`vault=${encodeURIComponent(vault)}`] : []),
    `file=${encodeURIComponent(file)}`,
  ];
  return `obsidian://open?${query.join("&")}`;
}

function fromRedirect(href: string): ObsidianLink | null {
  const url = toUrl(href);
  if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) return null;
  const file = url.searchParams.get("file");
  if (!file) return null;
  const vault = url.searchParams.get("vault");
  const isRedirect = REDIRECT_HOSTS.has(url.hostname.toLowerCase()) || /\/open\/?$/.test(url.pathname);
  if (!isRedirect) return null;
  return { href, uri: buildOpenUri(vault, file), vault, file, ...describe(vault, file) };
}

/**
 * Every distinct Obsidian link in the text, in the order it appears.
 *
 * Pure and synchronous because Paseo reruns timeline transformers while it
 * reconciles projected history, and because this is the part worth testing.
 */
export function findObsidianLinks(text: string): ObsidianLink[] {
  const found = new Map<string, ObsidianLink>();
  for (const match of text.matchAll(CANDIDATE)) {
    const href = trimLinkMarkup(match[0]);
    const link = fromObsidianUri(href) ?? fromRedirect(href);
    if (link && !found.has(link.uri)) found.set(link.uri, link);
  }
  return [...found.values()];
}
