import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '@/components/ui/Avatar';
import { Colors, Spacing, FontSize, FontWeight, Radii } from '@/constants/theme';
import { Story, CURRENT_USER } from '@/constants/mockData';

interface StoryBarProps {
  stories: Story[];
}

export function StoryBar({ stories }: StoryBarProps) {
  const [seenStories, setSeenStories] = useState<Set<string>>(new Set());

  const handleStoryPress = (id: string) => {
    setSeenStories(prev => new Set([...prev, id]));
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* My Story */}
        <Pressable style={styles.storyItem}>
          <View style={styles.myStoryWrapper}>
            <Avatar uri={CURRENT_USER.avatar} size={56} />
            <LinearGradient
              colors={[Colors.primary, Colors.secondary]}
              style={styles.addBadge}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.plusIcon}>+</Text>
            </LinearGradient>
          </View>
          <Text style={styles.storyName} numberOfLines={1}>Tu historia</Text>
        </Pressable>

        {/* Other Stories */}
        {stories.map(story => {
          const seen = seenStories.has(story.id) || story.seen;
          return (
            <Pressable
              key={story.id}
              style={styles.storyItem}
              onPress={() => handleStoryPress(story.id)}
            >
              <View style={styles.storyRingWrapper}>
                {!seen ? (
                  <LinearGradient
                    colors={[Colors.primary, Colors.secondary]}
                    style={[styles.storyRing]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.storyInner}>
                      <Avatar uri={story.user.avatar} size={50} />
                    </View>
                  </LinearGradient>
                ) : (
                  <View style={[styles.storyRing, { borderColor: Colors.textMuted }]}>
                    <View style={styles.storyInner}>
                      <Avatar uri={story.user.avatar} size={50} />
                    </View>
                  </View>
                )}
              </View>
              <Text style={styles.storyName} numberOfLines={1}>
                {story.user.name.split(' ')[0]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    minHeight: 100,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
    marginBottom: Spacing.md,
  },
  content: {
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  storyItem: {
    alignItems: 'center',
    gap: 6,
    width: 70,
  },
  myStoryWrapper: {
    position: 'relative',
  },
  addBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  plusIcon: {
    color: '#fff',
    fontSize: 14,
    fontWeight: FontWeight.bold,
    lineHeight: 16,
  },
  storyRingWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyName: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
  },
});
