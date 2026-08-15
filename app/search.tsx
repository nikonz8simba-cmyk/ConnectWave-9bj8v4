import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  Animated,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/hooks/useAuth';
import { searchUsers } from '@/services/searchService';
import { Colors, Spacing, FontSize, FontWeight, Radii, Shadows } from '@/constants/theme';
import { AppUser } from '@/types/database';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function UserSkeleton() {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 750, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View style={[skelStyles.row, { opacity }]}>
      <View style={skelStyles.avatar} />
      <View style={skelStyles.info}>
        <View style={skelStyles.name} />
        <View style={skelStyles.handle} />
      </View>
      <View style={skelStyles.btn} />
    </Animated.View>
  );
}

const skelStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: 12,
  },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.surfaceElevated },
  info: { flex: 1, gap: 7 },
  name: { height: 13, width: '45%', borderRadius: 6, backgroundColor: Colors.surfaceElevated },
  handle: { height: 11, width: '30%', borderRadius: 5, backgroundColor: Colors.surfaceElevated },
  btn: { height: 32, width: 84, borderRadius: Radii.full, backgroundColor: Colors.surfaceElevated },
});

// ─── User result card ─────────────────────────────────────────────────────────

interface UserCardProps {
  user: AppUser;
  onPress: (user: AppUser) => void;
  query: string;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return <Text>{text}</Text>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <Text>{text}</Text>;
  return (
    <>
      <Text>{text.slice(0, idx)}</Text>
      <Text style={{ color: Colors.primary, fontWeight: FontWeight.bold }}>
        {text.slice(idx, idx + query.length)}
      </Text>
      <Text>{text.slice(idx + query.length)}</Text>
    </>
  );
}

function UserCard({ user, onPress, query }: UserCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [cardStyles.row, pressed ? { backgroundColor: Colors.surface + 'AA' } : null]}
      onPress={() => onPress(user)}
    >
      <Avatar uri={user.avatar} size={50} />
      <View style={cardStyles.info}>
        <View style={cardStyles.nameRow}>
          <Text style={cardStyles.name} numberOfLines={1}>
            {highlightMatch(user.name || user.username, query)}
          </Text>
          {user.verified ? (
            <MaterialIcons name="verified" size={14} color={Colors.primary} style={{ marginLeft: 4 }} />
          ) : null}
        </View>
        <Text style={cardStyles.handle} numberOfLines={1}>
          @{highlightMatch(user.username, query)}
        </Text>
        {user.bio ? (
          <Text style={cardStyles.bio} numberOfLines={1}>{user.bio}</Text>
        ) : null}
      </View>
      <View style={cardStyles.meta}>
        <View style={cardStyles.viewBtn}>
          <Text style={cardStyles.viewBtnText}>Ver perfil</Text>
          <Ionicons name="chevron-forward" size={13} color={Colors.primary} />
        </View>
        {user.followers_count > 0 ? (
          <Text style={cardStyles.followers}>
            {user.followers_count >= 1000
              ? `${(user.followers_count / 1000).toFixed(1)}k`
              : user.followers_count}{' '}
            seg.
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: 12,
  },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  handle: { fontSize: FontSize.sm, color: Colors.textMuted },
  bio: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
  meta: { alignItems: 'flex-end', gap: 4 },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radii.full,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '12',
  },
  viewBtnText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  followers: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});

// ─── Empty & idle states ──────────────────────────────────────────────────────

function IdleState() {
  const suggestions = [
    { icon: 'trending-up-outline' as const, text: 'Busca por nombre completo' },
    { icon: 'at-outline' as const, text: 'O por nombre de usuario' },
    { icon: 'people-outline' as const, text: 'Descubre nuevos creadores' },
  ];
  return (
    <View style={stateStyles.container}>
      <LinearGradient
        colors={[Colors.primary + '20', Colors.secondary + '10']}
        style={stateStyles.iconBg}
      >
        <Ionicons name="search" size={40} color={Colors.primary} />
      </LinearGradient>
      <Text style={stateStyles.title}>Busca personas</Text>
      <Text style={stateStyles.subtitle}>Escribe un nombre o usuario para empezar</Text>
      <View style={stateStyles.tips}>
        {suggestions.map((s, i) => (
          <View key={i} style={stateStyles.tip}>
            <View style={stateStyles.tipIcon}>
              <Ionicons name={s.icon} size={16} color={Colors.primary} />
            </View>
            <Text style={stateStyles.tipText}>{s.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function EmptyResults({ query }: { query: string }) {
  return (
    <View style={stateStyles.container}>
      <LinearGradient
        colors={[Colors.surfaceElevated, Colors.surface]}
        style={stateStyles.iconBg}
      >
        <Ionicons name="person-outline" size={40} color={Colors.textMuted} />
      </LinearGradient>
      <Text style={stateStyles.title}>Sin resultados</Text>
      <Text style={stateStyles.subtitle}>
        No encontramos a nadie con{'\n'}
        <Text style={{ color: Colors.primary, fontWeight: FontWeight.semibold }}>
          "{query}"
        </Text>
      </Text>
      <Text style={stateStyles.hint}>Intenta con otro nombre o username</Text>
    </View>
  );
}

const stateStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: Spacing.xxl + Spacing.lg,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  iconBg: {
    width: 88,
    height: 88,
    borderRadius: 44,
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
  hint: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  tips: {
    marginTop: Spacing.md,
    gap: 10,
    alignSelf: 'stretch',
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.md,
  },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tipIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: { fontSize: FontSize.base, color: Colors.textSecondary },
});

// ─── Search screen ────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(timer);
  }, []);

  const doSearch = useCallback(
    async (text: string) => {
      if (!text.trim() || !user?.id) {
        setResults([]);
        setSearched(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      const data = await searchUsers(text.trim(), user.id);
      setResults(data);
      setSearched(true);
      setLoading(false);
    },
    [user?.id]
  );

  const handleChangeText = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!text.trim()) {
        setResults([]);
        setSearched(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      debounceRef.current = setTimeout(() => doSearch(text), 400);
    },
    [doSearch]
  );

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
    setLoading(false);
    inputRef.current?.focus();
  };

  const handleUserPress = useCallback(
    (u: AppUser) => {
      Keyboard.dismiss();
      router.push(`/profile/${u.id}` as any);
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: AppUser }) => (
      <UserCard user={item} onPress={handleUserPress} query={query} />
    ),
    [handleUserPress, query]
  );

  const keyExtractor = useCallback((item: AppUser) => item.id, []);

  const showSkeletons = loading && query.trim().length > 0;
  const showEmpty = !loading && searched && results.length === 0 && query.trim().length > 0;
  const showIdle = !loading && !searched && query.trim().length === 0;
  const showResults = !loading && results.length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={17} color={Colors.textMuted} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Buscar personas..."
            placeholderTextColor={Colors.textMuted}
            value={query}
            onChangeText={handleChangeText}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="never"
          />
          {query.length > 0 ? (
            <Pressable onPress={handleClear} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* ── Results count strip ───────────────────────────────────────── */}
      {showResults ? (
        <View style={styles.resultsMeta}>
          <Text style={styles.resultsCount}>
            {results.length} {results.length === 1 ? 'resultado' : 'resultados'}
          </Text>
        </View>
      ) : null}

      {/* ── Divider ──────────────────────────────────────────────────── */}
      <View style={styles.divider} />

      {/* ── Body ─────────────────────────────────────────────────────── */}
      {showSkeletons ? (
        <View>
          {[1, 2, 3, 4].map(i => <UserSkeleton key={i} />)}
        </View>
      ) : showIdle ? (
        <IdleState />
      ) : showEmpty ? (
        <EmptyResults query={query} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => (
            <View style={styles.separator} />
          )}
        />
      )}

      {/* ── Inline spinner while debounce fires ──────────────────────── */}
      {loading && query.trim().length > 0 && !showSkeletons ? (
        <View style={styles.spinnerOverlay}>
          <ActivityIndicator color={Colors.primary} size="small" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.base,
    paddingVertical: 0,
  },

  // Results meta
  resultsMeta: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  resultsCount: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.surfaceBorder,
    marginHorizontal: 0,
  },

  // List
  listContent: { paddingBottom: Spacing.xxl },
  separator: {
    height: 1,
    backgroundColor: Colors.surfaceBorder + '55',
    marginLeft: 74,
    marginRight: Spacing.md,
  },

  // Loading overlay
  spinnerOverlay: {
    position: 'absolute',
    top: 80,
    right: Spacing.md + 4,
  },
});
