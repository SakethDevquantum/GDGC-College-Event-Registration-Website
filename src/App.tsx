import React, { useCallback, useEffect, useState } from 'react';
import './lib/firebase';
import {
  BranchType,
  ChatMessageRecord,
  EventFilterMode,
  EventRecord,
  FormFieldCategory,
  NotificationRecord,
  RegistrationEmailRecord,
  SEVEN_DAYS_MS,
  UserProfile,
  checkUserContactRequirements,
  computeEventRuntimeStatus,
  filterAndSortEvents,
  getParticipatedEvents,
  shouldAutoDeleteIgnoredEvent,
} from './utils/eventLogic';
import { EntryScreen } from './components/EntryScreen';
import { ToastPopup } from './components/ToastPopup';
import { EventCard, formatReadableDate } from './components/EventCard';
import { EventDetailsView } from './components/EventDetailsView';
import { GoogleFormView } from './components/GoogleFormView';
import { CreateEventWizard } from './components/CreateEventWizard';
import { FriendsView } from './components/FriendsView';
import { NotificationsView } from './components/NotificationsView';
import { ProfileView } from './components/ProfileView';
import {
  Bell,
  Calendar,
  CalendarClock,
  CheckSquare,
  EyeOff,
  FolderKanban,
  Home,
  Info,
  LogOut,
  Menu,
  Moon,
  Phone,
  Plus,
  Search,
  Star,
  Sun,
  User,
  UserPlus,
  X,
} from 'lucide-react';

type NavPage =
  | 'home'
  | 'profile'
  | 'friends'
  | 'my-events'
  | 'participations'
  | 'favourites'
  | 'scheduled'
  | 'ignored';

const MENU_ITEMS: { id: NavPage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'friends', label: 'Add friends', icon: UserPlus },
  { id: 'my-events', label: 'My Events', icon: FolderKanban },
  { id: 'participations', label: 'My Participations', icon: CheckSquare },
  { id: 'favourites', label: 'Favourites', icon: Star },
  { id: 'scheduled', label: 'Scheduled events', icon: CalendarClock },
  { id: 'ignored', label: 'Ignored events', icon: EyeOff },
];

export default function App() {
  // Default to Midnight Dark theme unless explicitly set to 'light'
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('fest_theme');
    return saved ? saved === 'dark' : true;
  });

  // Restore logged-in user immediately from localStorage so page reloads never lose login state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const cached = localStorage.getItem('fest_cached_user_profile');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.id && parsed.username) {
          return parsed as UserProfile;
        }
      }
    } catch {
      // Ignore malformed cache
    }
    return null;
  });
  const [allUsers, setAllUsers] = useState<UserProfile[]>(() => {
    try {
      const raw = localStorage.getItem('fest_cached_all_users');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore
    }
    return [];
  });
  const [friendIds, setFriendIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('fest_cached_friend_ids');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore
    }
    return [];
  });
  const [friendIdsByCreator, setFriendIdsByCreator] = useState<Record<string, string[]>>(() => {
    try {
      const raw = localStorage.getItem('fest_cached_friend_ids_by_creator');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // Ignore
    }
    return {};
  });
  const [events, setEvents] = useState<EventRecord[]>(() => {
    try {
      const raw = localStorage.getItem('fest_cached_events') || localStorage.getItem('fest_vault_events');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore
    }
    return [];
  });
  const [notifications, setNotifications] = useState<NotificationRecord[]>(() => {
    try {
      const raw = localStorage.getItem('fest_cached_notifications');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore
    }
    return [];
  });
  const [messages, setMessages] = useState<ChatMessageRecord[]>(() => {
    try {
      const raw = localStorage.getItem('fest_cached_messages');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore
    }
    return [];
  });

  // Navigation & Conditional Rendering States
  const [activePage, setActivePage] = useState<NavPage>('home');
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<EventFilterMode>('all');

  // Conditional sub-views rendered on the main screen
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [participatingEventId, setParticipatingEventId] = useState<string | null>(null);
  const [creatingEvent, setCreatingEvent] = useState<boolean>(false);
  const [showingNotifications, setShowingNotifications] = useState<boolean>(false);

  // Phone required banner prompt when attempting to create/participate without phone
  const [phoneRequiredPrompt, setPhoneRequiredPrompt] = useState<string | null>(null);

  // Popup Toast Notification (5s, swipeable)
  const [activeToast, setActiveToast] = useState<NotificationRecord | null>(null);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('fest_theme', next ? 'dark' : 'light');
      return next;
    });
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const getLocalVaultUsers = useCallback((): any[] => {
    try {
      const raw = localStorage.getItem('fest_accounts_vault');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, []);

  const getLocalPortalVault = useCallback(() => {
    const parseArray = (key: string): any[] => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };
    const parseObject = (key: string): Record<string, string[]> => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    };

    const vaultEvents = parseArray('fest_vault_events');
    const cachedEvents = parseArray('fest_cached_events');
    const eventMap = new Map<string, any>();
    for (const ev of [...vaultEvents, ...cachedEvents]) {
      if (ev && ev.id) eventMap.set(ev.id, ev);
    }

    return {
      vaultEvents: Array.from(eventMap.values()),
      vaultFriendIds: parseArray('fest_cached_friend_ids'),
      vaultFriendIdsByCreator: parseObject('fest_cached_friend_ids_by_creator'),
      vaultRemovedFriendIds: parseArray('fest_vault_removed_friends'),
      vaultCancelledEventIds: parseArray('fest_vault_cancelled_events'),
      vaultMessages: parseArray('fest_cached_messages'),
    };
  }, []);

  const saveUserToLocalVault = useCallback(
    (entry: any, passwordPlain?: string) => {
      if (!entry || !entry.username) return;
      try {
        const list = getLocalVaultUsers();
        const lowerUser = String(entry.username).toLowerCase();
        const existingIdx = list.findIndex(
          (item) =>
            (entry.id && item.id === entry.id) ||
            String(item.username || '').toLowerCase() === lowerUser
        );
        const prev = existingIdx >= 0 ? list[existingIdx] : {};
        const merged = {
          ...prev,
          ...entry,
          passwordHash: entry.passwordHash || prev.passwordHash || '',
          passwordPlain: passwordPlain !== undefined ? passwordPlain : prev.passwordPlain || '',
        };
        if (existingIdx >= 0) {
          list[existingIdx] = merged;
        } else {
          list.push(merged);
        }
        localStorage.setItem('fest_accounts_vault', JSON.stringify(list));
      } catch {
        // Ignore storage quota errors
      }
    },
    [getLocalVaultUsers]
  );

  const safeSaveEventsToLocalStorage = useCallback((nextEvents: EventRecord[]) => {
    try {
      const json = JSON.stringify(nextEvents);
      localStorage.setItem('fest_cached_events', json);
      localStorage.setItem('fest_vault_events', json);
    } catch {
      try {
        // Fallback if a base64 poster image exceeds localStorage quota: keep all event & registration data
        const lightweight = nextEvents.map((ev) => ({
          ...ev,
          posterUrl: ev.posterUrl && ev.posterUrl.length > 120000 ? '' : ev.posterUrl || '',
        }));
        const json = JSON.stringify(lightweight);
        localStorage.setItem('fest_cached_events', json);
        localStorage.setItem('fest_vault_events', json);
      } catch {
        // Ignore quota error
      }
    }
  }, []);

  const applyServerState = useCallback(
    (data: any, triggerToastForLatest?: NotificationRecord, passwordPlain?: string) => {
      if (data.currentUser) {
        setCurrentUser(data.currentUser);
        localStorage.setItem('fest_active_user_id', data.currentUser.id);
        localStorage.setItem('fest_active_username', data.currentUser.username || '');
        localStorage.setItem('fest_cached_user_profile', JSON.stringify(data.currentUser));
        sessionStorage.setItem('fest_active_user_id', data.currentUser.id);
        saveUserToLocalVault(data.vaultEntry || data.currentUser, passwordPlain);
      }
      if (Array.isArray(data.users)) {
        setAllUsers(data.users);
        try {
          localStorage.setItem('fest_cached_all_users', JSON.stringify(data.users));
        } catch {
          // Ignore
        }
      }
      if (Array.isArray(data.friendIds)) {
        setFriendIds(data.friendIds);
        try {
          localStorage.setItem('fest_cached_friend_ids', JSON.stringify(data.friendIds));
        } catch {
          // Ignore
        }
      }
      if (data.friendIdsByCreator) {
        setFriendIdsByCreator(data.friendIdsByCreator);
        try {
          localStorage.setItem(
            'fest_cached_friend_ids_by_creator',
            JSON.stringify(data.friendIdsByCreator)
          );
        } catch {
          // Ignore
        }
      }
      if (Array.isArray(data.events)) {
        setEvents(data.events);
        safeSaveEventsToLocalStorage(data.events);
      }
      if (Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
        try {
          localStorage.setItem('fest_cached_notifications', JSON.stringify(data.notifications));
        } catch {
          // Ignore
        }
      }
      if (Array.isArray(data.messages)) {
        setMessages(data.messages);
        try {
          localStorage.setItem('fest_cached_messages', JSON.stringify(data.messages));
        } catch {
          // Ignore
        }
      }

      const silent = Boolean(data.currentUser?.silentNotifications);
      const toastCandidate = triggerToastForLatest || data.latestNotification;
      if (toastCandidate && !silent) {
        setActiveToast(toastCandidate);
      }
    },
    [safeSaveEventsToLocalStorage, saveUserToLocalVault]
  );

  // Initial load: sync local vault & check saved session in localStorage / sessionStorage
  useEffect(() => {
    const savedUserId =
      localStorage.getItem('fest_active_user_id') ||
      sessionStorage.getItem('fest_active_user_id') ||
      '';
    const savedUsername = localStorage.getItem('fest_active_username') || '';
    const vaultUsers = getLocalVaultUsers();
    const portalVault = getLocalPortalVault();

    // Also include cached user profile in vaultUsers if present
    try {
      const cachedRaw = localStorage.getItem('fest_cached_user_profile');
      if (cachedRaw) {
        const cachedUser = JSON.parse(cachedRaw);
        if (
          cachedUser &&
          cachedUser.username &&
          !vaultUsers.some(
            (v) => String(v.username || '').toLowerCase() === String(cachedUser.username).toLowerCase()
          )
        ) {
          vaultUsers.push(cachedUser);
        }
      }
    } catch {
      // Ignore
    }

    fetch('/api/auth/sync-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: savedUserId,
        username: savedUsername,
        vaultUsers,
        ...portalVault,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.currentUser) {
          applyServerState(data);
        } else if (Array.isArray(data.users)) {
          setAllUsers(data.users);
        }
      })
      .catch((err) => console.error('Initial load error:', err));
  }, [applyServerState, getLocalPortalVault, getLocalVaultUsers]);

  const handleReceiveLiveNotification = useCallback(
    (incomingNotif: NotificationRecord) => {
      if (!incomingNotif || !incomingNotif.id) return;
      setNotifications((prev) => {
        if (prev.some((n) => n.id === incomingNotif.id)) return prev;
        const next = [incomingNotif, ...prev];
        try {
          localStorage.setItem('fest_cached_notifications', JSON.stringify(next));
        } catch {
          // Ignore
        }
        return next;
      });
      if (!currentUser?.silentNotifications) {
        setActiveToast(incomingNotif);
      }
    },
    [currentUser?.silentNotifications]
  );

  // Global background WebSocket listener so friend message notifications arrive on any screen
  useEffect(() => {
    if (!currentUser?.id) return;
    let isUnmounted = false;
    let reconnectTimer: number | null = null;
    let ws: WebSocket | null = null;

    const connect = () => {
      if (isUnmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/ws/chat`);

      ws.onopen = () => {
        if (isUnmounted || !ws) return;
        ws.send(JSON.stringify({ type: 'auth', userId: currentUser.id }));
      };

      ws.onmessage = (event) => {
        if (isUnmounted) return;
        try {
          const data = JSON.parse(String(event.data));
          if (!data || typeof data !== 'object') return;
          if (data.type === 'message:new' && data.message) {
            const incomingMsg: ChatMessageRecord = data.message;
            setMessages((prev) => {
              if (prev.some((m) => m.id === incomingMsg.id)) return prev;
              const next = [...prev, incomingMsg].sort(
                (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
              );
              try {
                localStorage.setItem('fest_cached_messages', JSON.stringify(next));
              } catch {
                // Ignore
              }
              return next;
            });
            if (data.notification && data.notification.userId === currentUser.id) {
              handleReceiveLiveNotification(data.notification as NotificationRecord);
            }
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = () => {
        if (isUnmounted) return;
        reconnectTimer = window.setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [currentUser?.id, handleReceiveLiveNotification]);

  const handleSignIn = async (payload: {
    username: string;
    password: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const vaultUsers = getLocalVaultUsers();
      const portalVault = getLocalPortalVault();
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          vaultUsers,
          ...portalVault,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || 'Failed to sign in.' };
      }

      applyServerState(data, undefined, payload.password);
      setActivePage('home');
      setSelectedEventId(null);
      setParticipatingEventId(null);
      setCreatingEvent(false);
      setShowingNotifications(false);

      if (!data.currentUser.silentNotifications && data.notifications?.length > 0) {
        setActiveToast(data.notifications[0]);
      }

      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error while connecting to server.' };
    }
  };

  const handleRegister = async (payload: {
    name: string;
    year: number;
    branch: BranchType;
    rollNumber: string;
    username: string;
    password: string;
    confirmPassword: string;
  }): Promise<{ ok: boolean; error?: string; code?: string }> => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          ok: false,
          error: data.error || 'Failed to register student account.',
          code: data.code,
        };
      }

      applyServerState(data, undefined, payload.password);
      setActivePage('home');
      setSelectedEventId(null);
      setParticipatingEventId(null);
      setCreatingEvent(false);
      setShowingNotifications(false);

      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error while connecting to server.' };
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('fest_active_user_id');
    localStorage.removeItem('fest_active_username');
    localStorage.removeItem('fest_cached_user_profile');
    sessionStorage.removeItem('fest_active_user_id');
    setCurrentUser(null);
    setSelectedEventId(null);
    setParticipatingEventId(null);
    setCreatingEvent(false);
    setShowingNotifications(false);
    setDrawerOpen(false);
  };

  const handleDeleteAccount = async (): Promise<{ ok: boolean; error?: string }> => {
    if (!currentUser) return { ok: false, error: 'Not signed in.' };
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(currentUser.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: data.error || 'Failed to delete student account.' };
      }

      const deletedId = currentUser.id;
      const deletedUsername = String(currentUser.username || '').toLowerCase();

      // Remove deleted user from local vaults and cached state so it is never restored on reload
      try {
        const vaultUsers = getLocalVaultUsers().filter(
          (u) =>
            u &&
            u.id !== deletedId &&
            String(u.username || '').toLowerCase() !== deletedUsername
        );
        localStorage.setItem('fest_accounts_vault', JSON.stringify(vaultUsers));

        const nextAllUsers = allUsers.filter(
          (u) =>
            u.id !== deletedId &&
            String(u.username || '').toLowerCase() !== deletedUsername
        );
        setAllUsers(nextAllUsers);
        localStorage.setItem('fest_cached_all_users', JSON.stringify(nextAllUsers));

        const nextEvents = events
          .filter((ev) => ev.creatorId !== deletedId)
          .map((ev) => ({
            ...ev,
            registrations: Array.isArray(ev.registrations)
              ? ev.registrations.filter((r) => r.userId !== deletedId)
              : [],
          }));
        setEvents(nextEvents);
        safeSaveEventsToLocalStorage(nextEvents);

        localStorage.removeItem('fest_cached_friend_ids');
        localStorage.removeItem('fest_cached_notifications');
        localStorage.removeItem('fest_cached_messages');
      } catch {
        // Ignore storage errors
      }

      handleSignOut();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error while deleting account.' };
    }
  };

  const handleNavigate = (page: NavPage) => {
    setActivePage(page);
    setSelectedEventId(null);
    setParticipatingEventId(null);
    setCreatingEvent(false);
    setShowingNotifications(false);
    setPhoneRequiredPrompt(null);
    setDrawerOpen(false);
  };

  const handleToggleFavourite = async (eventId: string) => {
    if (!currentUser) return;
    const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/favourite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id }),
    });
    if (res.ok) {
      const data = await res.json();
      applyServerState(data);
    }
  };

  // Delete / Ignore event card from Home screen -> moves to Ignored events
  const handleIgnoreEventFromHome = async (eventId: string) => {
    if (!currentUser) return;
    const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/ignore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id }),
    });
    if (res.ok) {
      const data = await res.json();
      applyServerState(data);
    }
  };

  // Permanently delete event from Ignored events page
  const handleDeleteFromIgnoredEvents = async (eventId: string) => {
    if (!currentUser) return;
    const res = await fetch(
      `/api/events/${encodeURIComponent(eventId)}/ignore?userId=${encodeURIComponent(currentUser.id)}`,
      { method: 'DELETE' }
    );
    if (res.ok) {
      const data = await res.json();
      applyServerState(data);
    }
  };

  // Restore event from Ignored events page back to Home page
  const handleRestoreFromIgnoredEvents = async (eventId: string) => {
    if (!currentUser) return;
    const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id }),
    });
    if (res.ok) {
      const data = await res.json();
      applyServerState(data);
    }
  };

  const handleStartCreateEvent = () => {
    if (!currentUser) return;
    const contactCheck = checkUserContactRequirements(currentUser, 'create or host an event');
    if (!contactCheck.valid) {
      setPhoneRequiredPrompt(
        contactCheck.error ||
          'To create or host an event, you must first add your phone number and email address in your Profile.'
      );
      return;
    }
    setPhoneRequiredPrompt(null);
    setSelectedEventId(null);
    setParticipatingEventId(null);
    setShowingNotifications(false);
    setCreatingEvent(true);
  };

  const handleOpenParticipateForm = (event: EventRecord) => {
    if (!currentUser) return;
    const contactCheck = checkUserContactRequirements(currentUser, 'participate in an event');
    if (!contactCheck.valid) {
      setPhoneRequiredPrompt(
        contactCheck.error ||
          'To participate in an event, you must first add your phone number and email address in your Profile.'
      );
      return;
    }
    setPhoneRequiredPrompt(null);
    setParticipatingEventId(event.id);
  };

  const handleCreateEventSubmit = async (payload: {
    title: string;
    tag: string;
    venue: string;
    description: string;
    posterUrl?: string;
    registrationStart: string;
    registrationEnd: string;
    eventStart: string;
    eventEnd: string;
    friendsOnly: boolean;
    allowedUserIds: string[];
    formFields: {
      fieldName: string;
      fieldType: FormFieldCategory;
      options: string[];
      isRequired: boolean;
    }[];
  }): Promise<{ ok: boolean; error?: string }> => {
    if (!currentUser) return { ok: false, error: 'Not logged in.' };
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creatorId: currentUser.id,
        ...payload,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'Could not create event.' };
    }
    applyServerState(data);
    setCreatingEvent(false);
    setActivePage('home');
    return { ok: true };
  };

  const handleSubmitRegistration = async (
    eventId: string,
    email: string,
    answers: Record<string, string>
  ): Promise<{ ok: boolean; error?: string; latestEmail?: RegistrationEmailRecord }> => {
    if (!currentUser) return { ok: false, error: 'Not logged in.' };
    const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        email,
        answers,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'Registration failed.' };
    }
    applyServerState(data);
    return { ok: true, latestEmail: data.latestEmail };
  };

  const handleRemoveParticipant = async (eventId: string, targetUserId: string) => {
    if (!currentUser) return;
    const res = await fetch(
      `/api/events/${encodeURIComponent(eventId)}/registrations/${encodeURIComponent(
        targetUserId
      )}?creatorId=${encodeURIComponent(currentUser.id)}`,
      { method: 'DELETE' }
    );
    if (res.ok) {
      const data = await res.json();
      applyServerState(data);
    }
  };

  const handleCancelEvent = async (eventId: string) => {
    if (!currentUser) return;
    const res = await fetch(
      `/api/events/${encodeURIComponent(eventId)}?userId=${encodeURIComponent(currentUser.id)}`,
      { method: 'DELETE' }
    );
    if (res.ok) {
      try {
        const raw = localStorage.getItem('fest_vault_cancelled_events');
        const list = raw ? JSON.parse(raw) : [];
        const nextCancelled = Array.isArray(list) ? Array.from(new Set([...list, eventId])) : [eventId];
        localStorage.setItem('fest_vault_cancelled_events', JSON.stringify(nextCancelled));
      } catch {
        // Ignore
      }
      const data = await res.json();
      applyServerState(data);
      setSelectedEventId(null);
    }
  };

  const handleUpdateProfile = async (patch: {
    name: string;
    username: string;
    rollNumber: string;
    year: number;
    branch: BranchType;
    phone: string;
    email: string;
    avatarUrl: string;
    newPassword?: string;
    confirmNewPassword?: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    if (!currentUser) return { ok: false, error: 'Not logged in.' };
    const res = await fetch(`/api/users/${encodeURIComponent(currentUser.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'Failed to update profile.' };
    }
    applyServerState(data, undefined, patch.newPassword ? patch.newPassword : undefined);
    setPhoneRequiredPrompt(null);
    return { ok: true };
  };

  const handleToggleSilentNotifications = async (nextVal: boolean) => {
    if (!currentUser) return;
    const res = await fetch(`/api/users/${encodeURIComponent(currentUser.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ silentNotifications: nextVal }),
    });
    if (res.ok) {
      const data = await res.json();
      applyServerState(data);
    }
  };

  const handleAddFriend = async (friendId: string) => {
    if (!currentUser) return;
    const res = await fetch('/api/friends/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, friendId }),
    });
    if (res.ok) {
      try {
        const raw = localStorage.getItem('fest_vault_removed_friends');
        const list = raw ? JSON.parse(raw) : [];
        if (Array.isArray(list)) {
          localStorage.setItem(
            'fest_vault_removed_friends',
            JSON.stringify(list.filter((id: string) => id !== friendId))
          );
        }
      } catch {
        // Ignore
      }
      const data = await res.json();
      applyServerState(data);
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!currentUser) return;
    const res = await fetch('/api/friends/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, friendId }),
    });
    if (res.ok) {
      try {
        const raw = localStorage.getItem('fest_vault_removed_friends');
        const list = raw ? JSON.parse(raw) : [];
        const nextRemoved = Array.isArray(list) ? Array.from(new Set([...list, friendId])) : [friendId];
        localStorage.setItem('fest_vault_removed_friends', JSON.stringify(nextRemoved));
      } catch {
        // Ignore
      }
      const data = await res.json();
      applyServerState(data);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    if (!currentUser) return;
    const res = await fetch(
      `/api/notifications/${encodeURIComponent(notificationId)}?userId=${encodeURIComponent(
        currentUser.id
      )}`,
      { method: 'DELETE' }
    );
    if (res.ok) {
      const data = await res.json();
      applyServerState(data);
    }
  };

  const handleClearAllNotifications = async () => {
    if (!currentUser) return;
    const res = await fetch(`/api/notifications?userId=${encodeURIComponent(currentUser.id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      const data = await res.json();
      applyServerState(data);
    }
  };

  // Sign-In / Registration Page when no student is authenticated
  if (!currentUser) {
    return (
      <EntryScreen
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        onSignIn={handleSignIn}
        onRegister={handleRegister}
      />
    );
  }

  // Computed Event Lists
  const homeFilteredEvents = filterAndSortEvents(events, {
    search: searchQuery,
    filterMode,
    currentUserId: currentUser.id,
    friendIdsByCreator,
  });

  const myCreatedEvents = events.filter((e) => e.creatorId === currentUser.id);
  // Includes both external events registered for AND events created by currentUser (auto-participated)
  const myParticipatedEvents = getParticipatedEvents(events, currentUser.id);
  const myFavouriteEvents = events.filter((e) => e.isFavourite);
  const myScheduledEvents = events
    .filter(
      (e) =>
        (e.creatorId === currentUser.id || e.registrations.some((r) => r.userId === currentUser.id)) &&
        computeEventRuntimeStatus(e).status === 'running'
    )
    .sort((a, b) => Date.parse(a.eventStart) - Date.parse(b.eventStart));

  // Ignored Events: Only active ignored events that are not expired and have been in Ignored events <= 7 days
  const myIgnoredEvents = events.filter(
    (e) =>
      Boolean(e.isIgnored) &&
      Boolean(e.ignoredAt) &&
      !shouldAutoDeleteIgnoredEvent(e, e.ignoredAt!, Date.now()).shouldDelete
  );

  const selectedEvent = selectedEventId ? events.find((e) => e.id === selectedEventId) || null : null;
  const participatingEvent = participatingEventId
    ? events.find((e) => e.id === participatingEventId) || null
    : null;

  // The bottom-right + icon to create an event is ONLY visible when on the normal Home screen
  // (goes away during conditional rendering of Checkout, Create Event, or Notifications!)
  const showHomeCreatePlusButton =
    activePage === 'home' &&
    !selectedEvent &&
    !participatingEvent &&
    !creatingEvent &&
    !showingNotifications;

  // Compute current view key so React remounts the view wrapper with smooth left-scrolling CSS animation
  const currentViewKey = showingNotifications
    ? 'view-notifications'
    : creatingEvent
    ? 'view-create-event'
    : participatingEvent
    ? `view-participate-${participatingEvent.id}`
    : selectedEvent
    ? `view-details-${selectedEvent.id}`
    : `page-${activePage}-${filterMode}`;

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        darkMode
          ? 'bg-[#050507] text-white mdnt-hero-glow mdnt-grid-bg'
          : 'bg-[#f8f8fa] text-black'
      }`}
    >
      {/* 5-Second Swipeable Toast Popup on Any Screen */}
      <ToastPopup
        notification={activeToast}
        onDismiss={() => setActiveToast(null)}
        darkMode={darkMode}
      />

      {/* Top Navigation Bar styled after mdntevents.com */}
      <header
        className={`sticky top-0 z-30 flex items-center justify-between gap-3 px-4 lg:px-6 py-3.5 border-b transition-colors duration-300 backdrop-blur-md ${
          darkMode
            ? 'border-white/12 bg-[#050507]/85'
            : 'border-black/10 bg-white/92'
        }`}
      >
        {/* Left Zone: 3-Lines Hamburger Menu Button + Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setDrawerOpen((prev) => !prev)}
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            className={`p-2 rounded-md border transition-all duration-300 active:scale-95 cursor-pointer ${
              darkMode
                ? 'border-white/20 bg-[#121217] hover:border-[#BFFF00] text-white'
                : 'border-black/20 bg-white hover:bg-black hover:text-white text-black'
            }`}
          >
            {drawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={() => handleNavigate('home')}
            className="font-display text-sm sm:text-base tracking-tight uppercase whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
          >
            <span className={`w-2 h-2 rounded-full ${darkMode ? 'bg-[#BFFF00]' : 'bg-[#7A00FF]'}`} />
            <span>FEST-REGISTER</span>
          </button>
        </div>

        {/* Center Zone: Frosted Glass Navigation Bar matching mdntevents.com */}
        <nav
          className={`hidden xl:flex items-center gap-1 px-2 py-1.5 rounded-md border backdrop-blur-md text-[11px] font-bold uppercase tracking-wider ${
            darkMode
              ? 'bg-white/[0.06] border-white/15'
              : 'bg-black/[0.04] border-black/12'
          }`}
        >
          {MENU_ITEMS.map((item) => {
            const active =
              activePage === item.id &&
              !showingNotifications &&
              !creatingEvent &&
              !selectedEvent &&
              !participatingEvent;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`px-2.5 py-1.5 rounded-sm transition-all duration-300 whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? darkMode
                      ? 'bg-[#BFFF00] text-black'
                      : 'bg-black text-white'
                    : darkMode
                    ? 'text-zinc-300 hover:text-[#BFFF00]'
                    : 'text-zinc-600 hover:text-black'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right Zone: Light/Dark Switch + Notification Icon + Student Profile */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleDarkMode}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className={`p-2 rounded-md border transition-all duration-300 active:scale-95 cursor-pointer ${
              darkMode
                ? 'border-white/20 bg-[#121217] hover:border-[#BFFF00] text-[#BFFF00]'
                : 'border-black/20 bg-white hover:bg-black hover:text-white text-[#7A00FF]'
            }`}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setShowingNotifications((prev) => !prev);
              setSelectedEventId(null);
              setParticipatingEventId(null);
              setCreatingEvent(false);
            }}
            aria-label={`Notifications (${notifications.length})`}
            className={`relative inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-xs font-bold uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer ${
              showingNotifications
                ? darkMode
                  ? 'border-[#BFFF00] bg-[#BFFF00] text-black'
                  : 'border-black bg-black text-white'
                : darkMode
                ? 'border-white/20 bg-[#121217] hover:border-[#BFFF00] text-white'
                : 'border-black/20 bg-white hover:bg-black hover:text-white text-black'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span className="font-mono tabular-nums">{notifications.length}</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate('profile')}
            className={`hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-semibold transition-all duration-300 active:scale-95 cursor-pointer ${
              darkMode
                ? 'border-white/25 bg-white text-black hover:bg-[#BFFF00] hover:border-[#BFFF00]'
                : 'border-black bg-black text-white hover:bg-[#7A00FF] hover:border-[#7A00FF]'
            }`}
          >
            {currentUser.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                className="w-5 h-5 rounded-full object-cover border border-black/30 shrink-0"
              />
            ) : (
              <span
                className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                  darkMode ? 'bg-black text-[#BFFF00]' : 'bg-[#BFFF00] text-black'
                }`}
              >
                {currentUser.name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <span className="font-bold truncate max-w-[115px]">{currentUser.name}</span>
            <span className="opacity-75 font-mono tabular-nums">
              Y{currentUser.year}
            </span>
          </button>
        </div>
      </header>

      {/* Top-Left 3-Lines Navigation Drawer with Smooth Slide-In from Left */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs animate-fade-backdrop"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            aria-label="Sidebar navigation"
            className={`animate-drawer-left relative z-50 w-72 max-w-[85vw] h-full border-r p-6 flex flex-col justify-between overflow-y-auto ${
              darkMode
                ? 'bg-[#0B0B0F] border-white/15 text-white'
                : 'bg-white border-black/15 text-black'
            }`}
          >
            <div className="space-y-6">
              <div
                className={`flex items-center justify-between gap-3 pb-4 border-b ${
                  darkMode ? 'border-white/15' : 'border-black/10'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={`${currentUser.name} profile`}
                      data-testid="sidebar-profile-avatar"
                      className="w-11 h-11 rounded-full object-cover border-2 border-[#BFFF00] shrink-0"
                    />
                  ) : (
                    <div
                      data-testid="sidebar-profile-avatar"
                      className={`w-11 h-11 rounded-full font-bold text-sm flex items-center justify-center shrink-0 border-2 ${
                        darkMode
                          ? 'bg-[#BFFF00] text-black border-white/20'
                          : 'bg-black text-[#BFFF00] border-black/20'
                      }`}
                    >
                      {currentUser.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-base font-bold truncate">{currentUser.name}</div>
                    <div
                      className={`text-xs font-mono tabular-nums truncate ${
                        darkMode ? 'text-zinc-400' : 'text-zinc-500'
                      }`}
                    >
                      {currentUser.rollNumber} · Year {currentUser.year} · {currentUser.branch}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close navigation menu"
                  className="p-1.5 rounded-md text-zinc-400 hover:text-white cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Left Bar Navigation Sequence including Ignored events */}
              <nav className="space-y-1.5">
                {MENU_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = activePage === item.id && !showingNotifications;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavigate(item.id)}
                      className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-300 active:scale-[0.98] cursor-pointer ${
                        active
                          ? darkMode
                            ? 'bg-[#BFFF00] text-black shadow-sm'
                            : 'bg-black text-white shadow-sm'
                          : darkMode
                          ? 'text-zinc-300 hover:bg-white/10 hover:text-white'
                          : 'text-zinc-700 hover:bg-zinc-100 hover:text-black'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </span>
                      {item.id === 'ignored' && myIgnoredEvents.length > 0 && (
                        <span
                          className={`text-xs font-mono tabular-nums px-2 py-0.5 rounded-sm ${
                            active
                              ? darkMode
                                ? 'bg-black text-[#BFFF00]'
                                : 'bg-[#BFFF00] text-black'
                              : darkMode
                              ? 'bg-white/10 text-[#BFFF00]'
                              : 'bg-zinc-200 text-black'
                          }`}
                        >
                          {myIgnoredEvents.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className={`pt-4 border-t ${darkMode ? 'border-white/15' : 'border-black/10'}`}>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-xs font-bold uppercase tracking-wider text-red-500 hover:bg-red-950/40 transition-all duration-300 cursor-pointer"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Sign out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Container */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 py-8 overflow-x-hidden">
        {/* Phone Number Required Prompt Banner */}
        {phoneRequiredPrompt && (
          <div
            role="alert"
            className="animate-slide-left mb-6 p-4 rounded-md border border-amber-400 bg-amber-950/80 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3 text-sm">
              <Phone className="w-5 h-5 text-[#BFFF00] shrink-0" />
              <span>{phoneRequiredPrompt}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleNavigate('profile')}
                className="px-4 py-2 rounded-md bg-[#BFFF00] hover:bg-[#d2ff4d] text-black text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Go to Profile to Add Details
              </button>
              <button
                type="button"
                onClick={() => setPhoneRequiredPrompt(null)}
                aria-label="Dismiss phone prompt"
                className="p-1.5 rounded-md text-amber-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Smooth Left-to-Right Animated Page & View Switcher */}
        <div key={currentViewKey} className="animate-slide-left">
          {/* Conditional Rendering 1: Notifications View */}
          {showingNotifications ? (
            <NotificationsView
              notifications={notifications}
              silentNotifications={currentUser.silentNotifications}
              darkMode={darkMode}
              onBack={() => setShowingNotifications(false)}
              onToggleSilent={handleToggleSilentNotifications}
              onDeleteNotification={handleDeleteNotification}
              onClearAll={handleClearAllNotifications}
            />
          ) : creatingEvent ? (
            /* Conditional Rendering 2: Multi-Step Create Event Wizard */
            <CreateEventWizard
              currentUser={currentUser}
              allUsers={allUsers}
              darkMode={darkMode}
              onCancel={() => setCreatingEvent(false)}
              onCreateEvent={handleCreateEventSubmit}
            />
          ) : participatingEvent ? (
            /* Conditional Rendering 3: Google Form Registration View */
            <GoogleFormView
              event={participatingEvent}
              currentUser={currentUser}
              darkMode={darkMode}
              onBack={() => setParticipatingEventId(null)}
              onSubmitRegistration={handleSubmitRegistration}
            />
          ) : selectedEvent ? (
            /* Conditional Rendering 4: Event Checkout / Detail View */
            <EventDetailsView
              event={selectedEvent}
              currentUser={currentUser}
              friendIds={friendIds}
              darkMode={darkMode}
              onBack={() => setSelectedEventId(null)}
              onToggleFavourite={handleToggleFavourite}
              onOpenParticipateForm={handleOpenParticipateForm}
              onRemoveParticipant={handleRemoveParticipant}
              onCancelEvent={handleCancelEvent}
            />
          ) : activePage === 'profile' ? (
            <ProfileView
              currentUser={currentUser}
              createdCount={myCreatedEvents.length}
              participationsCount={myParticipatedEvents.length}
              favouritesCount={myFavouriteEvents.length}
              friendsCount={friendIds.length}
              darkMode={darkMode}
              onUpdateProfile={handleUpdateProfile}
              onSignOut={handleSignOut}
              onDeleteAccount={handleDeleteAccount}
            />
          ) : activePage === 'friends' ? (
            <FriendsView
              currentUser={currentUser}
              allUsers={allUsers}
              friendIds={friendIds}
              initialMessages={messages}
              darkMode={darkMode}
              onAddFriend={handleAddFriend}
              onRemoveFriend={handleRemoveFriend}
              onIncomingNotification={handleReceiveLiveNotification}
            />
          ) : activePage === 'my-events' ? (
            <section className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-tight">
                    My Events
                  </h1>
                  <p className={`text-sm mt-1 ${darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    Events created under your unique profile ({currentUser.name}). Click Checkout on any card to
                    inspect registered students and their submitted form responses, or remove participants.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleStartCreateEvent}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-xs font-bold uppercase tracking-wider cursor-pointer self-start active:scale-95 ${
                    darkMode
                      ? 'bg-[#BFFF00] hover:bg-[#d2ff4d] text-black'
                      : 'bg-black hover:bg-[#7A00FF] text-white'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New Event</span>
                </button>
              </div>

              {myCreatedEvents.length === 0 ? (
                <div
                  className={`p-10 rounded-md border text-center space-y-3 ${
                    darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/15 bg-white'
                  }`}
                >
                  <p className={`text-sm font-medium ${darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    You haven&apos;t created any events yet.
                  </p>
                  <button
                    type="button"
                    onClick={handleStartCreateEvent}
                    className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider cursor-pointer ${
                      darkMode ? 'bg-[#BFFF00] text-black' : 'bg-black text-white'
                    }`}
                  >
                    Create Your First Technical Event
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {myCreatedEvents.map((ev) => (
                    <EventCard
                      key={ev.id}
                      event={ev}
                      currentUserId={currentUser.id}
                      darkMode={darkMode}
                      onCheckout={(id) => setSelectedEventId(id)}
                      onToggleFavourite={handleToggleFavourite}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : activePage === 'participations' ? (
            <section className="space-y-8">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-tight">
                  My Participations
                </h1>
                <p className={`text-sm mt-1 ${darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  All events you are participating in — including events you registered for and events you
                  created (where you are automatically added as a participating member).
                </p>
              </div>

              {myParticipatedEvents.length === 0 ? (
                <div
                  className={`p-10 rounded-md border text-center space-y-3 ${
                    darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/15 bg-white'
                  }`}
                >
                  <p className={`text-sm font-medium ${darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    You haven&apos;t participated in any events yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleNavigate('home')}
                    className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider cursor-pointer ${
                      darkMode ? 'bg-[#BFFF00] text-black' : 'bg-black text-white'
                    }`}
                  >
                    Browse Campus Events
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {myParticipatedEvents.map((ev) => (
                    <EventCard
                      key={ev.id}
                      event={ev}
                      currentUserId={currentUser.id}
                      darkMode={darkMode}
                      onCheckout={(id) => setSelectedEventId(id)}
                      onToggleFavourite={handleToggleFavourite}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : activePage === 'favourites' ? (
            <section className="space-y-6">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-tight">
                  Favourite Events
                </h1>
                <p className={`text-sm mt-1 ${darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  Events you starred with the favourite icon for quick access.
                </p>
              </div>

              {myFavouriteEvents.length === 0 ? (
                <div
                  className={`p-10 rounded-md border text-center space-y-3 ${
                    darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/15 bg-white'
                  }`}
                >
                  <p className={`text-sm font-medium ${darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    No favourite events starred yet. Click the star icon on any event card to add it here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {myFavouriteEvents.map((ev) => (
                    <EventCard
                      key={ev.id}
                      event={ev}
                      currentUserId={currentUser.id}
                      darkMode={darkMode}
                      onCheckout={(id) => setSelectedEventId(id)}
                      onToggleFavourite={handleToggleFavourite}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : activePage === 'scheduled' ? (
            <section className="space-y-6">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-tight">
                  Scheduled Events
                </h1>
                <p className={`text-sm mt-1 ${darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  Upcoming and running events on your personal campus schedule (1 hr to go, 1 day to go, 2 days
                  to go).
                </p>
              </div>

              {myScheduledEvents.length === 0 ? (
                <div
                  className={`p-10 rounded-md border text-center space-y-3 ${
                    darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/15 bg-white'
                  }`}
                >
                  <Calendar className="w-8 h-8 text-zinc-400 mx-auto" />
                  <p className={`text-sm font-medium ${darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    No active scheduled events right now.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {myScheduledEvents.map((ev) => (
                    <EventCard
                      key={ev.id}
                      event={ev}
                      currentUserId={currentUser.id}
                      darkMode={darkMode}
                      onCheckout={(id) => setSelectedEventId(id)}
                      onToggleFavourite={handleToggleFavourite}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : activePage === 'ignored' ? (
            <section className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-tight">
                    Ignored Events
                  </h1>
                  <p className={`text-sm mt-1 ${darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    Events you removed from the Home screen. Click Restore to return an event card back to the
                    Home page, or click Delete to permanently delete it from Ignored events. Favouriting is
                    disabled for ignored events.
                  </p>
                </div>
              </div>

              {/* Mandatory Auto-Deletion Policy Notice */}
              <div
                data-testid="ignored-events-policy-banner"
                className={`p-4 rounded-md border flex items-start gap-3 ${
                  darkMode
                    ? 'border-[#BFFF00]/40 bg-[#0C0C10] text-zinc-200'
                    : 'border-black/20 bg-white text-zinc-800'
                }`}
              >
                <Info className={`w-5 h-5 shrink-0 mt-0.5 ${darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}`} />
                <div className="text-xs sm:text-sm leading-relaxed">
                  <strong>Auto-Deletion Policy:</strong> If an event has <strong>expired</strong>, it is
                  automatically deleted from Ignored events. Additionally, any event that remains in Ignored
                  events for <strong>more than 7 days</strong> is automatically deleted.
                </div>
              </div>

              {myIgnoredEvents.length === 0 ? (
                <div
                  className={`p-10 rounded-md border text-center space-y-3 ${
                    darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/15 bg-white'
                  }`}
                >
                  <EyeOff className="w-8 h-8 text-zinc-400 mx-auto" />
                  <p className={`text-sm font-medium ${darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    No ignored events right now. Events removed from the Home screen appear here until restored,
                    deleted, expired, or older than 7 days.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {myIgnoredEvents.map((ev) => {
                    const ignoredMs = ev.ignoredAt ? Date.parse(ev.ignoredAt) : Date.now();
                    const daysRemaining = Math.max(
                      1,
                      Math.ceil((SEVEN_DAYS_MS - (Date.now() - ignoredMs)) / (24 * 3600 * 1000))
                    );
                    return (
                      <EventCard
                        key={ev.id}
                        event={ev}
                        currentUserId={currentUser.id}
                        darkMode={darkMode}
                        onCheckout={(id) => setSelectedEventId(id)}
                        hideFavourite={true}
                        onRestoreCard={handleRestoreFromIgnoredEvents}
                        onDeleteCard={handleDeleteFromIgnoredEvents}
                        deleteButtonLabel="Delete"
                        deleteButtonAriaLabel={`Delete ${ev.title} from Ignored events`}
                        ignoredInfoText={`Ignored ${formatReadableDate(
                          ev.ignoredAt || ''
                        )} (${daysRemaining}d left)`}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          ) : (
            /* Default Home Screen: mdntevents-style Hero Header, Search Bar, Filter Tabs & Scrollable Event Cards */
            <section className="space-y-8 pb-20">
              <div
                className={`p-6 sm:p-8 rounded-md border relative overflow-hidden ${
                  darkMode
                    ? 'border-white/15 bg-[#0C0C10]/90'
                    : 'border-black/15 bg-white'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div className="space-y-3 max-w-3xl">
                    <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          darkMode ? 'bg-[#BFFF00]' : 'bg-[#7A00FF]'
                        }`}
                      />
                      <span className={darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF] font-bold'}>
                        Welcome back, {currentUser.name} ({currentUser.rollNumber} · Year {currentUser.year} ·{' '}
                        {currentUser.branch})
                      </span>
                    </div>
                    <h1 className="font-display text-2xl sm:text-4xl uppercase tracking-tight leading-[1.38]">
                      <span>CAMPUS TECHNICAL </span>
                      <span className={darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}>
                        EVENTS DIRECTORY
                      </span>
                    </h1>
                  </div>

                  <div
                    className={`text-xs font-mono tabular-nums px-3.5 py-2 rounded-md border shrink-0 ${
                      darkMode
                        ? 'border-white/15 bg-[#050507] text-zinc-300'
                        : 'border-black/15 bg-zinc-50 text-zinc-700'
                    }`}
                  >
                    Showing {homeFilteredEvents.length} active home events
                  </div>
                </div>
              </div>

              {/* Search & Filter Toolbar */}
              <div
                className={`p-4 rounded-md border flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 ${
                  darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/15 bg-white'
                }`}
              >
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search events by title, tag, venue, or organizer"
                    placeholder="Search events by title, tag, venue, or organizer..."
                    className={`w-full pl-10 pr-4 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 ${
                      darkMode
                        ? 'border-white/20 bg-[#050507] text-white placeholder-zinc-500 focus:ring-[#BFFF00]'
                        : 'border-black/20 bg-zinc-50 text-black placeholder-zinc-400 focus:ring-[#7A00FF]'
                    }`}
                  />
                </div>

                {/* Filter Tabs: All, Trending, New, Old, Running, Outdated */}
                <div
                  role="group"
                  aria-label="Filter events"
                  className={`flex items-center gap-1 p-1 rounded-md overflow-x-auto border ${
                    darkMode ? 'bg-[#050507] border-white/15' : 'bg-zinc-100 border-black/10'
                  }`}
                >
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'trending', label: 'Trending' },
                      { id: 'new', label: 'New' },
                      { id: 'old', label: 'Old' },
                      { id: 'running', label: 'Running' },
                      { id: 'outdated', label: 'Outdated' },
                    ] as { id: EventFilterMode; label: string }[]
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilterMode(tab.id)}
                      className={`px-3.5 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-all duration-300 whitespace-nowrap shrink-0 cursor-pointer ${
                        filterMode === tab.id
                          ? darkMode
                            ? 'bg-[#BFFF00] text-black shadow-sm'
                            : 'bg-black text-white shadow-sm'
                          : darkMode
                          ? 'text-zinc-400 hover:text-white'
                          : 'text-zinc-600 hover:text-black'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable Rectangular Event Cards Section */}
              <div className="py-1">
                {homeFilteredEvents.length === 0 ? (
                  <div
                    className={`p-12 rounded-md border text-center space-y-3 ${
                      darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/15 bg-white'
                    }`}
                  >
                    <p className={`text-sm font-medium ${darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      No events match your current search or filter criteria.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setFilterMode('all');
                      }}
                      className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider cursor-pointer ${
                        darkMode ? 'bg-[#BFFF00] text-black' : 'bg-black text-white'
                      }`}
                    >
                      Reset Filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-1">
                    {homeFilteredEvents.map((ev) => (
                      <EventCard
                        key={ev.id}
                        event={ev}
                        currentUserId={currentUser.id}
                        darkMode={darkMode}
                        onCheckout={(id) => setSelectedEventId(id)}
                        onToggleFavourite={handleToggleFavourite}
                        onDeleteCard={handleIgnoreEventFromHome}
                        deleteButtonLabel="Ignore"
                        deleteButtonAriaLabel={`Ignore ${ev.title} and move to Ignored events`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Bottom-Right Floating Plus Button on Normal Home Screen to Create New Event */}
      {showHomeCreatePlusButton && (
        <button
          type="button"
          onClick={handleStartCreateEvent}
          aria-label="Add a new event"
          title="Add a new event"
          className={`fixed bottom-6 right-6 z-30 w-14 h-14 rounded-md shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer border ${
            darkMode
              ? 'bg-[#BFFF00] hover:bg-[#d2ff4d] text-black border-white/20 shadow-[#BFFF00]/20'
              : 'bg-black hover:bg-[#7A00FF] text-white border-black'
          }`}
        >
          <Plus className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
