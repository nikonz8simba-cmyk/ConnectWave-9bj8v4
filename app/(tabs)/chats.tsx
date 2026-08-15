import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { ChatListItem } from '@/components/feature/ChatListItem';
import { useApp } from '@/hooks/useApp';
import { Colors, Spacing, FontSize, FontWeight, Radii } from '@/constants/theme';
import { AppConversation } from '@/types/database';

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { conversations, loadingChats, refreshConversations } = useApp();
  const [search, setSearch] = useState('');

  const filteredConversations = search.trim()
    ? conversations.filter(c =>
        c.other_user.name.toLowerCase().includes(search.toLowerCase()) ||
        c.other_user.username.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  const onlineConversations = conversations.filter(c => c.online);

  const handlePress = useCallback(
    (conversation: AppConversation) => {
      router.push(`/chat/${conversation.id}`);
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: AppConversation }) => (
      <ChatListItem conversation={item} onPress={() => handlePress(item)} />
    ),
    [handlePress]
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
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 ? (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {/* Online contacts strip */}
      {onlineConversations.length > 0 ? (
        <View style={styles.onlineSection}>
          <Text style={styles.onlineSectionTitle}>En linea</Text>
          <View style={styles.onlineDots}>
            {onlineConversations.map(c => (
              <Pressable
                key={c.id}
                style={styles.onlineAvatar}
                onPress={() => handlePress(c)}
              >
                <Avatar uri={c.other_user.avatar} size={46} online />
                <Text style={styles.onlineAvatarName} numberOfLines={1}>
                  {c.other_user.name.split(' ')[0]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>
        {search.trim() ? `Resultados (${filteredConversations.length})` : 'Recientes'}
      </Text>

      <FlatList
        data={filteredConversations}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {loadingChats ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <>
                <Ionicons name="chatbubbles-outline" size={40} color={Colors.textMuted} />
                <Text style={styles.emptyText}>
                  {search.trim() ? 'Sin resultados' : 'No tienes conversaciones aun'}
                </Text>
              </>
            )}
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={loadingChats}
            onRefresh={refreshConversations}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
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
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
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
    flexWrap: 'wrap',
  },
  onlineAvatar: {
    alignItems: 'center',
    gap: 4,
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.base,
  },
});
