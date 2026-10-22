import React, { useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  EyeOff,
  ImageOff,
  MapPin,
  RotateCcw,
  Star,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { EventRecord, computeEventRuntimeStatus } from '../utils/eventLogic';

interface EventCardProps {
  event: EventRecord;
  currentUserId?: string;
  darkMode: boolean;
  onCheckout: (eventId: string) => void;
  onToggleFavourite?: (eventId: string) => void;
  hideFavourite?: boolean;
  onRestoreCard?: (eventId: string) => void;
  onDeleteCard?: (eventId: string) => void;
  deleteButtonLabel?: string;
  deleteButtonAriaLabel?: string;
  ignoredInfoText?: string | null;
}

export function formatReadableDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const EventCard: React.FC<EventCardProps> = ({
  event,
  currentUserId,
  darkMode,
  onCheckout,
  onToggleFavourite,
  hideFavourite = false,
  onRestoreCard,
  onDeleteCard,
  deleteButtonLabel = 'Delete',
  deleteButtonAriaLabel,
  ignoredInfoText,
}) => {
  const [cardPosterOpen, setCardPosterOpen] = useState(false);
  const { status, countdownLabel } = computeEventRuntimeStatus(event);
  const isRunning = status === 'running';
  const showFavouriteOption = !hideFavourite && !event.isIgnored && Boolean(onToggleFavourite);
  const isAlreadyRegistered = Boolean(
    currentUserId && event.registrations.some((r) => r.userId === currentUserId)
  );
  const hasPoster = Boolean(event.posterUrl && event.posterUrl.trim().length > 0);

  const truncatedDesc =
    event.description.length > 135 ? `${event.description.slice(0, 135).trim()}...` : event.description;

  return (
    <>
    <article
      className={`animate-card-left float-card group relative rounded-md border p-6 flex flex-col justify-between transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-2xl ${
        darkMode
          ? 'bg-[#0C0C10] border-white/15 hover:border-[#BFFF00]/80 shadow-black/70'
          : 'bg-white border-black/15 hover:border-[#7A00FF] shadow-zinc-200/70'
      }`}
    >
      <div>
        {/* Top Metadata Line (Zero-Pill Unboxed Discipline) */}
        <div
          className={`flex items-center justify-between gap-3 text-xs mb-3 ${
            darkMode ? 'text-zinc-400' : 'text-zinc-500'
          }`}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`font-mono uppercase tracking-wider font-bold ${
                darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'
              }`}
            >
              {event.tag}
            </span>
            <span aria-hidden="true">·</span>
            <span
              className={`font-semibold ${
                isRunning
                  ? darkMode
                    ? 'text-emerald-400'
                    : 'text-emerald-600'
                  : darkMode
                  ? 'text-amber-400'
                  : 'text-amber-600'
              }`}
            >
              {isRunning ? 'Status: Running' : 'Status: Outdated'}
            </span>
            {countdownLabel && (
              <>
                <span aria-hidden="true">·</span>
                <span
                  className={`font-mono tabular-nums font-semibold ${
                    darkMode ? 'text-zinc-200' : 'text-zinc-800'
                  }`}
                >
                  {countdownLabel}
                </span>
              </>
            )}
            {ignoredInfoText && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-amber-500 font-medium">
                  {ignoredInfoText}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {showFavouriteOption && onToggleFavourite && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavourite(event.id);
                }}
                aria-label={
                  event.isFavourite ? `Remove ${event.title} from favourites` : `Add ${event.title} to favourites`
                }
                className={`p-1.5 rounded-md transition-all duration-300 active:scale-90 shrink-0 cursor-pointer ${
                  darkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'
                }`}
              >
                <Star
                  className={`w-5 h-5 transition-colors duration-300 ${
                    event.isFavourite
                      ? 'text-[#BFFF00] fill-[#BFFF00]'
                      : darkMode
                      ? 'text-zinc-500 hover:text-[#BFFF00]'
                      : 'text-zinc-400 hover:text-amber-500'
                  }`}
                />
              </button>
            )}

            {onRestoreCard && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRestoreCard(event.id);
                }}
                aria-label={`Restore ${event.title} to Home page`}
                title={`Restore ${event.title} to Home page`}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-xs font-bold uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer ${
                  darkMode
                    ? 'border-[#BFFF00]/50 bg-[#BFFF00]/10 text-[#BFFF00] hover:bg-[#BFFF00] hover:text-black'
                    : 'border-black/20 bg-zinc-100 text-black hover:bg-black hover:text-white'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore</span>
              </button>
            )}

            {onDeleteCard && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteCard(event.id);
                }}
                aria-label={deleteButtonAriaLabel || `${deleteButtonLabel} ${event.title}`}
                title={deleteButtonAriaLabel || `${deleteButtonLabel} ${event.title}`}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-xs font-bold uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer ${
                  darkMode
                    ? 'border-white/15 bg-white/5 text-zinc-300 hover:border-red-500 hover:bg-red-950/60 hover:text-red-300'
                    : 'border-black/15 bg-zinc-100 text-zinc-700 hover:border-red-500 hover:bg-red-50 hover:text-red-600'
                }`}
              >
                {deleteButtonLabel.toLowerCase() === 'ignore' ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{deleteButtonLabel}</span>
              </button>
            )}
          </div>
        </div>

        {/* Event Title */}
        <h3
          onClick={() => onCheckout(event.id)}
          className={`text-xl font-bold tracking-tight leading-snug mb-3 cursor-pointer transition-colors ${
            darkMode ? 'text-white group-hover:text-[#BFFF00]' : 'text-black group-hover:text-[#7A00FF]'
          }`}
        >
          {event.title}
        </h3>

        {/* Date, Time & Venue */}
        <div
          className={`space-y-1.5 text-xs mb-4 font-mono tabular-nums ${
            darkMode ? 'text-zinc-400' : 'text-zinc-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <Calendar className={`w-3.5 h-3.5 shrink-0 ${darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}`} />
            <span className="truncate">
              Event: {formatReadableDate(event.eventStart)} – {formatReadableDate(event.eventEnd)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className={`w-3.5 h-3.5 shrink-0 ${darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}`} />
            <span className="truncate">
              Reg Closes: {formatReadableDate(event.registrationEnd)}
            </span>
          </div>
          <div className="flex items-center gap-2 font-sans">
            <MapPin className={`w-3.5 h-3.5 shrink-0 ${darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}`} />
            <span className={`truncate font-semibold ${darkMode ? 'text-zinc-200' : 'text-zinc-800'}`}>
              {event.venue}
            </span>
          </div>
        </div>

        {/* Visible Description with ellipsis if too long */}
        <p className={`text-sm leading-relaxed mb-4 ${darkMode ? 'text-zinc-300' : 'text-zinc-600'}`}>
          {truncatedDesc}
        </p>

        {/* Poster Status / Eye Icon Action on Card */}
        <div className="mb-4">
          {hasPoster ? (
            <button
              type="button"
              data-testid={`card-poster-eye-${event.id}`}
              onClick={(e) => {
                e.stopPropagation();
                setCardPosterOpen(true);
              }}
              aria-label={`View complete poster for ${event.title}`}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                darkMode
                  ? 'border-[#BFFF00]/50 bg-[#BFFF00]/10 text-[#BFFF00] hover:bg-[#BFFF00] hover:text-black'
                  : 'border-black/20 bg-zinc-100 text-black hover:bg-black hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Poster</span>
            </button>
          ) : (
            <div
              data-testid={`card-no-poster-${event.id}`}
              className={`inline-flex items-center gap-1.5 text-xs ${
                darkMode ? 'text-zinc-500' : 'text-zinc-500'
              }`}
            >
              <ImageOff className="w-3.5 h-3.5 shrink-0" />
              <span>No poster attached for this event</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer with Organizer, Registration Count & Checkout OR Already Registered */}
      <div
        className={`pt-4 border-t flex items-center justify-between gap-3 ${
          darkMode ? 'border-white/12' : 'border-black/10'
        }`}
      >
        <div className={`text-xs truncate ${darkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
          <span>By {event.creatorName}</span>
          <span aria-hidden="true"> · </span>
          <span className="font-mono tabular-nums inline-flex items-center gap-1">
            <Users className="w-3.5 h-3.5 inline" /> {event.registrations.length} registered
          </span>
        </div>

        {isAlreadyRegistered ? (
          <button
            type="button"
            onClick={() => onCheckout(event.id)}
            data-testid="already-registered-badge"
            aria-label={`Already Registered for ${event.title}`}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border text-xs font-bold uppercase tracking-wider transition-all duration-300 whitespace-nowrap shrink-0 cursor-pointer ${
              darkMode
                ? 'border-[#BFFF00]/60 bg-[#BFFF00]/15 text-[#BFFF00] hover:bg-[#BFFF00]/25'
                : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Already Registered</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onCheckout(event.id)}
            aria-label={`Checkout ${event.title}`}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-300 whitespace-nowrap shrink-0 cursor-pointer active:scale-[0.97] ${
              darkMode
                ? 'bg-white text-black hover:bg-[#BFFF00]'
                : 'bg-black text-white hover:bg-[#7A00FF]'
            }`}
          >
            <span>Checkout</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </article>

    {/* Complete Poster Popup UI when clicking the Eye icon on the Event Card */}
    {hasPoster && cardPosterOpen && (
      <div
        data-testid="poster-popup-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${event.title} complete poster`}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-sm animate-fade-backdrop"
        onClick={(e) => {
          e.stopPropagation();
          setCardPosterOpen(false);
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-md border shadow-2xl overflow-hidden ${
            darkMode ? 'border-white/25 bg-[#0C0C10] text-white' : 'border-black/20 bg-white text-black'
          }`}
        >
          <div
            className={`flex items-center justify-between gap-4 px-5 py-3.5 border-b ${
              darkMode ? 'border-white/15 bg-[#050507]' : 'border-black/10 bg-zinc-50'
            }`}
          >
            <div className="min-w-0">
              <div className={`text-[11px] font-mono uppercase tracking-widest font-bold ${darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}`}>
                COMPLETE EVENT POSTER
              </div>
              <h3 className="text-sm sm:text-base font-bold truncate">{event.title}</h3>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={event.posterUrl}
                download={`${event.title.replace(/[^a-z0-9_-]+/gi, '_')}_poster.png`}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                  darkMode
                    ? 'border-white/20 bg-[#121217] hover:border-[#BFFF00] text-white'
                    : 'border-black/20 bg-white hover:bg-black hover:text-white text-black'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </a>
              <button
                type="button"
                data-testid="close-poster-popup-button"
                aria-label="Close poster popup"
                onClick={() => setCardPosterOpen(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Close</span>
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6 overflow-auto flex items-center justify-center bg-black/40">
            <img
              src={event.posterUrl}
              alt={`${event.title} complete poster`}
              data-testid="complete-poster-image"
              className="max-w-full max-h-[75vh] w-auto h-auto object-contain rounded-sm shadow-lg"
            />
          </div>
        </div>
      </div>
    )}
    </>
  );
};
