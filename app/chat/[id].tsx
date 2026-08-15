import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/hooks/useAuth';
import { useApp } from '@/hooks/useApp';
import {
  fetchMessages,
  sendMessage as sendMessageService,
  markMessagesRead,
} from '@/services/chatService';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, FontSize, FontWeight, Radii } from '@/constants/theme';
import { AppMessage } from '@/types/database';

// Extended message type with media
interface ChatMessage extends AppMessage {
  media_url?: string;
  media_type_msg?: 'text' | 'image' | 'video';
}

async function uploadChatMedia(uri: string, userId: string, mimeType: string): Promise<string | null> {
  try {
    const ext = mimeType.split('/')[1] ?? 'jpg';
    const fileName = `${userId}/chat_${Date.now()}.${ext}`;
    const response = await fetch(uri);
    const blob = await response.blob();

    if (Platform.OS === 'web') {
      const { error } = await supabase.storage
        .from('posts-media')
        .upload(fileName, blob, { contentType: mimeType, upsert: false });
      if (error) return null;
    } else {
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
      });
      const { error } = await supabase.storage
        .from('posts-media')
        .upload(fileName, arrayBuffer, { contentType: mimeType, upsert: false });
      if (error) return null;
    }

    const { data } = supabase.storage.from('posts-media').getPublicUrl(fileName);
    return data.publicUrl;
  } catch {
    return null;
  }
}

export default function ChatDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { conversations, updateConversationOptimistic, markConversationRead } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const conversation = conversations.find(c => c.id === id);

  useEffect(() => {
    if (!id) return;
    setLoadingMessages(true);
    fetchMessages(id).then(msgs => {
      setMessages(msgs as ChatMessage[]);
      setLoadingMessages(false);
    });
  }, [id]);

  useEffect(() => {
    if (id && user?.id) {
      markMessagesRead(id, user.id);
      markConversationRead(id);
    }
  }, [id, user]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // Real-time subscription
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`messages:${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        payload => {
          const newMsg = payload.new as any;
          if (newMsg.sender_id === user?.id) return;
          const appMsg: ChatMessage = {
            id: newMsg.id,
            conversation_id: newMsg.conversation_id,
            sender_id: newMsg.sender_id,
            text: newMsg.text,
            read: newMsg.read,
            created_at: newMsg.created_at,
            timestamp: new Date(newMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            media_url: newMsg.media_url ?? undefined,
            media_type_msg: newMsg.media_type ?? 'text',
          };
          setMessages(prev => [...prev, appMsg]);
          if (user?.id) markMessagesRead(id, user.id);
        }
      )
      // Real-time read receipts
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        payload => {
          const updated = payload.new as any;
          setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, read: updated.read } : m));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, user]);

  const handleSend = useCallback(async (mediaUrl?: string, mediaType?: string) => {
    const text = mediaUrl ? (inputText.trim() || '') : inputText.trim();
    if (!text && !mediaUrl) return;
    if (!id || !user?.id || sending) return;

    const optimisticMsg: ChatMessage = {
      id: `temp_${Date.now()}`,
      conversation_id: id,
      sender_id: user.id,
      text: text || (mediaType === 'image' ? '📷 Foto' : '🎥 Video'),
      read: true,
      created_at: new Date().toISOString(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      media_url: mediaUrl,
      media_type_msg: (mediaType as any) ?? 'text',
    };

    setMessages(prev => [...prev, optimisticMsg]);
    if (!mediaUrl) setInputText('');
    setSending(true);

    const { data, error } = await sendMessageService(id, user.id, optimisticMsg.text, mediaUrl, mediaType);
    setSending(false);

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      if (!mediaUrl) setInputText(text);
    } else if (data) {
      setMessages(prev =>
        prev.map(m => (m.id === optimisticMsg.id ? { ...data, media_url: mediaUrl, media_type_msg: (mediaType as any) ?? 'text' } : m))
      );
      updateConversationOptimistic(id, { last_message: optimisticMsg.text, last_time: 'ahora', unread: 0 });
    }
  }, [inputText, id, user, sending, updateConversationOptimistic]);

  const pickAndSendImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0] && user?.id) {
      setUploadingMedia(true);
      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
      const url = await uploadChatMedia(asset.uri, user.id, mimeType);
      setUploadingMedia(false);
      if (url) {
        await handleSend(url, asset.type === 'video' ? 'video' : 'image');
      } else {
        Alert.alert('Error', 'No se pudo subir el archivo.');
      }
    }
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso requerido'); return; }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0] && user?.id) {
      setUploadingMedia(true);
      const asset = result.assets[0];
      const url = await uploadChatMedia(asset.uri, user.id, 'image/jpeg');
      setUploadingMedia(false);
      if (url) await handleSend(url, 'image');
    }
  };

  const showAttachOptions = () => {
    Alert.alert('Adjuntar', 'Elige una fuente', [
      { text: 'Cámara', onPress: pickFromCamera },
      { text: 'Galería', onPress: pickAndSendImage },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  if (!conversation && !loadingMessages) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: Colors.textMuted }}>Conversación no encontrada</Text>
      </View>
    );
  }

  const otherUser = conversation?.other_user;

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isMe = item.sender_id === user?.id;
    const isLast = index === messages.length - 1;
    const showReadReceipt = isMe && isLast;

    return (
      <View style={[styles.messageRow, isMe ? styles.messageRowMe : null]}>
        {!isMe && otherUser ? <Avatar uri={otherUser.avatar} size={28} /> : null}

        <View style={styles.bubbleWrapper}>
          {isMe ? (
            <LinearGradient
              colors={[Colors.primary, Colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.bubble, styles.bubbleMe]}
            >
              {item.media_url && item.media_type_msg === 'image' ? (
                <Image
                  source={{ uri: item.media_url }}
                  style={styles.chatMedia}
                  contentFit="cover"
                  transition={200}
                />
              ) : null}
              {item.text && item.text !== '📷 Foto' && item.text !== '🎥 Video' ? (
                <Text style={styles.bubbleMeText}>{item.text}</Text>
              ) : item.media_url ? null : (
                <Text style={styles.bubbleMeText}>{item.text}</Text>
              )}
              <View style={styles.bubbleMeta}>
                <Text style={styles.bubbleTime}>{item.timestamp}</Text>
                {showReadReceipt ? (
                  <Ionicons
                    name={item.read ? 'checkmark-done' : 'checkmark'}
                    size={14}
                    color={item.read ? Colors.info : 'rgba(255,255,255,0.5)'}
                    style={{ marginLeft: 3 }}
                  />
                ) : null}
              </View>
            </LinearGradient>
          ) : (
            <View style={[styles.bubble, styles.bubbleThem]}>
              {item.media_url && item.media_type_msg === 'image' ? (
                <Image
                  source={{ uri: item.media_url }}
                  style={styles.chatMedia}
                  contentFit="cover"
                  transition={200}
                />
              ) : null}
              {item.text && item.text !== '📷 Foto' && item.text !== '🎥 Video' ? (
                <Text style={styles.bubbleThemText}>{item.text}</Text>
              ) : item.media_url ? null : (
                <Text style={styles.bubbleThemText}>{item.text}</Text>
              )}
              <Text style={[styles.bubbleTime, { color: Colors.textMuted }]}>{item.timestamp}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
          </Pressable>
          {otherUser ? (
            <>
              <Avatar uri={otherUser.avatar} size={38} online={conversation?.online} />
              <View style={styles.headerInfo}>
                <Text style={styles.headerName}>{otherUser.name}</Text>
                <Text style={styles.headerStatus}>
                  {conversation?.online ? 'En línea' : '@' + otherUser.username}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.headerInfo}>
              <Text style={styles.headerName}>Chat</Text>
            </View>
          )}
          <Pressable hitSlop={8} style={styles.headerAction}>
            <Ionicons name="call-outline" size={22} color={Colors.primary} />
          </Pressable>
          <Pressable hitSlop={8} style={styles.headerAction}>
            <MaterialIcons name="more-vert" size={22} color={Colors.textSecondary} />
          </Pressable>
        </View>

        {/* Upload indicator */}
        {uploadingMedia ? (
          <View style={styles.uploadIndicator}>
            <ActivityIndicator color={Colors.primary} size="small" />
            <Text style={styles.uploadIndicatorText}>Subiendo media...</Text>
          </View>
        ) : null}

        {/* Messages */}
        {loadingMessages ? (
          <View style={styles.loadingMessages}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.emptyMessages}>
                <Text style={{ color: Colors.textMuted, fontSize: FontSize.base }}>
                  ¡Empieza la conversación! 👋
                </Text>
              </View>
            }
          />
        )}

        {/* Input bar */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          <Pressable style={styles.attachBtn} hitSlop={8} onPress={showAttachOptions}>
            <Ionicons name="add-circle-outline" size={26} color={Colors.primary} />
          </Pressable>
          <TextInput
            style={styles.textInput}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={Colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <Pressable
            style={[styles.sendBtn, !inputText.trim() ? styles.sendBtnDisabled : null]}
            onPress={() => handleSend()}
            disabled={!inputText.trim() || sending}
          >
            <LinearGradient
              colors={
                inputText.trim()
                  ? [Colors.primary, Colors.secondary]
                  : [Colors.surfaceElevated, Colors.surfaceElevated]
              }
              style={styles.sendBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons
                  name="send"
                  size={18}
                  color={inputText.trim() ? '#fff' : Colors.textMuted}
                  style={{ marginLeft: 2 }}
                />
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
    gap: 8,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1, marginLeft: 4 },
  headerName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  headerStatus: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  headerAction: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  uploadIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
    backgroundColor: Colors.surfaceElevated,
  },
  uploadIndicatorText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  loadingMessages: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyMessages: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: Spacing.xxl },
  messagesList: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: 10,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: '85%',
  },
  messageRowMe: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  bubbleWrapper: { maxWidth: '100%' },
  bubble: { padding: Spacing.sm + 2, borderRadius: Radii.lg, gap: 4 },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: Colors.surfaceElevated, borderBottomLeftRadius: 4 },
  bubbleMeText: { color: '#fff', fontSize: FontSize.base, lineHeight: 22 },
  bubbleThemText: { color: Colors.textPrimary, fontSize: FontSize.base, lineHeight: 22 },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  bubbleTime: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', textAlign: 'right' },
  chatMedia: {
    width: 200,
    height: 160,
    borderRadius: Radii.sm,
    marginBottom: 4,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    backgroundColor: Colors.background,
  },
  attachBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  textInput: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: FontSize.base,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnGradient: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
