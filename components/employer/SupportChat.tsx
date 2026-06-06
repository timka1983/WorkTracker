import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Send, MessageSquare, Search, ChevronLeft, Check, CheckCheck, Clock, Paperclip, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SupportMessage, User, UserRole } from '../../types';

interface SupportChatProps {
  currentUser: User | null;
  orgId: string;
  onOrgSelect?: (orgId: string) => void;
  unreadByOrg?: Record<string, number>;
}

// ─── Утилита форматирования времени ──────────────────────────────────────────
function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return time;
  if (isYesterday) return `Вчера, ${time}`;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + `, ${time}`;
}

// ─── Быстрые ответы для техподдержки ─────────────────────────────────────────
const QUICK_REPLIES = [
  'Здравствуйте! Чем могу помочь?',
  'Понял вас, разберёмся.',
  'Проблема устранена, попробуйте ещё раз.',
  'Для этого нужно зайти в Настройки → ',
  'Уточните, пожалуйста, какая версия приложения?',
];

export const SupportChat: React.FC<SupportChatProps> = ({
  currentUser,
  orgId,
  onOrgSelect,
  unreadByOrg = {},
}) => {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string>('all');
  const [orgSearchTerm, setOrgSearchTerm] = useState('');
  const [orgNames, setOrgNames] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'error'>('connecting');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const PAGE_SIZE = 50;

  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;

  // ── Загрузка имён организаций ───────────────────────────────────────────────
  useEffect(() => {
    if (!isSuperAdmin) return;
    supabase.from('organizations').select('id, name').then(({ data }) => {
      if (data) {
        const names: Record<string, string> = {};
        data.forEach(org => { names[org.id] = org.name; });
        setOrgNames(names);
      }
    });
  }, [isSuperAdmin]);

  // ── Загрузка сообщений ──────────────────────────────────────────────────────
  const fetchMessages = useCallback(async (beforeId?: string) => {
    if (!isSuperAdmin && !orgId) return;

    let query = supabase
      .from('support_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE + 1); // +1 чтобы понять есть ли ещё

    if (!isSuperAdmin) {
      query = query.eq('organization_id', orgId);
    } else if (selectedOrgId !== 'all') {
      query = query.eq('organization_id', selectedOrgId);
    }

    if (beforeId) {
      // Курсорная пагинация по created_at
      const pivot = messages.find(m => m.id === beforeId);
      if (pivot) query = query.lt('created_at', pivot.createdAt);
    }

    const { data } = await query;
    if (!data) return;

    const hasMoreData = data.length > PAGE_SIZE;
    const slice = data.slice(0, PAGE_SIZE).reverse().map((m: any) => ({
      id: m.id,
      senderId: m.sender_id,
      senderName: m.sender_name,
      organizationId: m.organization_id,
      message: m.message,
      createdAt: m.created_at,
    }));

    if (beforeId) {
      setMessages(prev => [...slice, ...prev]);
    } else {
      setMessages(slice);
    }
    setHasMore(hasMoreData);
  }, [isSuperAdmin, orgId, selectedOrgId, messages]);

  useEffect(() => {
    setMessages([]);
    setHasMore(false);
    fetchMessages();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, orgId, isSuperAdmin, selectedOrgId]);

  // ── Realtime подписка ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSuperAdmin && !orgId) return;

    const filter = !isSuperAdmin
      ? `organization_id=eq.${orgId}`
      : selectedOrgId !== 'all'
      ? `organization_id=eq.${selectedOrgId}`
      : undefined;

    setConnectionStatus('connecting');

    const channel = supabase
      .channel(`support_chat_${orgId || 'admin'}_${selectedOrgId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
        filter,
      }, (payload) => {
        if (payload.eventType !== 'INSERT') return;
        const m = payload.new;
        setMessages(prev => {
          if (prev.some(x => x.id === m.id)) return prev;
          return [...prev, {
            id: m.id,
            senderId: m.sender_id,
            senderName: m.sender_name,
            organizationId: m.organization_id,
            message: m.message,
            createdAt: m.created_at,
          }];
        });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConnectionStatus('connected');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setConnectionStatus('error');
        else setConnectionStatus('connecting');
      });

    return () => { supabase.removeChannel(channel); };
  }, [currentUser, orgId, isSuperAdmin, selectedOrgId]);

  // ── Автоскролл вниз ─────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedOrgId]);

  // ── Загрузить ещё (scroll up) ───────────────────────────────────────────────
  const handleLoadMore = async () => {
    if (!hasMore || isLoadingMore || messages.length === 0) return;
    const container = messagesContainerRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;

    setIsLoadingMore(true);
    await fetchMessages(messages[0].id);
    setIsLoadingMore(false);

    // Удерживаем позицию скролла после prepend
    requestAnimationFrame(() => {
      if (container) {
        container.scrollTop = container.scrollHeight - prevScrollHeight;
      }
    });
  };

  // ── Отправка сообщения ──────────────────────────────────────────────────────
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = newMessage.trim();
    if (!text || !currentUser || isSending) return;

    const targetOrgId = isSuperAdmin && selectedOrgId !== 'all' ? selectedOrgId : orgId;
    if (!targetOrgId) { alert('Ошибка: не выбрана организация'); return; }

    setIsSending(true);
    setShowQuickReplies(false);
    const { error } = await supabase.from('support_messages').insert({
      sender_id: currentUser.id,
      sender_name: isSuperAdmin ? 'Техподдержка' : currentUser.name,
      organization_id: targetOrgId,
      message: text,
      created_at: new Date().toISOString(),
    });

    setIsSending(false);
    if (!error) {
      setNewMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } else {
      alert('Ошибка при отправке сообщения');
    }
  };

  // ── Ctrl+Enter / Enter отправка ─────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ── Авторесайз textarea ─────────────────────────────────────────────────────
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    setShowQuickReplies(false);
  };

  // ── Сортировка организаций (непрочитанные вверх) ────────────────────────────
  const filteredOrgs = useMemo(() => {
    if (!isSuperAdmin) return [];
    const sorted = Object.entries(orgNames).sort(([idA, nameA], [idB, nameB]) => {
      const diff = (unreadByOrg[idB] || 0) - (unreadByOrg[idA] || 0);
      return diff !== 0 ? diff : nameA.localeCompare(nameB);
    });
    if (!orgSearchTerm.trim()) return sorted;
    const term = orgSearchTerm.toLowerCase();
    return sorted.filter(([, name]) => name.toLowerCase().includes(term));
  }, [orgNames, orgSearchTerm, isSuperAdmin, unreadByOrg]);

  useEffect(() => {
    if (!onOrgSelect) return;
    const targetId = isSuperAdmin ? (selectedOrgId !== 'all' ? selectedOrgId : null) : orgId;
    if (targetId) onOrgSelect(targetId);
  }, [selectedOrgId, orgId, isSuperAdmin, onOrgSelect]);

  // ── Группировка по дате ─────────────────────────────────────────────────────
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: SupportMessage[] }[] = [];
    let currentDate = '';
    const list = (isSuperAdmin && selectedOrgId === 'all')
      ? []
      : isSuperAdmin
      ? messages.filter(m => m.organizationId === selectedOrgId)
      : messages;

    for (const m of list) {
      const d = new Date(m.createdAt);
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      let label: string;
      if (d.toDateString() === now.toDateString()) label = 'Сегодня';
      else if (d.toDateString() === yesterday.toDateString()) label = 'Вчера';
      else label = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

      if (label !== currentDate) {
        currentDate = label;
        groups.push({ date: label, messages: [] });
      }
      groups[groups.length - 1].messages.push(m);
    }
    return groups;
  }, [messages, selectedOrgId, isSuperAdmin]);

  // ── Индикатор соединения ────────────────────────────────────────────────────
  const connDot = {
    connected: 'bg-emerald-400',
    connecting: 'bg-amber-400 animate-pulse',
    error: 'bg-red-400',
  }[connectionStatus];

  const connLabel = {
    connected: 'Онлайн',
    connecting: 'Подключение...',
    error: 'Ошибка соединения',
  }[connectionStatus];

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-slate-900/20 flex flex-col h-[600px]">

      {/* Шапка */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {isSuperAdmin && selectedOrgId !== 'all' ? (
            <button
              onClick={() => setSelectedOrgId('all')}
              className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
          ) : (
            <MessageSquare size={18} className="text-indigo-500 dark:text-indigo-400" />
          )}
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-50 text-xs uppercase tracking-widest leading-none">
              {isSuperAdmin && selectedOrgId !== 'all'
                ? (orgNames[selectedOrgId] || selectedOrgId)
                : 'Чат с техподдержкой'}
            </h3>
            {(!isSuperAdmin || selectedOrgId !== 'all') && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`w-1.5 h-1.5 rounded-full ${connDot}`} />
                <span className="text-[10px] text-slate-400">{connLabel}</span>
              </div>
            )}
          </div>
        </div>
        {isSuperAdmin && selectedOrgId !== 'all' && (
          <span className="text-[10px] text-slate-400">{messages.length} сообщ.</span>
        )}
      </div>

      {/* Список организаций (только SuperAdmin, режим 'all') */}
      {isSuperAdmin && selectedOrgId === 'all' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                value={orgSearchTerm}
                onChange={e => setOrgSearchTerm(e.target.value)}
                placeholder="Поиск организации..."
                className="w-full pl-8 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-indigo-500 transition-colors text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800">
            {filteredOrgs.length === 0 ? (
              <p className="p-8 text-center text-slate-400 text-sm">Организации не найдены</p>
            ) : filteredOrgs.map(([id, name]) => {
              const unread = unreadByOrg[id] || 0;
              return (
                <button
                  key={id}
                  onClick={() => setSelectedOrgId(id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${unread > 0 ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                    <span className={`text-sm truncate ${unread > 0 ? 'font-semibold text-slate-900 dark:text-slate-50' : 'font-medium text-slate-600 dark:text-slate-300'}`}>
                      {name}
                    </span>
                  </div>
                  {unread > 0 && (
                    <span className="ml-2 shrink-0 bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* Область сообщений */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-1"
          >
            {/* Кнопка «Загрузить ещё» */}
            {hasMore && (
              <div className="flex justify-center py-2">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline disabled:opacity-50"
                >
                  {isLoadingMore ? 'Загружаю...' : '↑ Загрузить предыдущие'}
                </button>
              </div>
            )}

            {groupedMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                <MessageSquare size={32} strokeWidth={1.5} />
                <p className="text-sm">Сообщений пока нет</p>
                {!isSuperAdmin && (
                  <p className="text-xs text-center max-w-[200px]">Напишите нам — обычно отвечаем в течение нескольких минут</p>
                )}
              </div>
            )}

            {groupedMessages.map(group => (
              <div key={group.date}>
                {/* Разделитель даты */}
                <div className="flex items-center gap-2 my-3">
                  <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                  <span className="text-[10px] text-slate-400 font-medium px-2">{group.date}</span>
                  <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                </div>

                {group.messages.map((m, idx) => {
                  const isOwn = m.senderId === currentUser?.id;
                  const isSupport = m.senderName === 'Техподдержка' || (isSuperAdmin && isOwn);

                  // Схлопываем имя если тот же отправитель что и предыдущее
                  const prevMsg = idx > 0 ? group.messages[idx - 1] : null;
                  const showSender = !prevMsg || prevMsg.senderId !== m.senderId;

                  return (
                    <div key={m.id} className={`flex flex-col mb-0.5 ${isOwn ? 'items-end' : 'items-start'}`}>
                      {/* Имя отправителя — только при смене */}
                      {showSender && (
                        <span className={`text-[10px] font-semibold mb-1 px-1 ${isSupport ? 'text-indigo-400' : 'text-slate-400'}`}>
                          {m.senderName}
                          {isSuperAdmin && m.organizationId && orgNames[m.organizationId] && !isOwn && (
                            <span className="font-normal text-slate-300 dark:text-slate-600"> · {orgNames[m.organizationId]}</span>
                          )}
                        </span>
                      )}

                      <div className={`group relative flex items-end gap-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
                        <div
                          className={`px-3.5 py-2.5 rounded-2xl text-sm max-w-[78%] break-words leading-relaxed shadow-sm ${
                            isOwn
                              ? 'bg-indigo-600 text-white rounded-br-sm'
                              : isSupport
                              ? 'bg-emerald-500 text-white rounded-bl-sm'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-sm'
                          }`}
                          style={{ wordBreak: 'break-word' }}
                        >
                          {m.message}
                        </div>

                        {/* Время + статус — появляется при ховере */}
                        <span className="text-[9px] text-slate-300 dark:text-slate-600 mb-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {formatMessageTime(m.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* Быстрые ответы (только для SuperAdmin) */}
          {isSuperAdmin && showQuickReplies && (
            <div className="px-3 pb-1 flex flex-wrap gap-1.5 border-t border-slate-100 dark:border-slate-800 pt-2 shrink-0">
              {QUICK_REPLIES.map(r => (
                <button
                  key={r}
                  onClick={() => { setNewMessage(r); setShowQuickReplies(false); textareaRef.current?.focus(); }}
                  className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 px-2.5 py-1 rounded-full transition-colors"
                >
                  {r.length > 35 ? r.slice(0, 35) + '…' : r}
                </button>
              ))}
              <button
                onClick={() => setShowQuickReplies(false)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Поле ввода */}
          <form
            onSubmit={handleSendMessage}
            className="px-3 py-3 border-t border-slate-100 dark:border-slate-800 flex gap-2 items-end shrink-0"
          >
            {/* Кнопка быстрых ответов */}
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setShowQuickReplies(v => !v)}
                title="Быстрые ответы"
                className={`p-2 rounded-xl transition-colors shrink-0 mb-0.5 ${showQuickReplies ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
              >
                <Paperclip size={18} />
              </button>
            )}

            <textarea
              ref={textareaRef}
              rows={1}
              value={newMessage}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={
                !currentUser ? 'Войдите, чтобы написать...' :
                !isSuperAdmin && !orgId ? 'Ошибка: организация не определена' :
                isSuperAdmin && selectedOrgId === 'all' ? 'Выберите организацию...' :
                'Сообщение... (Enter — отправить, Shift+Enter — новая строка)'
              }
              disabled={!currentUser || (!isSuperAdmin && !orgId) || (isSuperAdmin && selectedOrgId === 'all') || isSending}
              className="flex-1 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:focus:border-indigo-500 disabled:bg-slate-50 dark:disabled:bg-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 resize-none overflow-y-auto transition-colors placeholder:text-slate-400"
              style={{ minHeight: '42px', maxHeight: '120px' }}
            />

            <button
              type="submit"
              disabled={!currentUser || (!isSuperAdmin && !orgId) || (isSuperAdmin && selectedOrgId === 'all') || isSending || !newMessage.trim()}
              className="p-2.5 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shrink-0 mb-0.5"
            >
              {isSending
                ? <Clock size={18} className="animate-spin" />
                : <Send size={18} />
              }
            </button>
          </form>

          {/* Подсказка */}
          {!isSuperAdmin && (
            <p className="text-[10px] text-slate-300 dark:text-slate-600 text-center pb-2">
              Обычно отвечаем в течение нескольких минут
            </p>
          )}
        </>
      )}
    </div>
  );
};