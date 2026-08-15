import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '@/components/ui/Avatar';
import { useApp } from '@/hooks/useApp';
import { Colors, Spacing, FontSize, FontWeight, Radii } from '@/constants/theme';
import { useRouter } from 'expo-router';

const MOOD_TAGS = ['🎵 Música', '📸 Fotos', '💡 Ideas', '🚀 Tech', '🌊 Vibes', '❤️ Amor', '🎨 Arte', '🌍 Travel'];

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentUser, addPost } = useApp();
  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [charCount, setCharCount] = useState(0);

  const MAX_CHARS = 280;

  const handleTextChange = (text: string) => {
    if (text.length <= MAX_CHARS) {
      setContent(text);
      setCharCount(text.length);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag].slice(0, 3)
    );
  };

  const handlePublish = () => {
    if (!content.trim()) {
      Alert.alert('Oops', 'Escribe algo antes de publicar.');
      return;
    }
    addPost(content.trim());
    setContent('');
    setSelectedTags([]);
    setCharCount(0);
    Alert.alert('Publicado', 'Tu post aparece en el Feed. Revisa!', [
      { text: 'Ver Feed', onPress: () => router.push('/') },
      { text: 'Seguir creando', style: 'cancel' },
    ]);
  };

  const progress = charCount / MAX_CHARS;
  const remaining = MAX_CHARS - charCount;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.cancelBtn} onPress={() => setContent('')} hitSlop={8}>
            <Text style={styles.cancelText}>Limpiar</Text>
          </Pressable>
          <Text style={styles.title}>Nuevo Post</Text>
          <Pressable onPress={handlePublish} disabled={!content.trim()}>
            <LinearGradient
              colors={content.trim() ? [Colors.primary, Colors.secondary] : [Colors.surfaceElevated, Colors.surfaceElevated]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.publishBtn}
            >
              <Text style={[styles.publishText, !content.trim() ? styles.publishTextDisabled : null]}>
                Publicar
              </Text>
            </LinearGradient>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          {/* User + Input */}
          <View style={styles.inputArea}>
            <Avatar uri={currentUser.avatar} size={44} />
            <View style={styles.inputWrapper}>
              <Text style={styles.userHandle}>@{currentUser.username}</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Que esta pasando en tu onda? 🌊"
                placeholderTextColor={Colors.textMuted}
                multiline
                value={content}
                onChangeText={handleTextChange}
                autoFocus
              />
            </View>
          </View>

          {/* Mood Tags */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tema</Text>
            <View style={styles.tagsGrid}>
              {MOOD_TAGS.map(tag => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    style={[styles.tag, isSelected ? styles.tagSelected : null]}
                    onPress={() => toggleTag(tag)}
                  >
                    <Text style={[styles.tagText, isSelected ? styles.tagTextSelected : null]}>
                      {tag}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Media options */}
          <View style={styles.mediaRow}>
            {[
              { icon: 'image-outline', label: 'Foto' },
              { icon: 'videocam-outline', label: 'Video' },
              { icon: 'location-outline', label: 'Lugar' },
              { icon: 'at-outline', label: 'Mencionar' },
            ].map(item => (
              <Pressable key={item.label} style={styles.mediaBtn}>
                <Ionicons name={item.icon as any} size={22} color={Colors.primary} />
                <Text style={styles.mediaBtnLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Character counter */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.counterBar}>
            <View style={[styles.counterFill, {
              width: `${progress * 100}%` as any,
              backgroundColor: remaining < 20 ? Colors.error : remaining < 60 ? Colors.warning : Colors.primary,
            }]} />
          </View>
          <Text style={[styles.counterText, remaining < 20 ? { color: Colors.error } : null]}>
            {remaining} caracteres restantes
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  cancelBtn: {
    minWidth: 70,
  },
  cancelText: {
    color: Colors.textMuted,
    fontSize: FontSize.base,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  publishBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.full,
    minWidth: 80,
    alignItems: 'center',
  },
  publishText: {
    color: '#fff',
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.base,
  },
  publishTextDisabled: {
    color: Colors.textMuted,
  },
  scroll: {
    flex: 1,
  },
  inputArea: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  inputWrapper: {
    flex: 1,
    gap: 6,
  },
  userHandle: {
    color: Colors.primaryLight,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  textInput: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    lineHeight: 26,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  section: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: 8,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  tagSelected: {
    backgroundColor: Colors.primary + '33',
    borderColor: Colors.primary,
  },
  tagText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  tagTextSelected: {
    color: Colors.primary,
  },
  mediaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: Spacing.md,
  },
  mediaBtn: {
    alignItems: 'center',
    gap: 4,
    padding: Spacing.sm,
    minWidth: 60,
    minHeight: 60,
    justifyContent: 'center',
  },
  mediaBtnLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  footer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    gap: 6,
  },
  counterBar: {
    height: 3,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  counterFill: {
    height: 3,
    borderRadius: 2,
  },
  counterText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    textAlign: 'right',
  },
});
