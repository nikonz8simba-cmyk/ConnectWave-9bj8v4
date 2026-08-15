import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/hooks/useAuth';
import { signOut } from '@/services/authService';
import { Colors, Spacing, FontSize, FontWeight, Radii } from '@/constants/theme';

const POST_IMAGES = [
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80',
  'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400&q=80',
  'https://images.unsplash.com/photo-1579547945413-497e1b99dac0?w=400&q=80',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
  'https://images.unsplash.com/photo-1559181567-c3190bef63dd?w=400&q=80',
];

type TabType = 'posts' | 'liked' | 'media';

function StatItem({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatStat(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('posts');
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = () => {
    Alert.alert('Cerrar sesion', 'Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await signOut();
          setSigningOut(false);
          router.replace('/auth');
        },
      },
    ]);
  };

  if (loading || !profile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'posts', label: 'Posts', icon: 'grid-outline' },
    { id: 'liked', label: 'Me gusta', icon: 'heart-outline' },
    { id: 'media', label: 'Media', icon: 'images-outline' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mi Perfil</Text>
          <View style={styles.headerActions}>
            <Pressable hitSlop={8} style={styles.headerBtn}>
              <Ionicons name="settings-outline" size={22} color={Colors.textSecondary} />
            </Pressable>
            <Pressable onPress={handleSignOut} hitSlop={8} style={styles.headerBtn} disabled={signingOut}>
              {signingOut ? (
                <ActivityIndicator color={Colors.error} size="small" />
              ) : (
                <Ionicons name="log-out-outline" size={22} color={Colors.error} />
              )}
            </Pressable>
          </View>
        </View>

        {/* Cover Banner */}
        <LinearGradient
          colors={[Colors.primary, Colors.secondary, Colors.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.coverBanner}
        >
          <View style={styles.waveLine} />
        </LinearGradient>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            <Avatar uri={profile.avatar} size={82} />
            <Pressable style={styles.editAvatarBtn}>
              <MaterialIcons name="edit" size={14} color="#fff" />
            </Pressable>
          </View>
          <View style={styles.headerRight}>
            <Pressable style={styles.followBtn}>
              <Text style={styles.followBtnText}>Editar perfil</Text>
            </Pressable>
            <Pressable style={styles.shareBtn}>
              <Ionicons name="share-social-outline" size={18} color={Colors.primary} />
            </Pressable>
          </View>
        </View>

        {/* User Info */}
        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{profile.name}</Text>
            {profile.verified ? (
              <MaterialIcons name="verified" size={16} color={Colors.primary} style={{ marginLeft: 4 }} />
            ) : null}
          </View>
          <Text style={styles.username}>@{profile.username}</Text>
          {profile.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : null}
          <Text style={styles.metaText}>{profile.email}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatItem value={formatStat(profile.posts_count)} label="Posts" />
          <View style={styles.statDivider} />
          <StatItem value={formatStat(profile.followers_count)} label="Seguidores" />
          <View style={styles.statDivider} />
          <StatItem value={formatStat(profile.following_count)} label="Siguiendo" />
        </View>

        {/* Tabs */}
        <View style={styles.tabsRow}>
          {tabs.map(tab => (
            <Pressable
              key={tab.id}
              style={[styles.tabBtn, activeTab === tab.id ? styles.tabBtnActive : null]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Ionicons
                name={tab.icon as any}
                size={18}
                color={activeTab === tab.id ? Colors.primary : Colors.textMuted}
              />
              <Text style={[styles.tabLabel, activeTab === tab.id ? styles.tabLabelActive : null]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Content Grid */}
        <View style={styles.gridContainer}>
          {activeTab === 'posts' ? (
            <View style={styles.emptyState}>
              <Ionicons name="create-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>Sin posts todavia</Text>
              <Text style={styles.emptySubtitle}>Crea tu primer post 🌊</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {POST_IMAGES.slice(0, activeTab === 'liked' ? 4 : 6).map((uri, idx) => (
                <Pressable key={idx} style={styles.gridItem}>
                  <Image
                    source={{ uri }}
                    style={styles.gridImage}
                    contentFit="cover"
                    transition={200}
                  />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  headerTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  coverBanner: {
    height: 120,
    marginBottom: -40,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 20,
    overflow: 'hidden',
  },
  waveLine: {
    width: '150%',
    height: 40,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    position: 'absolute',
    bottom: 0,
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  avatarWrapper: { position: 'relative' },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8 },
  followBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.full,
    backgroundColor: Colors.primary,
  },
  followBtnText: { color: '#fff', fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: { paddingHorizontal: Spacing.md, gap: 4, marginBottom: Spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  username: { fontSize: FontSize.base, color: Colors.textMuted },
  bio: { fontSize: FontSize.base, color: Colors.textSecondary, lineHeight: 22, marginTop: 4 },
  metaText: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  statItem: { alignItems: 'center', gap: 2 },
  statValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.medium },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.surfaceBorder, alignSelf: 'center' },
  tabsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: Spacing.sm,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: Colors.primary },
  tabLabel: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: FontWeight.medium },
  tabLabelActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
  gridContainer: { paddingHorizontal: Spacing.sm, paddingBottom: Spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  gridItem: { width: '32.5%', aspectRatio: 1, borderRadius: Radii.sm, overflow: 'hidden' },
  gridImage: { width: '100%', height: '100%' },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  emptySubtitle: { fontSize: FontSize.base, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
});
