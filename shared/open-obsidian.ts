import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

const OBSIDIAN_URI = /^obsidian:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]*$/;

export function isObsidianUri(value: string): boolean {
  return OBSIDIAN_URI.test(value);
}

/**
 * Hands a canonical `obsidian://` URI to the open handler on the daemon machine.
 *
 * The app's own external opener accepts HTTP(S) only, so a `obsidian://` URL
 * cannot be opened from client code. The daemon runs beside the desktop app on
 * the same machine, and its OS opener launches the installed Obsidian directly,
 * without a browser in between.
 */
export const openObsidianRpc = defineRpc({
  name: "obsidian.open",
  input: z.object({ uri: z.string().min(1).max(2048) }),
  output: z.object({
    opened: z.boolean(),
    /** Why the opener failed, so the client can explain or fall back. */
    detail: z.string().optional(),
  }),
});
