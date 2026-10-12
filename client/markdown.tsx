import type { PluginTheme } from "@getpaseo/plugin";
import { useMemo } from "react";
import { Platform, StyleSheet, Text, View, type TextStyle } from "react-native";
import { parseMarkdown, type Block, type Inline } from "../shared/markdown";

export interface MarkdownProps {
  text: string;
  theme: PluginTheme;
  compact: boolean;
  onOpenLink(href: string): void;
}

const MONOSPACE = Platform.select({ ios: "Menlo", default: "monospace" });

/**
 * Renders a message this plugin took over because it carries an Obsidian link.
 *
 * Paseo's own Markdown is better than this, which is why the transformer leaves
 * every other message alone. What appears here is the formatting agents use in
 * prose; anything richer stays Paseo's job.
 */
export function Markdown({ text, theme, compact, onOpenLink }: MarkdownProps) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  const body: TextStyle = {
    color: theme.colors.foreground,
    fontSize: compact ? 14 : 14.5,
    lineHeight: compact ? 20 : 21,
  };

  return (
    <View style={{ gap: compact ? 8 : 10 }}>
      {blocks.map((block, index) => (
        <BlockView
          key={index}
          block={block}
          theme={theme}
          compact={compact}
          body={body}
          onOpenLink={onOpenLink}
        />
      ))}
    </View>
  );
}

interface BlockProps {
  block: Block;
  theme: PluginTheme;
  compact: boolean;
  body: TextStyle;
  onOpenLink(href: string): void;
}

function BlockView({ block, theme, compact, body, onOpenLink }: BlockProps) {
  const content = (spans: Inline[]) => <Spans content={spans} theme={theme} onOpenLink={onOpenLink} />;

  if (block.kind === "rule") {
    return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border }} />;
  }

  if (block.kind === "code") {
    return (
      <View
        style={{
          borderRadius: 8,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface1,
          padding: compact ? 8 : 10,
        }}
      >
        <Text selectable style={{ color: theme.colors.foreground, fontFamily: MONOSPACE, fontSize: 12, lineHeight: 18 }}>
          {block.text}
        </Text>
      </View>
    );
  }

  if (block.kind === "heading") {
    return (
      <Text selectable style={{ ...body, fontSize: Math.max(15, 23 - block.level * 1.5), fontWeight: "700" }}>
        {content(block.content)}
      </Text>
    );
  }

  if (block.kind === "quote") {
    return (
      <View style={{ borderLeftWidth: 2, borderLeftColor: theme.colors.accent, paddingLeft: 10 }}>
        <Text selectable style={{ ...body, color: theme.colors.foregroundMuted }}>
          {content(block.content)}
        </Text>
      </View>
    );
  }

  if (block.kind === "list") {
    return (
      <View style={{ gap: 4 }}>
        {block.items.map((item, index) => (
          <View key={index} style={{ flexDirection: "row", gap: 8 }}>
            <Text style={{ ...body, color: theme.colors.foregroundMuted }}>
              {block.ordered ? `${block.start + index}.` : "•"}
            </Text>
            <Text selectable style={{ ...body, flex: 1 }}>
              {content(item)}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  if (block.kind === "table") {
    const cell = (spans: Inline[], index: number, header: boolean) => (
      <Text
        key={index}
        selectable
        style={{
          ...body,
          flex: 1,
          ...(header ? { fontWeight: "700" } : {}),
          paddingVertical: 6,
          paddingHorizontal: 8,
        }}
      >
        {content(spans)}
      </Text>
    );
    return (
      <View style={{ borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border, borderRadius: 8 }}>
        <View style={{ flexDirection: "row", backgroundColor: theme.colors.surface1 }}>
          {block.header.map((spans, index) => cell(spans, index, true))}
        </View>
        {block.rows.map((row, rowIndex) => (
          <View
            key={rowIndex}
            style={{ flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border }}
          >
            {row.map((spans, index) => cell(spans, index, false))}
          </View>
        ))}
      </View>
    );
  }

  return (
    <Text selectable style={body}>
      {content(block.content)}
    </Text>
  );
}

function Spans({ content, theme, onOpenLink }: { content: Inline[]; theme: PluginTheme; onOpenLink(href: string): void }) {
  return (
    <>
      {content.map((span, index) => {
        switch (span.kind) {
          case "strong":
            return (
              <Text key={index} style={{ fontWeight: "700" }}>
                <Spans content={span.content} theme={theme} onOpenLink={onOpenLink} />
              </Text>
            );
          case "emphasis":
            return (
              <Text key={index} style={{ fontStyle: "italic" }}>
                <Spans content={span.content} theme={theme} onOpenLink={onOpenLink} />
              </Text>
            );
          case "strike":
            return (
              <Text key={index} style={{ textDecorationLine: "line-through" }}>
                <Spans content={span.content} theme={theme} onOpenLink={onOpenLink} />
              </Text>
            );
          case "code":
            return (
              <Text key={index} style={{ fontFamily: MONOSPACE, fontSize: 12.5, color: theme.colors.accent }}>
                {span.text}
              </Text>
            );
          case "link":
            return (
              <Text
                key={index}
                accessibilityRole="link"
                onPress={() => onOpenLink(span.href)}
                style={{ color: theme.colors.accent, textDecorationLine: "underline" }}
              >
                {span.text}
              </Text>
            );
          default:
            return <Text key={index}>{span.text}</Text>;
        }
      })}
    </>
  );
}
