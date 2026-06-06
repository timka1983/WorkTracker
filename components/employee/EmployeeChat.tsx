import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MessageSquare, Trash2, ShieldAlert, ChevronUp } from 'lucide-react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { supabase, db } from '../../lib/supabase';
import { ChatMessage, User } from '../../types';

interface EmployeeChatProps {
  currentUser: User | null;
  orgId: string;
  users: User[];
}

export const EmployeeChat: React.FC<EmployeeChatProps> = ({ currentUser, orgId, users }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendToAdmin, setSendToAdmin] = useState(false);
  const [replyToUser, setReplyToUser] = useState<{ id: string, name: string } | null>(null);
  // Fix 5: состояния для пагинации
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // Fix 6: ref для Virtuoso вместо messagesEndRef
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const isChatAdmin = !!currentUser?.isChatAdmin || !!currentUser?.isAdmin || currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'EMPLOYER';

  const visibleMessages = messages.filter(msg => {
    if (!msg.toAdminOnly) return true;
    if (isChatAdmin) return true;
    if (msg.senderId === currentUser?.id) return true;
    if (msg.recipientId === currentUser?.id) return true;
    return false;
  });

  const isUserAdmin = (userId: string) => {
     const user = users.find(u => u.id === userId);
     return user?.isAdmin || user?.role === 'EMPLOYER' || user?.role === 'SUPER_ADMIN';
  };

  useEffect(() => {
    // Fix 5: загружаем только последние 50 сообщений
    const fetchMessages = async () => {
      if (!orgId) return;
      const initialMessages = await db.getChatMessages(orgId, 50);
      setMessages(initialMessages);
      setHasMore(initialMessages.length === 50);
    };

    fetchMessages();

    if (!orgId) return;

    const channel = supabase
      .channel(`employee_chat_${orgId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'chat_messages',
        filter: `organization_id=eq.${orgId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new;
          setMessages(prev => {
            // Дедупликация — пропускаем если уже есть (оптимистичный UI)
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, {
              id: newMsg.id,
              organizationId: newMsg.organization_id,
              senderId: newMsg.sender_id,
              senderName: newMsg.sender_name,
              message: newMsg.message,
              createdAt: newMsg.created_at,
              isDeleted: newMsg.is_deleted,
              deletedBy: newMsg.deleted_by,
              deletedAt: newMsg.deleted_at,
              toAdminOnly: newMsg.to_admin_only,
              recipientId: newMsg.recipient_id,
              recipientName: newMsg.recipient_name
            }].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          });
        } else if (payload.eventType === 'UPDATE') {
          const updatedMsg = payload.new;
          setMessages(prev => prev.map(m => m.id === updatedMsg.id ? {
            ...m,
            isDeleted: updatedMsg.is_deleted,
            deletedBy: updatedMsg.deleted_by,
            deletedAt: updatedMsg.deleted_at
          } : m));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId]);

  // Fix 5: подгрузка более старых сообщений при скролле вверх
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || messages.length === 0 || !orgId) return;
    setLoadingMore(true);
    const oldest = messages[0].createdAt;
    const older = await db.getChatMessages(orgId, 50, oldest);
    setMessages(prev => [...older, ...prev]);
    setHasMore(older.length === 50);
    setLoadingMore(false);
  }, [hasMore, loadingMore, messages, orgId]);

  // Fix 7: оптимистичный UI — сообщение появляется мгновенно
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser || !orgId) return;

    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      organizationId: orgId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      message: newMessage.trim(),
      createdAt: new Date().toISOString(),
      toAdminOnly: sendToAdmin || !!replyToUser,
      recipientId: replyToUser?.id,
      recipientName: replyToUser?.name
    };

    // 1. Сразу очищаем поле ввода
    setNewMessage('');
    setReplyToUser(null);
    setSendToAdmin(false);

    // 2. Мгновенно добавляем в список (до ответа сервера)
    setMessages(prev => {
      if (prev.some(m => m.id === msg.id)) return prev;
      return [...prev, msg];
    });

    // 3. Сохраняем в Supabase в фоне
    const { error } = await db.saveChatMessage(msg);

    if (error) {
      // Если ошибка — убираем оптимистичное сообщение
      setMessages(prev => prev.filter(m => m.id !== msg.id));
      console.error('Ошибка отправки:', error);
      const errorMsg = typeof error === 'string' ? error : (error?.message || 'Неизвестная ошибка');
      alert('Ошибка отправки: ' + errorMsg + '\nСделайте диагностику базы данных в настройках (если вы работодатель).');
    }
    // Realtime вернёт INSERT → дедупликация по id пропустит дубль ✓
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!isChatAdmin || !currentUser) return;
    if (window.confirm('Удалить это сообщение?')) {
      await db.deleteChatMessage(messageId, currentUser.id);
    }
  };

  // Fix 6: рендер одного сообщения вынесен для Virtuoso
  const renderMessage = (msg: ChatMessage) => {
    const isMe = msg.senderId === currentUser?.id;
    const isDeleted = msg.isDeleted;
    const isPrivateReply = !!msg.recipientId;

    return (
      <div key={msg.id} className={`flex flex-col px-4 py-2 ${isMe ? 'items-end' : 'items-start'}`}>
        {isPrivateReply ? (
          <div className={`max-w-[80%] rounded-2xl p-3 shadow-md border-2 animate-in fade-in zoom-in duration-300 ${
            isMe 
              ? 'bg-indigo-600 border-indigo-400 text-white rounded-br-none' 
              : 'bg-indigo-50 dark:bg-indigo-900 border-indigo-200 dark:border-indigo-700 text-indigo-900 dark:text-indigo-100 rounded-bl-none'
          }`}>
            {!isMe && (
              <div className="flex items-center gap-1.5 mb-2">
                <div className="bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Лично вам</div>
                <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">{msg.senderName}</span>
              </div>
            )}
            {isMe && (
              <div className="flex items-center gap-1.5 mb-2 justify-end">
                <span className="text-[10px] font-black uppercase text-indigo-100">{msg.recipientName}</span>
                <div className="bg-white text-indigo-600 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Личный ответ</div>
              </div>
            )}
            <div className="text-sm overflow-hidden break-words font-semibold leading-relaxed">
              {msg.message}
            </div>
          </div>
        ) : (
          <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm ${
            isDeleted 
              ? 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400'
              : isMe 
                ? (msg.toAdminOnly ? 'bg-amber-600 text-white rounded-br-none' : 'bg-blue-600 text-white rounded-br-none') 
                : (msg.toAdminOnly ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 rounded-bl-none border border-amber-200 dark:border-amber-800/50' : 
                   (isUserAdmin(msg.senderId) ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-100 rounded-bl-none' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-none'))
          }`}>
            {!isMe && !isDeleted && (
              <div className="text-[10px] font-black uppercase text-slate-400 mb-1 flex items-center gap-1 flex-wrap">
                <span>{msg.senderName}</span>
                {msg.toAdminOnly && <span title="Только для администраторов"><ShieldAlert className="w-3 h-3 text-amber-500" /></span>}
              </div>
            )}
            {isMe && !isDeleted && msg.toAdminOnly && (
              <div className="text-[10px] font-black uppercase mb-1 flex items-center gap-1 justify-end flex-wrap">
                <ShieldAlert className="w-3 h-3 text-amber-300" /> <span className="text-amber-200">Только для админов</span>
              </div>
            )}
            <div className="text-sm overflow-hidden break-words font-medium">
              {isDeleted ? <em>Сообщение удалено администратором</em> : msg.message}
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 mt-1 px-1">
          <span className="text-[10px] font-semibold text-slate-400">
            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {!isDeleted && isChatAdmin && (
            <div className="flex items-center gap-2">
              {!isMe && !isPrivateReply && (
                <button
                  onClick={() => setReplyToUser({ id: msg.senderId, name: msg.senderName })}
                  className="text-[10px] font-bold text-blue-500 hover:text-blue-600 underline"
                >
                  Ответить лично
                </button>
              )}
              <button 
                onClick={() => handleDeleteMessage(msg.id)}
                className="text-slate-300 hover:text-red-500 transition-colors"
                title="Удалить сообщение"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md flex flex-col h-[600px] max-h-screen">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <MessageSquare className="text-blue-500 w-5 h-5" />
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-50 uppercase text-xs tracking-widest">Чат сотрудников</h3>
            {isChatAdmin && (
              <div className="flex items-center gap-1 mt-0.5">
                <ShieldAlert className="w-3 h-3 text-amber-500" />
                <span className="text-[9px] text-amber-600 dark:text-amber-500 font-bold uppercase">Включен режим администратора</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fix 6: Virtuoso вместо div + map — рендерит только видимые сообщения */}
      {visibleMessages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <MessageSquare className="w-12 h-12 mb-2 opacity-50" />
          <p className="text-sm font-medium">Нет сообщений</p>
          <p className="text-xs">Будьте первым, кто напишет!</p>
        </div>
      ) : (
        <Virtuoso
          ref={virtuosoRef}
          className="flex-1 custom-scrollbar"
          data={visibleMessages}
          followOutput="smooth"
          alignToBottom
          components={{
            // Fix 5: кнопка загрузки истории сверху
            Header: () => hasMore ? (
              <div className="flex justify-center py-2">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-blue-500 transition-colors disabled:opacity-50 py-1 px-3 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <ChevronUp className="w-3 h-3" />
                  {loadingMore ? 'Загрузка...' : 'Загрузить предыдущие'}
                </button>
              </div>
            ) : null
          }}
          itemContent={(_index, msg) => renderMessage(msg)}
        />
      )}

      <div className="p-4 border-t border-slate-100 dark:border-slate-800 shrink-0 flex flex-col gap-2">
        {replyToUser && (
          <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">Ответ для:</span>
              <span className="text-indigo-900 dark:text-indigo-100 font-bold">{replyToUser.name}</span>
            </div>
            <button 
              onClick={() => setReplyToUser(null)}
              className="text-indigo-400 hover:text-indigo-600 text-[10px] font-bold"
            >
              Отмена
            </button>
          </div>
        )}
        {!isChatAdmin && (
          <label className="flex items-center gap-2 self-start cursor-pointer group px-1">
            <input 
              type="checkbox" 
              checked={sendToAdmin} 
              onChange={e => setSendToAdmin(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-300 transition-colors uppercase tracking-widest flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" />
              Отправить только администратору
            </span>
          </label>
        )}
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Написать сообщение..."
            className="flex-1 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 shadow-inner dark:shadow-none min-w-0 font-medium"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className={`${(sendToAdmin || !!replyToUser) ? (replyToUser ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-amber-600 hover:bg-amber-700') : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-xl px-4 py-3 font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-sm`}
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};
