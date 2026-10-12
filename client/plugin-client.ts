import type { PluginClientContext } from "@getpaseo/plugin/client";

/**
 * The client entry's context, for code that runs outside a contributed surface.
 *
 * Paseo wraps screens, panels, and sidebar items in the providers that
 * `useRpc()` and `usePaseo()` read from, but a timeline renderer receives only
 * the host props, so those hooks throw inside one. The context is captured while
 * the entry runs instead, which is before any timeline item can render and lives
 * until the plugin stops.
 */
let current: PluginClientContext | null = null;

export function setPluginClient(client: PluginClientContext | null): void {
  current = client;
}

export function pluginClient(): PluginClientContext {
  if (!current) throw new Error("The Obsidian plugin is not running.");
  return current;
}
