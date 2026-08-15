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

  if (diffMins < 1) return 'ahora';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getLastMessagePreview(msg: any): string {
  if (!msg) return '';
  const mt = msg.media_type ?? 'text';
  if (mt === 'image') return '📷 Foto';
  if (mt === 'video') return '🎥 Video';
  return msg.text ?? '';
}

export async function fetchConversations(currentUserId: string): Promise<AppConversation[]> {
  // Get all conversation IDs the user is in
  const { data: participantRows, error: partErr } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', currentUserId);

  if (partErr || !participantRows?.length) return [];

  const convIds = participantRows.map((r: any) => r.conversation_id as string);

  // Fetch other participants + their profiles, conversations metadata, in parallel
  const [otherPartsRes, conversationsRes] = await Promise.all([
    supabase
      .from('conversation_participants')
      .select('conversation_id, user_id, user_profiles(*)')
      .in('conversation_id', convIds)
      .neq('user_id', currentUserId),
    supabase
      .from('conversations')
      .select('*')
      .in('id', convIds)
      .order('updated_at', { ascending: false }),
  ]);

  if (otherPartsRes.error || !otherPartsRes.data) return [];
  if (conversationsRes.error || !conversationsRes.data) return [];

  const otherParts = otherPartsRes.data;
  const conversations = conversationsRes.data;

  // Fetch last message and unread count per conversation in parallel
  const [lastMessagesResults, unreadResults] = await Promise.all([
    Promise.all(
      convIds.map((id: string) =>
        supabase
          .from('messages')
          .select('id, text, media_type, created_at, sender_id')
          .eq('conversation_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      )
    ),
    Promise.all(
      convIds.map((id: string) =>
        supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', id)
          .eq('read', false)
          .neq('sender_id', currentUserId)
      )
    ),
  ]);

  return conversations
    .map((conv: any) => {
      const convIdx = convIds.indexOf(conv.id);
      if (convIdx === -1) return null;

      const otherPart = otherParts.find((p: any) => p.conversation_id === conv.id);
      if (!otherPart) return null;

      const otherUser = mapDbProfileToAppUser(otherPart.user_profiles as DbUserProfile);
      const lastMsg = lastMessagesResults[convIdx]?.data as any;
      const unreadCount = unreadResults[convIdx]?.count ?? 0;

      return {
        id: conv.id,
        other_user: otherUser,
        last_message: getLastMessagePreview(lastMsg),
        last_time: lastMsg ? formatTimestamp(lastMsg.created_at) : '',
        last_message_sender_id: lastMsg?.sender_id ?? null,
        unread: unreadCount,
        online: false,
        messages: [],
        updated_at: conv.updated_at,
      } as AppConversation & { last_message_sender_id: string | null };
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
    media_url: (m as any).media_url ?? undefined,
    media_type: (m as any).media_type ?? 'text',
  }));
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  text: string,
  mediaUrl?: string,
  mediaType?: string
): Promise<{ data: AppMessage | null; error: string | null }> {
  const payload: any = {
    conversation_id: conversationId,
    sender_id: senderId,
    text,
  };
  if (mediaUrl) payload.media_url = mediaUrl;
  if (mediaType && mediaType !== 'text') payload.media_type = mediaType;

  const { data, error } = await supabase
    .from('messages')
    .insert(payload)
    .select('*')
    .single();

  if (error) return { data: null, error: error.message };

  // Update conversation updated_at so list re-sorts
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
      media_url: (msg as any).media_url ?? undefined,
      media_type: (msg as any).media_type ?? 'text',
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

export async function getUnreadCountForConversation(
  conversationId: string,
  currentUserId: string
): Promise<number> {
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .eq('read', false)
    .neq('sender_id', currentUserId);
  return count ?? 0;
}
