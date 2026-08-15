import React, { useCallback } from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { parseMentions } from '@/services/mentionService';
import { Colors, FontWeight } from '@/constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MentionTextProps {
  /** Raw text that may contain @username tokens */
  text: string;
  /** Optional map of username → userId for direct profile navigation */
  mentionUserMap?: Record<string, string>;
  /** Base text style */
  style?: TextStyle | TextStyle[];
  /** Number of lines to clamp */
  numberOfLines?: number;
}

// ─── MentionText ──────────────────────────────────────────────────────────────

/**
 * Renders text with tappable, highlighted @mention tokens.
 * Tapping a @mention navigates to that user's public profile
 * using the provided mentionUserMap or falls back to the search screen.
 */
export function MentionText({
  text,
  mentionUserMap,
  style,
  numberOfLines,
}: MentionTextProps) {
  const router = useRouter();
  const mentions = parseMentions(text);

  const handleMentionPress = useCallback(
    (username: string) => {
      const userId = mentionUserMap?.[username];
      if (userId) {
        router.push(`/profile/${userId}` as any);
      } else {
        // Fall back to search screen pre-filled
        router.push(`/search` as any);
      }
    },
    [mentionUserMap, router]
  );

  if (mentions.length === 0) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  // Build interleaved text + mention segments
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;

  mentions.forEach((m, i) => {
    // Plain text before this mention
    if (m.start > lastIndex) {
      segments.push(
        <Text key={`plain_${i}`}>{text.slice(lastIndex, m.start)}</Text>
      );
    }
    // The @mention span
    segments.push(
      <Text
        key={`mention_${i}`}
        style={mentionStyles.mention}
        onPress={() => handleMentionPress(m.username)}
        suppressHighlighting
      >
        @{m.username}
      </Text>
    );
    lastIndex = m.end;
  });

  // Any remaining plain text after last mention
  if (lastIndex < text.length) {
    segments.push(
      <Text key="plain_end">{text.slice(lastIndex)}</Text>
    );
  }

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {segments}
    </Text>
  );
}

const mentionStyles = StyleSheet.create({
  mention: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
});
