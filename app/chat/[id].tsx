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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '@/components/ui/Avatar';
import { useApp } from '@/hooks/useApp';
import { Colors, Spacing, FontSize, FontWeight, Radii } from '@/constants/theme';
import { Message } from '@/constants/mockData';

export default function ChatDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { conversations, sendMessage, markConversationRead, currentUser } = useApp();
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const conversation = conversations.find(c => c.id === id);

  useEffect(() => {
    if (id) markConversationRead(id);
  }, [id]);

  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [conversation?.messages.length]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || !id) return;
    sendMessage(id, text);
    setInputText('');
  }, [inputText, id, sendMessage]);

  if (!conversation) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: Colors.textMuted }}>Conversacion no encontrada</Text>
      </View>
    );
  }

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === 'me';
    return (
      <View style={[styles.messageRow, isMe ? styles.messageRowMe : null]}>
        {!isMe ? (
          <Avatar uri={conversation.user.avatar} size={28} />
        ) : null}
        {isMe ? (
          <LinearGradient
            colors={[Colors.primary, Colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.bubble, styles.bubbleMe]}
          >
            <Text style={styles.bubbleMeText}>{item.text}</Text>
            <Text style={styles.bubbleTime}>{item.timestamp}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.bubble, styles.bubbleThem]}>
            <Text style={styles.bubbleThemText}>{item.text}</Text>
            <Text style={[styles.bubbleTime, { color: Colors.textMuted }]}>{item.timestamp}</Text>
          </View>
        )}
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
          <Avatar uri={conversation.user.avatar} size={38} online={conversation.online} />
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{conversation.user.name}</Text>
            <Text style={styles.headerStatus}>
              {conversation.online ? 'En linea' : 'Desconectado'}
            </Text>
          </View>
          <Pressable hitSlop={8} style={styles.headerAction}>
            <Ionicons name="call-outline" size={22} color={Colors.primary} />
          </Pressable>
          <Pressable hitSlop={8} style={styles.headerAction}>
            <MaterialIcons name="more-vert" size={22} color={Colors.textSecondary} />
          </Pressable>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={conversation.messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Input */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          <Pressable style={styles.attachBtn} hitSlop={8}>
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
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <LinearGradient
              colors={inputText.trim() ? [Colors.primary, Colors.secondary] : [Colors.surfaceElevated, Colors.surfaceElevated]}
              style={styles.sendBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons
                name="send"
                size={18}
                color={inputText.trim() ? '#fff' : Colors.textMuted}
                style={{ marginLeft: 2 }}
              />
            </LinearGradient>
          </Pressable>
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
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 4,
  },
  headerName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  headerStatus: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  headerAction: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesList: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: 10,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: '85%',
  },
  messageRowMe: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  bubble: {
    padding: Spacing.sm + 4,
    borderRadius: Radii.lg,
    maxWidth: '100%',
    gap: 4,
  },
  bubbleMe: {
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: Colors.surfaceElevated,
    borderBottomLeftRadius: 4,
  },
  bubbleMeText: {
    color: '#fff',
    fontSize: FontSize.base,
    lineHeight: 22,
  },
  bubbleThemText: {
    color: Colors.textPrimary,
    fontSize: FontSize.base,
    lineHeight: 22,
  },
  bubbleTime: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'right',
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
  attachBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
  sendBtnGradient: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
