import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  TextInputSelectionChangeEventData,
  NativeSyntheticEvent,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { searchMentions } from '@/services/mentionService';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing, FontSize, FontWeight, Radii } from '@/constants/theme';
import { AppUser } from '@/types/database';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MentionInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  style?: any;
  inputStyle?: any;
  multiline?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
  returnKeyType?: 'default' | 'send' | 'done' | 'go' | 'search' | 'next';
  onSubmitEditing?: () => void;
  /** Direction the dropdown opens: 'down' (default) or 'up' */
  dropdownDirection?: 'down' | 'up';
  textAlignVertical?: 'auto' | 'top' | 'bottom' | 'center';
  minHeight?: number;
  maxHeight?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Given the full text and the current cursor position, extract
 * the @trigger word that the cursor is currently inside.
 * Returns null if the cursor is not inside an @word.
 */
function getActiveTrigger(
  text: string,
  cursorPos: number
): { prefix: string; triggerStart: number } | null {
  // Walk backwards from cursor to find '@'
  let i = cursorPos - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === '@') {
      const prefix = text.slice(i + 1, cursorPos);
      // Only valid if the prefix has no spaces and is right after @
      if (!/\s/.test(prefix)) {
        return { prefix, triggerStart: i };
      }
      break;
    }
    if (/\s/.test(ch)) break;
    i--;
  }
  return null;
}

// ─── MentionDropdown ──────────────────────────────────────────────────────────

interface MentionDropdownProps {
  users: AppUser[];
  loading: boolean;
  onSelect: (user: AppUser) => void;
  direction: 'down' | 'up';
}

function MentionDropdown({ users, loading, onSelect, direction }: MentionDropdownProps) {
  if (!loading && users.length === 0) return null;

  return (
    <View style={[dropStyles.container, direction === 'up' ? dropStyles.containerUp : dropStyles.containerDown]}>
      {loading ? (
        <View style={dropStyles.loadingRow}>
          <ActivityIndicator color={Colors.primary} size="small" />
          <Text style={dropStyles.loadingText}>Buscando...</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={u => u.id}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                dropStyles.item,
                pressed ? dropStyles.itemPressed : null,
              ]}
              onPress={() => onSelect(item)}
            >
              <Avatar uri={item.avatar} size={32} />
              <View style={dropStyles.itemInfo}>
                <View style={dropStyles.nameRow}>
                  <Text style={dropStyles.name} numberOfLines={1}>{item.name || item.username}</Text>
                  {item.verified ? (
                    <MaterialIcons name="verified" size={11} color={Colors.primary} />
                  ) : null}
                </View>
                <Text style={dropStyles.handle}>@{item.username}</Text>
              </View>
              {item.followers_count > 0 ? (
                <Text style={dropStyles.followers}>
                  {item.followers_count >= 1000
                    ? `${(item.followers_count / 1000).toFixed(1)}k`
                    : item.followers_count}
                </Text>
              ) : null}
            </Pressable>
          )}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
          bounces={false}
          style={{ maxHeight: 220 }}
        />
      )}
    </View>
  );
}

const dropStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    zIndex: 999,
    elevation: 8,
    // iOS shadows
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  containerDown: { top: '100%', marginTop: 4 },
  containerUp: { bottom: '100%', marginBottom: 4 },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: Spacing.md,
  },
  loadingText: { fontSize: FontSize.sm, color: Colors.textMuted },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder + '66',
  },
  itemPressed: { backgroundColor: Colors.surfaceElevated },
  itemInfo: { flex: 1, gap: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  handle: { fontSize: FontSize.xs, color: Colors.textMuted },
  followers: { fontSize: FontSize.xs, color: Colors.textMuted },
});

// ─── MentionInput ─────────────────────────────────────────────────────────────

export function MentionInput({
  value,
  onChangeText,
  placeholder,
  placeholderTextColor,
  style,
  inputStyle,
  multiline = true,
  maxLength,
  autoFocus,
  returnKeyType,
  onSubmitEditing,
  dropdownDirection = 'down',
  textAlignVertical,
  minHeight,
  maxHeight,
}: MentionInputProps) {
  const { user } = useAuth();
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorPosRef = useRef<number>(0);

  const [dropdownUsers, setDropdownUsers] = useState<AppUser[]>([]);
  const [dropdownLoading, setDropdownLoading] = useState(false);
  const [activeTrigger, setActiveTrigger] = useState<{
    prefix: string;
    triggerStart: number;
  } | null>(null);

  const showDropdown = activeTrigger !== null && (dropdownLoading || dropdownUsers.length > 0);

  // Search handler
  const doSearch = useCallback(
    async (prefix: string) => {
      if (!user?.id) return;
      setDropdownLoading(true);
      const results = await searchMentions(prefix, user.id);
      setDropdownUsers(results);
      setDropdownLoading(false);
    },
    [user?.id]
  );

  const handleChangeText = useCallback(
    (text: string) => {
      onChangeText(text);
      // Detect trigger at current cursor (cursorPosRef is updated on selection change)
      // Use text.length as fallback since cursor may not have updated yet
      const cursor = Math.min(cursorPosRef.current, text.length);
      const trigger = getActiveTrigger(text, cursor === 0 ? text.length : cursor);

      if (trigger) {
        setActiveTrigger(trigger);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!trigger.prefix) {
          setDropdownUsers([]);
          setDropdownLoading(false);
          return;
        }
        setDropdownLoading(true);
        debounceRef.current = setTimeout(() => doSearch(trigger.prefix), 300);
      } else {
        setActiveTrigger(null);
        setDropdownUsers([]);
        setDropdownLoading(false);
        if (debounceRef.current) clearTimeout(debounceRef.current);
      }
    },
    [onChangeText, doSearch]
  );

  const handleSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      const pos = e.nativeEvent.selection.end;
      cursorPosRef.current = pos;
      const trigger = getActiveTrigger(value, pos);
      if (trigger) {
        if (!activeTrigger || trigger.prefix !== activeTrigger.prefix) {
          setActiveTrigger(trigger);
          if (trigger.prefix) {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            setDropdownLoading(true);
            debounceRef.current = setTimeout(() => doSearch(trigger.prefix), 300);
          } else {
            setDropdownUsers([]);
            setDropdownLoading(false);
          }
        }
      } else {
        if (activeTrigger) {
          setActiveTrigger(null);
          setDropdownUsers([]);
          setDropdownLoading(false);
        }
      }
    },
    [value, activeTrigger, doSearch]
  );

  const handleSelectUser = useCallback(
    (u: AppUser) => {
      if (!activeTrigger) return;
      // Replace "@prefix" with "@username "
      const before = value.slice(0, activeTrigger.triggerStart);
      const after = value.slice(activeTrigger.triggerStart + 1 + activeTrigger.prefix.length);
      const newText = `${before}@${u.username} ${after}`;
      onChangeText(newText);
      setActiveTrigger(null);
      setDropdownUsers([]);
      setDropdownLoading(false);
      // Refocus input
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    [value, activeTrigger, onChangeText]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <View style={[wrapStyles.container, style]}>
      <TextInput
        ref={inputRef}
        style={[
          wrapStyles.input,
          minHeight ? { minHeight } : null,
          maxHeight ? { maxHeight } : null,
          inputStyle,
        ]}
        value={value}
        onChangeText={handleChangeText}
        onSelectionChange={handleSelectionChange}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor ?? Colors.textMuted}
        multiline={multiline}
        maxLength={maxLength}
        autoFocus={autoFocus}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        textAlignVertical={textAlignVertical}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardShouldPersistTaps="always"
      />

      {showDropdown ? (
        <MentionDropdown
          users={dropdownUsers}
          loading={dropdownLoading}
          onSelect={handleSelectUser}
          direction={dropdownDirection}
        />
      ) : null}
    </View>
  );
}

const wrapStyles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 10,
  },
  input: {
    color: Colors.textPrimary,
    fontSize: FontSize.base,
    lineHeight: 22,
  },
});
