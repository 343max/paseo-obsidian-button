import { openExternalUrl } from "@getpaseo/plugin/client";
import { Linking, Platform } from "react-native";
import { openObsidianRpc } from "../shared/open-obsidian";
import type { ObsidianLink } from "../shared/obsidian-link";
import { pluginClient } from "./plugin-client";

export interface OpenOutcome {
  readonly ok: boolean;
  /** Which opener did the work, for logging and for the error text. */
  readonly via: "device" | "daemon" | "browser" | "none";
  readonly detail?: string;
}

function isHttpLink(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/**
 * A phone or tablet reaches its own Obsidian through the OS URL handler. Electron
 * and browsers report `web` here: their page cannot launch an app itself, so they
 * go on to the daemon.
 */
async function openOnThisDevice(uri: string): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    await Linking.openURL(uri);
    return true;
  } catch {
    return false;
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Opens one link in Obsidian.
 *
 * The daemon runs beside the desktop app on the same machine, and its OS opener
 * starts the installed Obsidian directly, without a browser in between. When that
 * fails, a redirect-service link still works: the client's own external opener
 * hands the HTTPS URL to the browser, which forwards it to Obsidian. A direct
 * `obsidian://` link has nothing to fall back to.
 */
export async function openObsidianLink(link: ObsidianLink): Promise<OpenOutcome> {
  if (await openOnThisDevice(link.uri)) return { ok: true, via: "device" };

  let detail: string | undefined;
  try {
    const result = await pluginClient().rpc(openObsidianRpc, { uri: link.uri });
    if (result.opened) return { ok: true, via: "daemon" };
    detail = result.detail;
  } catch (error) {
    detail = describe(error);
  }

  if (isHttpLink(link.href)) {
    try {
      await openExternalUrl(link.href);
      return { ok: true, via: "browser", detail };
    } catch (error) {
      detail = detail ? `${detail}; the browser opener failed too: ${describe(error)}` : describe(error);
    }
  }

  return { ok: false, via: "none", detail };
}
