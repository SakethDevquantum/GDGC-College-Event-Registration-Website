import React, { useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { NotificationRecord } from '../utils/eventLogic';

interface ToastPopupProps {
  notification: NotificationRecord | null;
  onDismiss: () => void;
  darkMode: boolean;
}

export const ToastPopup: React.FC<ToastPopupProps> = ({ notification, onDismiss, darkMode }) => {
  const [dragX, setDragX] = useState(0);
  const startXRef = useRef<number | null>(null);

  useEffect(() => {
    if (!notification) return;
    setDragX(0);
    const timer = window.setTimeout(() => {
      onDismiss();
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [notification, onDismiss]);

  if (!notification) return null;

  const handlePointerDown = (e: React.PointerEvent) => {
    startXRef.current = e.clientX;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (startXRef.current === null) return;
    const delta = e.clientX - startXRef.current;
    setDragX(delta);
  };

  const handlePointerUp = () => {
    if (Math.abs(dragX) > 65) {
      onDismiss();
    } else {
      setDragX(0);
    }
    startXRef.current = null;
  };

  return (
    <div
      key={notification.id}
      role="status"
      aria-live="polite"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        transform: `translateX(${dragX}px)`,
        opacity: Math.max(0.2, 1 - Math.abs(dragX) / 180),
      }}
      className={`animate-slide-left fixed top-20 left-4 right-4 sm:left-auto sm:right-6 z-50 sm:w-96 p-4 rounded-md border shadow-2xl transition-transform duration-150 select-none cursor-grab active:cursor-grabbing ${
        darkMode
          ? 'bg-[#0C0C10] border-[#BFFF00]/60 text-white shadow-black/80'
          : 'bg-white border-black/20 text-black shadow-zinc-300/80'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-md shrink-0 ${
            darkMode ? 'bg-[#BFFF00] text-black' : 'bg-black text-[#BFFF00]'
          }`}
        >
          <Bell className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-xs font-mono uppercase tracking-wider font-bold ${
                darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'
              }`}
            >
              Live Notification · Swipe to dismiss
            </span>
            <span className="text-[11px] text-zinc-400 font-mono tabular-nums">5s</span>
          </div>
          <p className="text-sm font-medium mt-1 leading-snug break-words">{notification.message}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification popup"
          className="p-1 rounded-md text-zinc-400 hover:text-white shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
