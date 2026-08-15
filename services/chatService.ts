import { supabase } from '@/lib/supabase';
import { AppConversation, AppMessage, DbMessage, DbUserProfile } from '@/types/database';
import { mapDbProfileToAppUser } from './authService';

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}

function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export async function fetchConversations(currentUserId: string): Promise<AppConversation[]> {
  // Get all conversation IDs the user is in
  const { data: participantRows, error: partErr } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', currentUserId);

  if (partErr || !participantRows?.length) return [];

  const convIds = participantRows.map((r: any) => r.conversation_id);

  // Get other participants for each conversation
  const { data: otherParts, error: othersErr } = await supabase
    .from('conversation_participants')
    .select('conversation_id, user_id, user_profiles(*)')
    .in('conversation_id', convIds)
    .neq('user_id', currentUserId);

  if (othersErr || !otherParts) return [];

  // Get last message for each conversation
  const { data: conversations, error: convErr } = await supabase
    .from('conversations')
    .select('*')
    .in('id', convIds)
    .order('updated_at', { ascending: false });

  if (convErr || !conversations) return [];

  // Get last message per conversation
  const lastMessagesPromises = convIds.map((id: string) =>
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  );

  const lastMessagesResults = await Promise.all(lastMessagesPromises);

  // Count unread per conversation
  const unreadPromises = convIds.map((id: string) =>
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', id)
      .eq('read', false)
      .neq('sender_id', currentUserId)
  );

  const unreadResults = await Promise.all(unreadPromises);

  return conversations
    .map((conv: any, idx: number) => {
      const otherPart = otherParts.find((p: any) => p.conversation_id === conv.id);
      if (!otherPart) return null;

      const otherUser = mapDbProfileToAppUser(otherPart.user_profiles as DbUserProfile);
      const lastMsg = lastMessagesResults[idx].data as any;
      const unreadCount = unreadResults[idx].count ?? 0;

      return {
        id: conv.id,
        other_user: otherUser,
        last_message: lastMsg?.text ?? '',
        last_time: lastMsg ? formatTimestamp(lastMsg.created_at) : '',
        unread: unreadCount,
        online: false,
        messages: [],
        updated_at: conv.updated_at,
      } as AppConversation;
    })
    .filter(Boolean) as AppConversation[];
}

export async function fetchMessages(conversationId: string): Promise<AppMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  return (data as DbMessage[]).map(m => ({
    id: m.id,
    conversation_id: m.conversation_id,
    sender_id: m.sender_id,
    text: m.text,
    read: m.read,
    created_at: m.created_at,
    timestamp: formatMessageTime(m.created_at),
  }));
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  text: string
): Promise<{ data: AppMessage | null; error: string | null }> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, text })
    .select('*')
    .single();

  if (error) return { data: null, error: error.message };

  // Update conversation updated_at
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  const msg = data as DbMessage;
  return {
    data: {
      id: msg.id,
      conversation_id: msg.conversation_id,
      sender_id: msg.sender_id,
      text: msg.text,
      read: msg.read,
      created_at: msg.created_at,
      timestamp: formatMessageTime(msg.created_at),
    },
    error: null,
  };
}

export async function markMessagesRead(
  conversationId: string,
  currentUserId: string
): Promise<void> {
  await supabase
    .from('messages')
    .update({ read: true })
    .eq('conversation_id', conversationId)
    .eq('read', false)
    .neq('sender_id', currentUserId);
}

export async function getOrCreateConversation(otherUserId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_or_create_conversation', {
    other_user_id: otherUserId,
  });
  if (error) {
    console.error('getOrCreateConversation error:', error.message);
    return null;
  }
  return data as string;
}
