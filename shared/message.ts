import type { PluginTimelineItem } from "@getpaseo/plugin";
import { z } from "zod";
import { findObsidianLinks, obsidianLinkSchema } from "./obsidian-link";

export const MESSAGE_KIND = "obsidian-message";
export const MESSAGE_VERSION = 1;

/** What the renderer receives: the message text plus the links found in it. */
export const messageSchema = z.object({
  text: z.string(),
  links: z.array(obsidianLinkSchema),
});

export type MessageData = z.infer<typeof messageSchema>;

/**
 * Turns one message into the item this plugin renders, or leaves it alone.
 *
 * Paseo reruns transformers while it builds the render model, on every streaming
 * update as well as on the finished message, so this stays pure and synchronous.
 * A message without an Obsidian link keeps Paseo's own rendering, which is better
 * than this plugin's; only a message that gains a button switches renderer.
 */
export function transformMessage(text: string): { items: PluginTimelineItem[] } | undefined {
  const links = findObsidianLinks(text);
  if (links.length === 0) return undefined;
  return { items: [{ type: "plugin", kind: MESSAGE_KIND, version: MESSAGE_VERSION, data: { text, links } }] };
}
