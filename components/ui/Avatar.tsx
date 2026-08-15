import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Colors, Radii } from '@/constants/theme';

interface AvatarProps {
  uri: string;
  size?: number;
  online?: boolean;
  hasStory?: boolean;
  storySeen?: boolean;
}

export function Avatar({ uri, size = 40, online = false, hasStory = false, storySeen = false }: AvatarProps) {
  const borderSize = size + 6;
  return (
    <View style={{ width: borderSize, height: borderSize, alignItems: 'center', justifyContent: 'center' }}>
      {hasStory && (
        <View
          style={[
            styles.storyRing,
            {
              width: borderSize,
              height: borderSize,
              borderRadius: borderSize / 2,
              borderColor: storySeen ? Colors.textMuted : Colors.primary,
            },
          ]}
        />
      )}
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        transition={200}
      />
      {online && (
        <View
          style={[
            styles.onlineDot,
            {
              width: size * 0.26,
              height: size * 0.26,
              borderRadius: size * 0.13,
              bottom: 0,
              right: 0,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  storyRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  onlineDot: {
    position: 'absolute',
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: Colors.background,
  },
});
