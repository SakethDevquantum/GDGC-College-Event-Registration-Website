import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  Image as ImageIcon,
  MessageSquare,
  Plus,
  Search,
  Send,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  BRANCH_OPTIONS,
  YEAR_OPTIONS,
  ChatMessageRecord,
  NotificationRecord,
  UserProfile,
  filterUsersForFriends,
} from '../utils/eventLogic';

interface FriendsViewProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  friendIds: string[];
  initialMessages?: ChatMessageRecord[];
  darkMode: boolean;
  onAddFriend: (friendId: string) => Promise<void>;
  onRemoveFriend: (friendId: string) => Promise<void>;
  onIncomingNotification?: (notification: NotificationRecord) => void;
}

export const FriendsView: React.FC<FriendsViewProps> = ({
  currentUser,
  allUsers,
  friendIds,
  initialMessages = [],
  darkMode,
  onAddFriend,
  onRemoveFriend,
  onIncomingNotification,
}) => {
  const [showFinder, setShowFinder] = useState(false);
  const [search, setSearch] = useState('');
  const [searchBy, setSearchBy] = useState<'all' | 'name' | 'rollNumber' | 'branch' | 'year'>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');

  const currentFriends = allUsers.filter((u) => friendIds.includes(u.id));
  const filteredDirectory = filterUsersForFriends(allUsers, {
    search,
    searchBy,
    branchFilter,
    yearFilter,
    currentUserId: currentUser.id,
  });

  // Real-time WebSocket Chat State
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(() =>
    currentFriends.length > 0 ? currentFriends[0].id : null
  );
  const [messages, setMessages] = useState<ChatMessageRecord[]>(initialMessages);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [typingByUser, setTypingByUser] = useState<Record<string, boolean>>({});
  const [messageText, setMessageText] = useState('');
  const [attachedImageUrl, setAttachedImageUrl] = useState('');
  const [attachedImageName, setAttachedImageName] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const typingStopTimerRef = useRef<number | null>(null);
  const remoteTypingTimersRef = useRef<Record<string, number>>({});
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatSectionRef = useRef<HTMLDivElement | null>(null);

  // Sync initialMessages from parent state if updated
  useEffect(() => {
    if (Array.isArray(initialMessages) && initialMessages.length > 0) {
      setMessages((prev) => {
        const map = new Map<string, ChatMessageRecord>();
        for (const m of prev) map.set(m.id, m);
        for (const m of initialMessages) map.set(m.id, m);
        return Array.from(map.values()).sort(
          (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
        );
      });
    }
  }, [initialMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem('fest_cached_messages', JSON.stringify(messages));
      } catch {
        // Ignore quota errors
      }
    }
  }, [messages]);

  // Keep a valid selectedFriendId when friends list changes
  useEffect(() => {
    if (currentFriends.length === 0) {
      setSelectedFriendId(null);
    } else if (!selectedFriendId || !currentFriends.some((f) => f.id === selectedFriendId)) {
      setSelectedFriendId(currentFriends[0].id);
    }
  }, [currentFriends, selectedFriendId]);

  // Persistent WebSocket Connection to /ws/chat with auto-reconnect
  useEffect(() => {
    let isUnmounted = false;
    let reconnectTimer: number | null = null;

    const connectWebSocket = () => {
      if (isUnmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/chat`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmounted) return;
        ws.send(
          JSON.stringify({
            type: 'auth',
            userId: currentUser.id,
          })
        );
      };

      ws.onmessage = (event) => {
        if (isUnmounted) return;
        try {
          const data = JSON.parse(String(event.data));
          if (!data || typeof data !== 'object') return;

          if (data.type === 'messages:sync' && Array.isArray(data.messages)) {
            setMessages((prev) => {
              const map = new Map<string, ChatMessageRecord>();
              for (const m of prev) map.set(m.id, m);
              for (const m of data.messages) map.set(m.id, m);
              return Array.from(map.values()).sort(
                (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
              );
            });
          } else if (data.type === 'message:new' && data.message) {
            const incoming: ChatMessageRecord = data.message;
            setMessages((prev) => {
              if (prev.some((m) => m.id === incoming.id)) return prev;
              return [...prev, incoming].sort(
                (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
              );
            });
            if (data.notification && data.notification.userId === currentUser.id) {
              onIncomingNotification?.(data.notification as NotificationRecord);
            }
          } else if (data.type === 'typing' && data.senderId) {
            const senderId = String(data.senderId);
            const isTyping = Boolean(data.isTyping);
            setTypingByUser((prev) => ({ ...prev, [senderId]: isTyping }));

            if (remoteTypingTimersRef.current[senderId]) {
              window.clearTimeout(remoteTypingTimersRef.current[senderId]);
            }
            if (isTyping) {
              remoteTypingTimersRef.current[senderId] = window.setTimeout(() => {
                setTypingByUser((prev) => ({ ...prev, [senderId]: false }));
              }, 3500);
            }
          } else if (data.type === 'presence' && Array.isArray(data.onlineUserIds)) {
            setOnlineUserIds(data.onlineUserIds.map(String));
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = () => {
        if (isUnmounted) return;
        reconnectTimer = window.setTimeout(connectWebSocket, 1500);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWebSocket();

    return () => {
      isUnmounted = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      if (typingStopTimerRef.current !== null) {
        window.clearTimeout(typingStopTimerRef.current);
      }
      Object.values(remoteTypingTimersRef.current).forEach((t) => window.clearTimeout(t));
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [currentUser.id]);

  const selectedFriend = currentFriends.find((f) => f.id === selectedFriendId) || null;
  const conversationMessages = messages.filter(
    (m) =>
      selectedFriend &&
      ((m.senderId === currentUser.id && m.receiverId === selectedFriend.id) ||
        (m.senderId === selectedFriend.id && m.receiverId === currentUser.id))
  );

  // Auto-scroll chat box when messages or typing state changes
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [conversationMessages.length, selectedFriendId, typingByUser]);

  const emitTyping = (isTyping: boolean) => {
    if (!selectedFriend) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'typing',
          senderId: currentUser.id,
          receiverId: selectedFriend.id,
          isTyping,
        })
      );
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMessageText(val);

    if (!selectedFriend) return;
    const activelyTyping = val.trim().length > 0;
    emitTyping(activelyTyping);

    if (typingStopTimerRef.current !== null) {
      window.clearTimeout(typingStopTimerRef.current);
    }
    if (activelyTyping) {
      typingStopTimerRef.current = window.setTimeout(() => {
        emitTyping(false);
      }, 2200);
    }
  };

  const handleChatImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachedImageName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAttachedImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDownloadImageToDevice = (imageUrl: string, imageName: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = imageName || 'shared-picture.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFriend) return;
    const trimmedText = messageText.trim();
    if (!trimmedText && !attachedImageUrl) return;

    setSendingMsg(true);
    emitTyping(false);
    if (typingStopTimerRef.current !== null) {
      window.clearTimeout(typingStopTimerRef.current);
    }

    const payload = {
      senderId: currentUser.id,
      receiverId: selectedFriend.id,
      text: trimmedText,
      imageUrl: attachedImageUrl,
      imageName: attachedImageName || (attachedImageUrl ? 'shared-picture.png' : ''),
    };

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          const saved: ChatMessageRecord = data.message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === saved.id)) return prev;
            return [...prev, saved].sort(
              (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
            );
          });
        }
        setMessageText('');
        setAttachedImageUrl('');
        setAttachedImageName('');
      }
    } catch {
      // Fallback to direct WebSocket send if HTTP fails
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'send_message',
            ...payload,
          })
        );
        setMessageText('');
        setAttachedImageUrl('');
        setAttachedImageName('');
      }
    } finally {
      setSendingMsg(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-slide-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-tight">
            Campus Friends &amp; Live Chat
          </h1>
          <p className={`text-sm mt-1 ${darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
            Connect with campus friends, send messages with live typing indicators, and upload
            or download shared pictures directly to your device.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowFinder((prev) => !prev)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer self-start sm:self-auto active:scale-95 ${
            darkMode
              ? 'bg-[#BFFF00] hover:bg-[#d2ff4d] text-black'
              : 'bg-black hover:bg-[#7A00FF] text-white'
          }`}
        >
          {showFinder ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          <span>{showFinder ? 'Close Student Search' : 'Find & Add Friends'}</span>
        </button>
      </div>

      {/* Search & Filter Directory Panel (when + icon is clicked) */}
      {showFinder && (
        <div
          className={`p-6 rounded-md border space-y-5 animate-slide-left ${
            darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/15 bg-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Search &amp; Filter Campus Directory</h2>
            <span className="text-xs font-mono tabular-nums text-zinc-400">
              {filteredDirectory.length} students found
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search students by name, roll number, branch, or year"
                placeholder="Search by name or roll number (e.g. Saketh Reddy, 24951A05Y8)..."
                className={`w-full pl-10 pr-3.5 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 ${
                  darkMode
                    ? 'border-white/20 bg-[#050507] text-white focus:ring-[#BFFF00]'
                    : 'border-black/20 bg-zinc-50 text-black focus:ring-[#7A00FF]'
                }`}
              />
            </div>

            <div className="md:col-span-3">
              <select
                aria-label="Search field filter"
                value={searchBy}
                onChange={(e) => setSearchBy(e.target.value as any)}
                className={`w-full px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 ${
                  darkMode
                    ? 'border-white/20 bg-[#050507] text-white focus:ring-[#BFFF00]'
                    : 'border-black/20 bg-zinc-50 text-black focus:ring-[#7A00FF]'
                }`}
              >
                <option value="all">Search Field: All</option>
                <option value="name">Search by Name</option>
                <option value="rollNumber">Search by Roll Number</option>
                <option value="branch">Search by Branch</option>
                <option value="year">Search by Year</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <select
                aria-label="Filter by branch"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className={`w-full px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 ${
                  darkMode
                    ? 'border-white/20 bg-[#050507] text-white focus:ring-[#BFFF00]'
                    : 'border-black/20 bg-zinc-50 text-black focus:ring-[#7A00FF]'
                }`}
              >
                <option value="all">All Branches</option>
                {BRANCH_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <select
                aria-label="Filter by study year"
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className={`w-full px-3 py-2 rounded-md border text-sm font-mono tabular-nums focus:outline-none focus:ring-2 ${
                  darkMode
                    ? 'border-white/20 bg-[#050507] text-white focus:ring-[#BFFF00]'
                    : 'border-black/20 bg-zinc-50 text-black focus:ring-[#7A00FF]'
                }`}
              >
                <option value="all">All Years</option>
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={String(y)}>
                    Year {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {filteredDirectory.map((student) => {
              const isAlreadyFriend = friendIds.includes(student.id);
              return (
                <div
                  key={student.id}
                  className={`p-4 rounded-md border flex items-center justify-between gap-3 transition-all duration-300 ${
                    darkMode ? 'border-white/15 bg-[#050507]' : 'border-black/15 bg-zinc-50'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">{student.name}</div>
                    <div className="text-xs text-zinc-400 font-mono tabular-nums mt-0.5">
                      {student.rollNumber} · Year {student.year} · {student.branch}
                    </div>
                  </div>

                  {isAlreadyFriend ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-bold inline-flex items-center gap-1 ${darkMode ? 'text-[#BFFF00]' : 'text-emerald-600'}`}>
                        <UserCheck className="w-3.5 h-3.5" /> Already Friends
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveFriend(student.id)}
                        aria-label={`Remove friend ${student.name}`}
                        className="px-2.5 py-1.5 rounded-md border border-red-500/60 text-red-500 hover:bg-red-950/50 text-xs font-bold uppercase tracking-wider cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAddFriend(student.id)}
                      aria-label={`Add friend ${student.name}`}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider cursor-pointer shrink-0 active:scale-95 ${
                        darkMode
                          ? 'bg-[#BFFF00] hover:bg-[#d2ff4d] text-black'
                          : 'bg-black hover:bg-[#7A00FF] text-white'
                      }`}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add Friend</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Current Friends List */}
      <div
        className={`p-6 rounded-md border space-y-4 ${
          darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/15 bg-white'
        }`}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Users className={`w-4 h-4 ${darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}`} />
            <span>Your Friends ({currentFriends.length})</span>
          </h2>
          <span className="text-xs text-zinc-400">
            Click &ldquo;Chat&rdquo; on any friend card to message them
          </span>
        </div>

        {currentFriends.length === 0 ? (
          <div className="py-8 text-center space-y-3">
            <p className="text-sm text-zinc-400">
              You haven&apos;t added any campus friends yet.
            </p>
            <button
              type="button"
              onClick={() => setShowFinder(true)}
              className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider cursor-pointer active:scale-95 ${
                darkMode ? 'bg-[#BFFF00] text-black' : 'bg-black text-white'
              }`}
            >
              Search Students to Add Friends
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentFriends.map((friend) => {
              const isSelectedForChat = selectedFriend?.id === friend.id;
              return (
                <div
                  key={friend.id}
                  className={`p-4 rounded-md border flex flex-col justify-between gap-4 animate-card-left transition-all duration-300 ${
                    isSelectedForChat
                      ? darkMode
                        ? 'border-[#BFFF00] bg-[#050507]'
                        : 'border-[#7A00FF] bg-zinc-50'
                      : darkMode
                      ? 'border-white/15 bg-[#050507]'
                      : 'border-black/15 bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-full font-bold flex items-center justify-center text-sm shrink-0 ${
                          darkMode ? 'bg-[#BFFF00]/20 text-[#BFFF00]' : 'bg-black text-[#BFFF00]'
                        }`}
                      >
                        {friend.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate">{friend.name}</div>
                        <div className="text-xs text-zinc-400 font-mono tabular-nums">
                          {friend.rollNumber} · Year {friend.year} · {friend.branch}
                        </div>
                      </div>
                    </div>

                    {typingByUser[friend.id] && (
                      <span className="text-[11px] font-mono text-[#BFFF00] animate-pulse shrink-0">
                        typing...
                      </span>
                    )}
                  </div>

                  <div
                    className={`flex items-center justify-between gap-2 pt-2 border-t ${
                      darkMode ? 'border-white/15' : 'border-black/10'
                    }`}
                  >
                    <button
                      type="button"
                      data-testid={`open-chat-${friend.id}`}
                      onClick={() => {
                        setSelectedFriendId(friend.id);
                        chatSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider cursor-pointer transition-all duration-200 ${
                        isSelectedForChat
                          ? darkMode
                            ? 'bg-[#BFFF00] text-black'
                            : 'bg-black text-white'
                          : darkMode
                          ? 'border border-white/20 bg-[#0C0C10] text-white hover:border-[#BFFF00]'
                          : 'border border-black/20 bg-white text-black hover:bg-black hover:text-white'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Chat</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onRemoveFriend(friend.id)}
                      aria-label={`Remove ${friend.name} from friends`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider text-red-500 hover:bg-red-950/50 cursor-pointer"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      <span>Remove Friend</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Live WebSocket Friend Messenger Section */}
      {currentFriends.length > 0 && (
        <div
          ref={chatSectionRef}
          data-testid="friends-websocket-chat-section"
          className={`rounded-md border overflow-hidden ${
            darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/15 bg-white'
          }`}
        >
          {/* Messenger Header Bar */}
          <div
            className={`px-6 py-4 border-b flex items-center justify-between gap-4 flex-wrap ${
              darkMode ? 'border-white/15 bg-[#050507]' : 'border-black/10 bg-zinc-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <MessageSquare className={`w-5 h-5 ${darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}`} />
              <h2 className="font-display text-base sm:text-lg uppercase tracking-tight">
                Chat with your friends
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
            {/* Left Sidebar: Friends Conversation Selector */}
            <div
              className={`lg:col-span-4 border-b lg:border-b-0 lg:border-r p-4 space-y-2 max-h-[460px] overflow-y-auto ${
                darkMode ? 'border-white/15 bg-[#08080C]' : 'border-black/10 bg-zinc-50/60'
              }`}
            >
              <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 px-2 pb-1">
                Select Friend to Chat
              </div>
              {currentFriends.map((friend) => {
                const active = selectedFriend?.id === friend.id;
                const isOnline = onlineUserIds.includes(friend.id);
                const isFriendTyping = Boolean(typingByUser[friend.id]);
                const friendMsgs = messages.filter(
                  (m) =>
                    (m.senderId === currentUser.id && m.receiverId === friend.id) ||
                    (m.senderId === friend.id && m.receiverId === currentUser.id)
                );
                const lastMsg = friendMsgs[friendMsgs.length - 1];

                return (
                  <button
                    key={friend.id}
                    type="button"
                    data-testid={`chat-friend-tab-${friend.id}`}
                    onClick={() => setSelectedFriendId(friend.id)}
                    className={`w-full text-left p-3 rounded-md border transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 ${
                      active
                        ? darkMode
                          ? 'border-[#BFFF00] bg-[#BFFF00]/15 text-white'
                          : 'border-black bg-black text-white'
                        : darkMode
                        ? 'border-white/10 bg-[#0C0C10] hover:border-white/30 text-zinc-200'
                        : 'border-black/10 bg-white hover:border-black/30 text-zinc-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isOnline ? 'bg-emerald-400' : 'bg-zinc-500'
                          }`}
                        />
                        <span className="text-sm font-bold truncate">{friend.name}</span>
                      </div>
                      <div className="text-xs mt-0.5 truncate opacity-80">
                        {isFriendTyping ? (
                          <span className={darkMode ? 'text-[#BFFF00] font-semibold' : 'text-emerald-400 font-semibold'}>
                            Typing a message...
                          </span>
                        ) : lastMsg ? (
                          lastMsg.text || 'Shared a picture'
                        ) : (
                          `${friend.rollNumber} · ${friend.branch}`
                        )}
                      </div>
                    </div>

                    {friendMsgs.length > 0 && (
                      <span className="text-[11px] font-mono tabular-nums opacity-70 shrink-0">
                        {friendMsgs.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right Column: Active Chat Thread & Composer */}
            <div className="lg:col-span-8 flex flex-col justify-between h-[460px]">
              {selectedFriend ? (
                <>
                  {/* Active Friend Chat Subheader */}
                  <div
                    className={`px-5 py-3 border-b flex items-center justify-between gap-4 ${
                      darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/10 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                          darkMode ? 'bg-[#BFFF00] text-black' : 'bg-black text-[#BFFF00]'
                        }`}
                      >
                        {selectedFriend.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate">{selectedFriend.name}</div>
                        <div className="text-xs font-mono text-zinc-400 truncate">
                          {selectedFriend.rollNumber} · Year {selectedFriend.year} · {selectedFriend.branch}
                        </div>
                      </div>
                    </div>

                    {/* Live Typing Status Banner in Header */}
                    {typingByUser[selectedFriend.id] && (
                      <div
                        data-testid="friend-typing-indicator"
                        className={`px-3 py-1 rounded-md border text-xs font-mono font-bold animate-pulse ${
                          darkMode
                            ? 'border-[#BFFF00]/50 bg-[#BFFF00]/15 text-[#BFFF00]'
                            : 'border-[#7A00FF]/40 bg-[#7A00FF]/10 text-[#7A00FF]'
                        }`}
                      >
                        {selectedFriend.name} is typing...
                      </div>
                    )}
                  </div>

                  {/* Scrollable Message History */}
                  <div
                    ref={chatScrollRef}
                    data-testid="chat-messages-list"
                    className={`flex-1 p-5 overflow-y-auto space-y-4 ${
                      darkMode ? 'bg-[#050507]' : 'bg-zinc-50'
                    }`}
                  >
                    {conversationMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center py-10 space-y-2">
                        <MessageSquare className="w-8 h-8 text-zinc-500" />
                        <p className="text-sm font-medium text-zinc-400">
                          No messages with {selectedFriend.name} yet.
                        </p>
                        <p className="text-xs text-zinc-500 max-w-sm">
                          Send a message or upload a picture below to start chatting.
                        </p>
                      </div>
                    ) : (
                      conversationMessages.map((msg) => {
                        const isMine = msg.senderId === currentUser.id;
                        return (
                          <div
                            key={msg.id}
                            data-testid={`chat-message-${msg.id}`}
                            className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                          >
                            <div
                              className={`max-w-[80%] sm:max-w-[70%] rounded-md border p-3.5 space-y-2.5 ${
                                isMine
                                  ? darkMode
                                    ? 'border-[#BFFF00]/50 bg-[#BFFF00]/15 text-white'
                                    : 'border-black bg-black text-white'
                                  : darkMode
                                  ? 'border-white/15 bg-[#121218] text-zinc-100'
                                  : 'border-black/15 bg-white text-zinc-900'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-4 text-[11px] font-mono opacity-75">
                                <span className="font-bold">
                                  {isMine ? 'You' : selectedFriend.name}
                                </span>
                                <span>
                                  {new Date(msg.createdAt).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>

                              {msg.text && (
                                <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                                  {msg.text}
                                </p>
                              )}

                              {msg.imageUrl && (
                                <div className="space-y-2 pt-1">
                                  <img
                                    src={msg.imageUrl}
                                    alt={msg.imageName || 'Shared chat picture'}
                                    data-testid={`chat-image-${msg.id}`}
                                    className="max-h-60 w-auto rounded-md border border-white/20 object-contain bg-black/30"
                                  />
                                  <div className="flex items-center justify-between gap-2 pt-1">
                                    <span className="text-[11px] font-mono truncate opacity-75">
                                      {msg.imageName || 'shared-picture.png'}
                                    </span>
                                    <button
                                      type="button"
                                      data-testid={`download-chat-image-${msg.id}`}
                                      onClick={() =>
                                        handleDownloadImageToDevice(
                                          msg.imageUrl,
                                          msg.imageName || 'shared-picture.png'
                                        )
                                      }
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-bold uppercase tracking-wider cursor-pointer transition-all duration-200 ${
                                        darkMode
                                          ? 'bg-[#BFFF00] text-black hover:bg-[#d2ff4d]'
                                          : 'bg-[#7A00FF] text-white hover:opacity-90'
                                      }`}
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                      <span>Download</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* Inline Typing Bubble at Bottom of Thread */}
                    {typingByUser[selectedFriend.id] && (
                      <div className="flex items-center gap-2 text-xs font-mono text-[#BFFF00]">
                        <span className="w-2 h-2 rounded-full bg-[#BFFF00] animate-ping" />
                        <span>{selectedFriend.name} is typing a message...</span>
                      </div>
                    )}
                  </div>

                  {/* Attached Picture Preview Bar (Before Sending) */}
                  {attachedImageUrl && (
                    <div
                      data-testid="chat-attached-image-preview"
                      className={`px-4 py-2.5 border-t flex items-center justify-between gap-3 ${
                        darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/10 bg-zinc-100'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={attachedImageUrl}
                          alt="Attachment preview"
                          className="w-11 h-11 rounded-md object-cover border border-[#BFFF00] shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">
                            {attachedImageName || 'Picture ready to send'}
                          </div>
                          <div className="text-[11px] text-zinc-400">
                            Click Send to share this picture with {selectedFriend.name}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAttachedImageUrl('');
                          setAttachedImageName('');
                        }}
                        className="p-1.5 rounded-md text-red-400 hover:bg-red-950/40 cursor-pointer"
                        aria-label="Remove attached picture"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Message Input & Picture Upload Composer */}
                  <form
                    onSubmit={handleSendMessage}
                    className={`p-3.5 border-t flex items-center gap-2.5 ${
                      darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/10 bg-white'
                    }`}
                  >
                    <label
                      htmlFor="chat-upload-picture"
                      title="Upload picture to send"
                      className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-md border text-xs font-bold uppercase tracking-wider cursor-pointer shrink-0 transition-all duration-200 ${
                        darkMode
                          ? 'border-white/20 bg-[#050507] hover:border-[#BFFF00] text-white'
                          : 'border-black/20 bg-zinc-50 hover:bg-black hover:text-white text-black'
                      }`}
                    >
                      <ImageIcon className="w-4 h-4" />
                      <span className="hidden sm:inline">Upload Picture</span>
                      <input
                        id="chat-upload-picture"
                        data-testid="chat-upload-image-input"
                        type="file"
                        accept="image/*"
                        onChange={handleChatImageUpload}
                        className="hidden"
                      />
                    </label>

                    <input
                      type="text"
                      data-testid="chat-message-input"
                      value={messageText}
                      onChange={handleInputChange}
                      onBlur={() => emitTyping(false)}
                      placeholder={`Message ${selectedFriend.name}...`}
                      className={`flex-1 px-3.5 py-2.5 rounded-md border text-sm focus:outline-none focus:ring-2 ${
                        darkMode
                          ? 'border-white/20 bg-[#050507] text-white placeholder-zinc-500 focus:ring-[#BFFF00]'
                          : 'border-black/20 bg-zinc-50 text-black placeholder-zinc-400 focus:ring-[#7A00FF]'
                      }`}
                    />

                    <button
                      type="submit"
                      data-testid="chat-send-button"
                      disabled={sendingMsg || (!messageText.trim() && !attachedImageUrl)}
                      className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md text-xs font-bold uppercase tracking-wider cursor-pointer shrink-0 transition-all duration-200 disabled:opacity-40 ${
                        darkMode
                          ? 'bg-[#BFFF00] hover:bg-[#d2ff4d] text-black'
                          : 'bg-black hover:bg-[#7A00FF] text-white'
                      }`}
                    >
                      <Send className="w-4 h-4" />
                      <span>Send</span>
                    </button>
                  </form>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-zinc-400 p-6">
                  Select a friend on the left to start chatting.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Bottom-Right Plus Button for Friends Screen */}
      <button
        type="button"
        onClick={() => setShowFinder((prev) => !prev)}
        aria-label="Toggle search bar to add friends"
        className={`fixed bottom-6 right-6 z-30 w-14 h-14 rounded-md shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer border ${
          darkMode
            ? 'bg-[#BFFF00] hover:bg-[#d2ff4d] text-black border-white/20'
            : 'bg-black hover:bg-[#7A00FF] text-white border-black'
        }`}
      >
        <Plus className={`w-6 h-6 transition-transform duration-300 ${showFinder ? 'rotate-45' : ''}`} />
      </button>
    </div>
  );
};
