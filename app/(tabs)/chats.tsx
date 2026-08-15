import React, { useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ChatListItem } from '@/components/feature/ChatListItem';
import { useApp } from '@/hooks/useApp';
import { Colors, Spacing, FontSize, FontWeight, Radii } from '@/constants/theme';
import { Conversation } from '@/constants/mockData';

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { conversations } = useApp();

  const handlePress = useCallback(
    (conversation: Conversation) => {
      router.push(`/chat/${conversation.id}`);
    },
    [router]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mensajes</Text>
        <Pressable style={styles.editBtn} hitSlop={8}>
          <Ionicons name="create-outline" size={22} color={Colors.primary} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchWrapper}>
        <Ionicons name="search" size={18} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar conversaciones..."
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      {/* Online contacts strip */}
      <View style={styles.onlineSection}>
        <Text style={styles.onlineSectionTitle}>En linea</Text>
        <View style={styles.onlineDots}>
          {conversations.filter(c => c.online).map(c => (
            <Pressable
              key={c.id}
              style={styles.onlineAvatar}
              onPress={() => handlePress(c)}
            >
              <View style={styles.onlineRing}>
                <View style={styles.onlineAvatarInner}>
                  {/* Simple colored circle as avatar placeholder */}
                </View>
              </View>
              <Text style={styles.onlineAvatarName} numberOfLines={1}>
                {c.user.name.split(' ')[0]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Text style={styles.sectionLabel}>Recientes</Text>

      <FlatList
        data={conversations}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ChatListItem conversation={item} onPress={() => handlePress(item)} />
        )}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => (
          <View style={styles.separator} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  editBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.md,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.base,
  },
  onlineSection: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  onlineSectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  onlineDots: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  onlineAvatar: {
    alignItems: 'center',
    gap: 4,
  },
  onlineRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: Colors.success,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineAvatarInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    opacity: 0.6,
  },
  onlineAvatarName: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.surfaceBorder,
    marginLeft: 80,
  },
});
