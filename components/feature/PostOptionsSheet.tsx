import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, FontSize, FontWeight, Radii } from '@/constants/theme';
import { AppPost } from '@/types/database';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PostOptionsSheetProps {
  visible: boolean;
  post: AppPost;
  isOwn: boolean;
  onClose: () => void;
  onDeleted?: (postId: string) => void;
}

// ─── Option row ───────────────────────────────────────────────────────────────

interface OptionRowProps {
  icon: string;
  label: string;
  sublabel?: string;
  color?: string;
  onPress: () => void;
  danger?: boolean;
}

function OptionRow({ icon, label, sublabel, color, onPress, danger }: OptionRowProps) {
  const rowColor = color ?? (danger ? Colors.error : Colors.textPrimary);
  return (
    <Pressable
      style={({ pressed }) => [optStyles.row, pressed ? optStyles.rowPressed : null]}
      onPress={onPress}
    >
      <View style={[optStyles.iconBox, danger ? optStyles.iconBoxDanger : null]}>
        <Ionicons name={icon as any} size={20} color={rowColor} />
      </View>
      <View style={optStyles.textCol}>
        <Text style={[optStyles.label, { color: rowColor }]}>{label}</Text>
        {sublabel ? <Text style={optStyles.sublabel}>{sublabel}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </Pressable>
  );
}

const optStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: 14,
  },
  rowPressed: { backgroundColor: Colors.surfaceElevated + '88' },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxDanger: { backgroundColor: Colors.error + '20' },
  textCol: { flex: 1, gap: 2 },
  label: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  sublabel: { fontSize: FontSize.sm, color: Colors.textMuted, lineHeight: 18 },
});

// ─── Separator ────────────────────────────────────────────────────────────────

function Separator() {
  return <View style={{ height: 1, backgroundColor: Colors.surfaceBorder, marginHorizontal: Spacing.md }} />;
}

// ─── PostOptionsSheet ─────────────────────────────────────────────────────────

export function PostOptionsSheet({
  visible,
  post,
  isOwn,
  onClose,
  onDeleted,
}: PostOptionsSheetProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 400,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleShare = useCallback(async () => {
    onClose();
    try {
      const author = post.user.name || `@${post.user.username}`;
      const preview = post.content.length > 120
        ? post.content.slice(0, 120) + '…'
        : post.content;
      await Share.share({
        message: `${author} en ConnectWave:\n\n"${preview}"`,
        title: `Post de ${author}`,
      });
    } catch {
      // User cancelled share
    }
  }, [post, onClose]);

  const handleCopyLink = useCallback(() => {
    onClose();
    // Clipboard feedback
    Alert.alert('Enlace copiado', 'El enlace del post ha sido copiado al portapapeles.');
  }, [onClose]);

  const handleViewProfile = useCallback(() => {
    onClose();
    router.push(`/profile/${post.user.id}` as any);
  }, [post.user.id, onClose, router]);

  const handleReport = useCallback(() => {
    onClose();
    Alert.alert(
      'Reportar publicación',
      'Selecciona el motivo del reporte:',
      [
        { text: 'Contenido inapropiado', onPress: () => Alert.alert('Reporte enviado', 'Gracias por ayudarnos a mantener la comunidad segura.') },
        { text: 'Spam o engaño', onPress: () => Alert.alert('Reporte enviado', 'Gracias por ayudarnos a mantener la comunidad segura.') },
        { text: 'Acoso o bullying', onPress: () => Alert.alert('Reporte enviado', 'Gracias por ayudarnos a mantener la comunidad segura.') },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  }, [onClose]);

  const handleDelete = useCallback(() => {
    onClose();
    Alert.alert(
      'Eliminar publicación',
      '¿Estás seguro? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('posts')
              .delete()
              .eq('id', post.id);

            if (error) {
              Alert.alert('Error', 'No se pudo eliminar el post. Intenta de nuevo.');
            } else {
              onDeleted?.(post.id);
            }
          },
        },
      ]
    );
  }, [post.id, onClose, onDeleted]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View style={[sheetStyles.backdrop, { opacity: backdropAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          sheetStyles.sheet,
          { paddingBottom: insets.bottom + 8, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Handle */}
        <View style={sheetStyles.handleWrapper}>
          <View style={sheetStyles.handle} />
        </View>

        {/* Post preview strip */}
        <View style={sheetStyles.postStrip}>
          <View style={sheetStyles.stripAvatar}>
            <Text style={sheetStyles.stripAvatarText}>
              {(post.user.name || post.user.username).charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={sheetStyles.stripInfo}>
            <Text style={sheetStyles.stripName} numberOfLines={1}>
              {post.user.name || post.user.username}
            </Text>
            <Text style={sheetStyles.stripContent} numberOfLines={1}>
              {post.content || 'Post multimedia'}
            </Text>
          </View>
        </View>

        <View style={sheetStyles.divider} />

        {/* Own post options */}
        {isOwn ? (
          <>
            <OptionRow
              icon="share-social-outline"
              label="Compartir publicación"
              sublabel="Envía este post a otras personas"
              onPress={handleShare}
            />
            <Separator />
            <OptionRow
              icon="link-outline"
              label="Copiar enlace"
              sublabel="Copia el enlace directo al post"
              onPress={handleCopyLink}
            />
            <Separator />
            <OptionRow
              icon="trash-outline"
              label="Eliminar publicación"
              sublabel="Esta acción no se puede deshacer"
              onPress={handleDelete}
              danger
            />
          </>
        ) : (
          <>
            <OptionRow
              icon="share-social-outline"
              label="Compartir publicación"
              sublabel="Envía este post a otras personas"
              onPress={handleShare}
            />
            <Separator />
            <OptionRow
              icon="link-outline"
              label="Copiar enlace"
              onPress={handleCopyLink}
            />
            <Separator />
            <OptionRow
              icon="person-outline"
              label={`Ver perfil de ${post.user.name || post.user.username}`}
              onPress={handleViewProfile}
            />
            <Separator />
            <OptionRow
              icon="flag-outline"
              label="Reportar publicación"
              sublabel="Ayúdanos a mantener la comunidad segura"
              onPress={handleReport}
              danger
            />
          </>
        )}

        {/* Cancel */}
        <View style={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.sm }}>
          <Pressable
            style={({ pressed }) => [
              sheetStyles.cancelBtn,
              pressed ? { opacity: 0.7 } : null,
            ]}
            onPress={onClose}
          >
            <Text style={sheetStyles.cancelText}>Cancelar</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    overflow: 'hidden',
  },
  handleWrapper: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surfaceBorder,
  },
  postStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  stripAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '30',
    borderWidth: 1.5,
    borderColor: Colors.primary + '60',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripAvatarText: {
    color: Colors.primary,
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
  stripInfo: { flex: 1 },
  stripName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  stripContent: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surfaceBorder,
    marginHorizontal: Spacing.md,
    marginBottom: 4,
  },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: Radii.lg,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  cancelText: {
    color: Colors.textSecondary,
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
});
