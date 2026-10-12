import type { PluginServerContext } from "@getpaseo/plugin/server";
import { openInObsidian } from "./server/open-obsidian";
import { openObsidianRpc } from "./shared/open-obsidian";

export default function contribute(server: PluginServerContext) {
  server.handle(openObsidianRpc, openInObsidian);
  return () => {};
}
