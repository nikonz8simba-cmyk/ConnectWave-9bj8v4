import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '@/components/ui/Avatar';
import { ChatListItem } from '@/components/feature/ChatListItem';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing, FontSize, FontWeight, Radii } from '@/constants/theme';
import { AppConversation } from '@/types/database';

// ─── Skeleton loader for conversations ───────────────────────────────────────

function ConversationSkeleton() {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View style={[skeletonStyles.row, { opacity }]}>
      <View style={skeletonStyles.avatar} />
      <View style={skeletonStyles.content}>
        <View style={skeletonStyles.nameLine} />
        <View style={skeletonStyles.msgLine} />
      </View>
      <View style={skeletonStyles.timeLine} />
    </Animated.View>
  );
}

const skeletonStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    gap: 12,
  },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: Colors.surfaceElevated },
  content: { flex: 1, gap: 8 },
  nameLine: { height: 13, width: '50%', borderRadius: 6, backgroundColor: Colors.surfaceElevated },
  msgLine: { height: 11, width: '75%', borderRadius: 5, backgroundColor: Colors.surfaceElevated },
  timeLine: { height: 10, width: 28, borderRadius: 5, backgroundColor: Colors.surfaceElevated },
});

// ─── Online user strip ────────────────────────────────────────────────────────

interface OnlineStripProps {
  conversations: AppConversation[];
  onPress: (conv: AppConversation) => void;
}

function OnlineStrip({ conversations, onPress }: OnlineStripProps) {
  if (conversations.length === 0) return null;
  return (
    <View style={onlineStyles.wrapper}>
      <Text style={onlineStyles.label}>En línea</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={onlineStyles.row}
      >
        {conversations.map(c => (
          <Pressable
            key={c.id}
            style={({ pressed }) => [onlineStyles.item, pressed ? { opacity: 0.7 } : null]}
            onPress={() => onPress(c)}
          >
            <Avatar uri={c.other_user.avatar} size={48} online />
            <Text style={onlineStyles.name} numberOfLines={1}>
              {c.other_user.name.split(' ')[0]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const onlineStyles = StyleSheet.create({
  wrapper: {
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
    marginBottom: Spacing.xs,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  row: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    alignItems: 'center',
  },
  item: { alignItems: 'center', gap: 4, width: 58 },
  name: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyChats({ loading }: { loading: boolean }) {
  if (loading) return null;
  return (
    <View style={emptyStyles.container}>
      <LinearGradient
        colors={[Colors.primary + '20', Colors.secondary + '10']}
        style={emptyStyles.iconBg}
      >
        <Ionicons name="chatbubbles-outline" size={44} color={Colors.primary} />
      </LinearGradient>
      <Text style={emptyStyles.title}>Sin conversaciones</Text>
      <Text style={emptyStyles.subtitle}>
        Cuando alguien te escriba o inicies un chat,{'\n'}aparecerá aquí.
      </Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  iconBg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.base,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
});

// ─── Chats screen ─────────────────────────────────────────────────────────────

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { conversations, loadingChats, refreshConversations, totalUnread } = useApp();
  const [search, setSearch] = useState('');
  const scrollY = useRef(new Animated.Value(0)).current;

  const filteredConversations = search.trim()
    ? conversations.filter(
        c =>
          c.other_user.name.toLowerCase().includes(search.toLowerCase()) ||
          c.other_user.username.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  const onlineConversations = conversations.filter(c => c.online);

  // Sort: unread first, then by updated_at
  const sortedConversations = [...filteredConversations].sort((a, b) => {
    if (a.unread > 0 && b.unread === 0) return -1;
    if (a.unread === 0 && b.unread > 0) return 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  const handlePress = useCallback(
    (conversation: AppConversation) => {
      router.push(`/chat/${conversation.id}`);
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: AppConversation }) => (
      <ChatListItem
        conversation={item}
        onPress={() => handlePress(item)}
        currentUserId={user?.id}
      />
    ),
    [handlePress, user?.id]
  );

  const keyExtractor = useCallback((item: AppConversation) => item.id, []);

  const headerElevation = scrollY.interpolate({
    inputRange: [0, 30],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.header,
          {
            borderBottomWidth: headerElevation,
            shadowOpacity: Animated.multiply(headerElevation, 0.3),
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Mensajes</Text>
          {totalUnread > 0 ? (
            <View style={styles.totalBadge}>
              <Text style={styles.totalBadgeText}>{totalUnread > 99 ? '99+' : totalUnread}</Text>
            </View>
          ) : null}
        </View>
        <Pressable style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="create-outline" size={22} color={Colors.primary} />
        </Pressable>
      </Animated.View>

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <View style={styles.searchWrapper}>
        <Ionicons name="search" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar conversaciones..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 ? (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={17} color={Colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {/* ── List ────────────────────────────────────────────────────────── */}
      <Animated.FlatList
        data={sortedConversations}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          sortedConversations.length === 0 ? styles.emptyContainer : styles.listContent
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          onlineConversations.length > 0 && !search.trim() ? (
            <OnlineStrip conversations={onlineConversations} onPress={handlePress} />
          ) : search.trim() ? (
            <View style={styles.sectionLabel}>
              <Text style={styles.sectionLabelText}>
                Resultados ({filteredConversations.length})
              </Text>
            </View>
          ) : (
            <View style={styles.sectionLabel}>
              <Text style={styles.sectionLabelText}>Recientes</Text>
            </View>
          )
        }
        ListEmptyComponent={
          loadingChats ? (
            <View style={styles.skeletonList}>
              {[1, 2, 3, 4, 5].map(i => (
                <ConversationSkeleton key={i} />
              ))}
            </View>
          ) : (
            <EmptyChats loading={loadingChats} />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={loadingChats && conversations.length > 0}
            onRefresh={refreshConversations}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomColor: Colors.surfaceBorder,
    backgroundColor: Colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    zIndex: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  totalBadge: {
    backgroundColor: Colors.secondary,
    borderRadius: Radii.full,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  totalBadgeText: { color: '#fff', fontSize: 11, fontWeight: FontWeight.bold },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  // Search
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.md,
    height: 42,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.base,
    paddingVertical: 0,
  },

  // Section label
  sectionLabel: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  sectionLabelText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // List
  listContent: { paddingBottom: Spacing.xl },
  emptyContainer: { flexGrow: 1 },
  separator: {
    height: 1,
    backgroundColor: Colors.surfaceBorder + '66',
    marginLeft: 78,
    marginRight: Spacing.md,
  },
  skeletonList: {},
});
