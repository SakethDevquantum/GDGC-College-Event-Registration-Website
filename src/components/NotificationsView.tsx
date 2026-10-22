import React, { useRef, useState } from 'react';
import { ArrowLeft, Bell, BellOff, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { NotificationRecord } from '../utils/eventLogic';
import { formatReadableDate } from './EventCard';

interface NotificationsViewProps {
  notifications: NotificationRecord[];
  silentNotifications: boolean;
  darkMode: boolean;
  onBack: () => void;
  onToggleSilent: (nextVal: boolean) => Promise<void>;
  onDeleteNotification: (id: string) => Promise<void>;
  onClearAll: () => Promise<void>;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  silentNotifications,
  darkMode,
  onBack,
  onToggleSilent,
  onDeleteNotification,
  onClearAll,
}) => {
  // Track which notification IDs have been slid left or right to reveal the Delete icon
  const [slidDirectionById, setSlidDirectionById] = useState<Record<string, 'left' | 'right' | null>>({});
  const pointerStartX = useRef<Record<string, number>>({});

  const handlePointerDown = (id: string, e: React.PointerEvent) => {
    pointerStartX.current[id] = e.clientX;
  };

  const handlePointerUp = (id: string, e: React.PointerEvent) => {
    const startX = pointerStartX.current[id];
    if (startX === undefined) return;
    const delta = e.clientX - startX;
    if (delta < -35) {
      setSlidDirectionById((prev) => ({ ...prev, [id]: 'left' }));
    } else if (delta > 35) {
      setSlidDirectionById((prev) => ({ ...prev, [id]: 'right' }));
    }
    delete pointerStartX.current[id];
  };

  const toggleSlide = (id: string) => {
    setSlidDirectionById((prev) => ({
      ...prev,
      [id]: prev[id] ? null : 'left',
    }));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 animate-slide-left">
      {/* Header Row with Back, Silent Notifications Toggle at Top Right, and Clear All */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md border text-xs font-bold uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer ${
              darkMode
                ? 'border-white/20 bg-[#0C0C10] hover:border-[#BFFF00] text-white'
                : 'border-black/20 bg-white hover:bg-black hover:text-white text-black'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div>
            <h1 className="font-display text-xl sm:text-2xl uppercase tracking-tight">
              Notifications Center
            </h1>
            <p className="text-xs text-zinc-400">
              Slide any notification left or right to reveal its delete icon
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Silent Notifications Toggle at Top Right */}
          <button
            type="button"
            onClick={() => onToggleSilent(!silentNotifications)}
            aria-label={silentNotifications ? 'Disable silent notifications' : 'Enable silent notifications'}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md border text-xs font-bold uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer whitespace-nowrap ${
              silentNotifications
                ? 'border-amber-500 bg-amber-500/15 text-amber-400'
                : darkMode
                ? 'border-white/20 bg-[#0C0C10] text-zinc-200 hover:border-[#BFFF00]'
                : 'border-black/20 bg-white text-zinc-800 hover:border-black'
            }`}
          >
            {silentNotifications ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            <span>{silentNotifications ? 'Silent Notifications: ON' : 'Silent Notifications: OFF'}</span>
          </button>

          {/* Clear All Symbol / Button */}
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              aria-label="Clear all notifications"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div
        className={`p-6 rounded-md border space-y-3 ${
          darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/15 bg-white'
        }`}
      >
        {notifications.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Bell className="w-8 h-8 text-zinc-400 mx-auto" />
            <p className="text-sm font-medium text-zinc-400">
              No notifications right now.
            </p>
          </div>
        ) : (
          notifications.map((n) => {
            const slid = slidDirectionById[n.id];
            return (
              <div
                key={n.id}
                className={`relative overflow-hidden rounded-md border animate-card-left ${
                  darkMode ? 'border-white/15 bg-[#050507]' : 'border-black/15 bg-zinc-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  {/* Left Delete Action when slid right */}
                  {slid === 'right' && (
                    <button
                      type="button"
                      onClick={() => onDeleteNotification(n.id)}
                      aria-label={`Delete notification: ${n.message}`}
                      className="px-4 py-4 bg-red-600 hover:bg-red-500 text-white flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  )}

                  {/* Notification Body (Slideable Left or Right) */}
                  <div
                    onPointerDown={(e) => handlePointerDown(n.id, e)}
                    onPointerUp={(e) => handlePointerUp(n.id, e)}
                    onClick={() => toggleSlide(n.id)}
                    className="flex-1 p-4 flex items-center justify-between gap-4 select-none cursor-pointer transition-transform duration-200"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono tabular-nums">
                        <span className={`font-mono uppercase tracking-wider font-bold ${darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}`}>
                          {n.type.replace(/_/g, ' ')}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatReadableDate(n.createdAt)}</span>
                      </div>
                      <p className="text-sm font-medium leading-snug break-words">{n.message}</p>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-zinc-400 shrink-0">
                      <ChevronLeft className="w-4 h-4" />
                      <span className="hidden sm:inline">Slide</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Right Delete Action when slid left */}
                  {slid === 'left' && (
                    <button
                      type="button"
                      onClick={() => onDeleteNotification(n.id)}
                      aria-label={`Delete notification: ${n.message}`}
                      className="px-4 py-4 bg-red-600 hover:bg-red-500 text-white flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
