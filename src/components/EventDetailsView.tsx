import React, { useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  Eye,
  ImageOff,
  MapPin,
  Star,
  Trash2,
  UserCheck,
  Users,
  FileText,
  Phone,
  GraduationCap,
  X,
} from 'lucide-react';
import {
  EventRecord,
  EventRegistrationItem,
  UserProfile,
  computeEventRuntimeStatus,
} from '../utils/eventLogic';
import { formatReadableDate } from './EventCard';

interface EventDetailsViewProps {
  event: EventRecord;
  currentUser: UserProfile;
  friendIds: string[];
  darkMode: boolean;
  onBack: () => void;
  onToggleFavourite: (eventId: string) => void;
  onOpenParticipateForm: (event: EventRecord) => void;
  onRemoveParticipant: (eventId: string, targetUserId: string) => Promise<void>;
  onCancelEvent: (eventId: string) => Promise<void>;
}

export const EventDetailsView: React.FC<EventDetailsViewProps> = ({
  event,
  currentUser,
  friendIds,
  darkMode,
  onBack,
  onToggleFavourite,
  onOpenParticipateForm,
  onRemoveParticipant,
  onCancelEvent,
}) => {
  const [selectedRegistrant, setSelectedRegistrant] = useState<EventRegistrationItem | null>(null);
  const [showCreatorDetails, setShowCreatorDetails] = useState(false);
  const [hoverExpiredBtn, setHoverExpiredBtn] = useState(false);
  const [posterPopupOpen, setPosterPopupOpen] = useState(false);

  const hasPoster = Boolean(event.posterUrl && event.posterUrl.trim().length > 0);

  const { status, isExpired, countdownLabel } = computeEventRuntimeStatus(event);
  const isRunning = status === 'running' && !isExpired;
  const isCreator = event.creatorId === currentUser.id;
  const alreadyRegistered = event.registrations.some((r) => r.userId === currentUser.id);

  // Mutual friends who registered for this event
  const mutualFriendsRegistered = event.registrations.filter((r) => friendIds.includes(r.userId));

  // Full-page conditional rendering when the event creator clicks a registered user
  if (selectedRegistrant) {
    return (
      <div className="space-y-6 animate-slide-left">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setSelectedRegistrant(null)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md border text-xs font-bold uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer ${
              darkMode
                ? 'border-white/20 bg-[#0C0C10] hover:border-[#BFFF00] text-white'
                : 'border-black/20 bg-white hover:bg-black hover:text-white text-black'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {event.title} Registrants</span>
          </button>

          {isCreator && selectedRegistrant.userId !== event.creatorId && (
            <button
              type="button"
              onClick={async () => {
                await onRemoveParticipant(event.id, selectedRegistrant.userId);
                setSelectedRegistrant(null);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Registered User</span>
            </button>
          )}
        </div>

        <div
          className={`p-6 sm:p-8 rounded-md border max-h-[75vh] overflow-y-auto space-y-6 ${
            darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/15 bg-white'
          }`}
        >
          <div className={`border-b pb-4 ${darkMode ? 'border-white/15' : 'border-black/10'}`}>
            <p className={`text-xs font-mono uppercase tracking-wider font-bold ${darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}`}>
              Submitted Registration Form Response
            </p>
            <h2 className="font-display text-xl sm:text-2xl uppercase mt-1">{selectedRegistrant.studentName}</h2>
            <p className={`text-xs font-mono tabular-nums mt-1 ${darkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
              Roll No: {selectedRegistrant.rollNumber} · Year {selectedRegistrant.year} · Branch:{' '}
              {selectedRegistrant.branch} · Submitted {formatReadableDate(selectedRegistrant.createdAt)}
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider">Standard Student Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                className={`p-4 rounded-md border ${
                  darkMode ? 'border-white/15 bg-[#050507]' : 'border-black/12 bg-zinc-50'
                }`}
              >
                <div className="text-xs text-zinc-400">Student Name</div>
                <div className="text-sm font-semibold mt-1">{selectedRegistrant.studentName}</div>
              </div>
              <div
                className={`p-4 rounded-md border ${
                  darkMode ? 'border-white/15 bg-[#050507]' : 'border-black/12 bg-zinc-50'
                }`}
              >
                <div className="text-xs text-zinc-400">Roll Number</div>
                <div className="text-sm font-semibold font-mono tabular-nums mt-1">
                  {selectedRegistrant.rollNumber}
                </div>
              </div>
              <div
                className={`p-4 rounded-md border ${
                  darkMode ? 'border-white/15 bg-[#050507]' : 'border-black/12 bg-zinc-50'
                }`}
              >
                <div className="text-xs text-zinc-400">Email Address</div>
                <div className="text-sm font-semibold mt-1">{selectedRegistrant.email}</div>
              </div>
              <div
                className={`p-4 rounded-md border ${
                  darkMode ? 'border-white/15 bg-[#050507]' : 'border-black/12 bg-zinc-50'
                }`}
              >
                <div className="text-xs text-zinc-400">Academic Year & Branch</div>
                <div className="text-sm font-semibold mt-1">
                  Year {selectedRegistrant.year} · {selectedRegistrant.branch}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider">Custom Event Form Fields & Submitted Answers</h3>
            {Object.keys(selectedRegistrant.answers || {}).length === 0 ? (
              <p className="text-sm text-zinc-400">
                No additional custom fields were configured for this event.
              </p>
            ) : (
              <div className="space-y-3">
                {Object.entries(selectedRegistrant.answers).map(([fieldName, answerValue]) => (
                  <div
                    key={fieldName}
                    className={`p-4 rounded-md border ${
                      darkMode ? 'border-white/15 bg-[#050507]' : 'border-black/12 bg-zinc-50'
                    }`}
                  >
                    <div className="text-xs font-medium text-zinc-400">{fieldName}</div>
                    <div className="text-sm font-semibold mt-1 break-words">
                      {answerValue || <span className="italic text-zinc-500">Not provided (optional)</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10 animate-slide-left">
      {/* Top Bar with Back Icon Button */}
      <div className="flex items-center justify-between gap-4">
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
          <span>Back to Events</span>
        </button>

        <div className="flex items-center gap-2.5">
          {!event.isIgnored && (
            <button
              type="button"
              onClick={() => onToggleFavourite(event.id)}
              aria-label={event.isFavourite ? 'Remove from favourites' : 'Add to favourites'}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md border text-xs font-bold uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer ${
                darkMode
                  ? 'border-white/20 bg-[#0C0C10] hover:border-[#BFFF00]'
                  : 'border-black/20 bg-white hover:border-black'
              }`}
            >
              <Star
                className={`w-4 h-4 ${
                  event.isFavourite ? 'text-[#BFFF00] fill-[#BFFF00]' : 'text-zinc-400'
                }`}
              />
              <span>{event.isFavourite ? 'Starred in Favourites' : 'Star Event'}</span>
            </button>
          )}

          {isCreator && (
            <button
              type="button"
              onClick={() => onCancelEvent(event.id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Cancel Event</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Scrollable Event Detail Card */}
      <div
        className={`p-6 sm:p-8 rounded-md border space-y-6 ${
          darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/15 bg-white'
        }`}
      >
        {/* Title, Time & Active / Outdated Display */}
        <div className={`space-y-3 border-b pb-6 ${darkMode ? 'border-white/15' : 'border-black/10'}`}>
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-400 flex-wrap">
            <span className={`font-mono uppercase tracking-wider font-bold ${darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}`}>
              {event.tag}
            </span>
            <span aria-hidden="true">·</span>
            <span
              className={`font-semibold ${
                isRunning ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {isRunning ? 'Active / Running' : 'Outdated / Expired'}
            </span>
            {countdownLabel && (
              <>
                <span aria-hidden="true">·</span>
                <span className={`font-mono tabular-nums ${darkMode ? 'text-white' : 'text-black'}`}>
                  {countdownLabel}
                </span>
              </>
            )}
            {event.friendsOnly && (
              <>
                <span aria-hidden="true">·</span>
                <span>Friends-Only Access</span>
              </>
            )}
          </div>

          <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-tight">{event.title}</h1>

          <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs font-mono tabular-nums ${darkMode ? 'text-zinc-300' : 'text-zinc-700'}`}>
            <div className="flex items-center gap-2">
              <Calendar className={`w-4 h-4 shrink-0 ${darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}`} />
              <div>
                <div className="text-zinc-400 font-sans">Event Schedule</div>
                <div>
                  {formatReadableDate(event.eventStart)} – {formatReadableDate(event.eventEnd)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className={`w-4 h-4 shrink-0 ${darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}`} />
              <div>
                <div className="text-zinc-400 font-sans">Registration Window</div>
                <div>
                  {formatReadableDate(event.registrationStart)} – {formatReadableDate(event.registrationEnd)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 font-sans">
              <MapPin className={`w-4 h-4 shrink-0 ${darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}`} />
              <div>
                <div className="text-zinc-400">Venue</div>
                <div className="font-semibold">{event.venue}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Event Creator Details */}
        <div
          className={`p-4 rounded-md border ${
            darkMode ? 'border-white/15 bg-[#050507]' : 'border-black/12 bg-zinc-50'
          }`}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full font-bold flex items-center justify-center text-sm shrink-0 ${
                  darkMode ? 'bg-[#BFFF00] text-black' : 'bg-black text-[#BFFF00]'
                }`}
              >
                {event.creatorName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-xs text-zinc-400">Event Organizer / Creator</div>
                <div className="text-sm font-bold">{event.creatorName}</div>
                <div className="text-xs text-zinc-400 font-mono tabular-nums">
                  {event.creatorRollNumber} · Year {event.creatorYear} · Branch: {event.creatorBranch}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowCreatorDetails((prev) => !prev)}
              className={`px-3 py-1.5 rounded-md border text-xs font-bold uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer ${
                darkMode
                  ? 'border-white/20 bg-[#0C0C10] hover:border-[#BFFF00] text-white'
                  : 'border-black/20 bg-white hover:bg-black hover:text-white text-black'
              }`}
            >
              {showCreatorDetails ? 'Hide Event Creator Details' : 'Event Creator Details'}
            </button>
          </div>

          {showCreatorDetails && (
            <div
              className={`mt-4 pt-3 border-t grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs animate-slide-left ${
                darkMode ? 'border-white/15' : 'border-black/10'
              }`}
            >
              <div>
                <span className="text-zinc-400 block">Organizer Name</span>
                <span className="font-semibold">{event.creatorName}</span>
              </div>
              <div>
                <span className="text-zinc-400 block">Roll Number</span>
                <span className="font-mono tabular-nums font-semibold">{event.creatorRollNumber}</span>
              </div>
              <div>
                <span className="text-zinc-400 block">Academic Branch & Year</span>
                <span className="font-semibold">
                  <GraduationCap className="w-3.5 h-3.5 inline mr-1" />
                  Year {event.creatorYear} · {event.creatorBranch}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block">Organizer Contact</span>
                <span className="font-mono tabular-nums font-semibold">
                  <Phone className="w-3.5 h-3.5 inline mr-1" />
                  {event.creatorPhone || 'Verified on file'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Full Event Description */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Full Event Description
          </h2>
          <div className={`text-base leading-relaxed whitespace-pre-line ${darkMode ? 'text-zinc-200' : 'text-zinc-700'}`}>
            {event.description}
          </div>
        </div>

        {/* Event Poster Section (Eye Icon -> Complete Poster Popup UI, or "No poster attached for this event") */}
        <div
          data-testid="event-poster-section"
          className={`p-4 rounded-md border space-y-3 ${
            darkMode ? 'border-white/15 bg-[#050507]' : 'border-black/12 bg-zinc-50'
          }`}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Event Poster
              </h2>
              {hasPoster ? (
                <p className={`text-xs mt-1 ${darkMode ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  Click the poster or the eye icon button to view the complete event poster in a popup window.
                </p>
              ) : (
                <p
                  data-testid="no-poster-attached-message"
                  className={`text-sm font-semibold mt-1 flex items-center gap-2 ${
                    darkMode ? 'text-zinc-400' : 'text-zinc-600'
                  }`}
                >
                  <ImageOff className="w-4 h-4 shrink-0 text-zinc-500" />
                  <span>No poster attached for this event</span>
                </p>
              )}
            </div>

            {hasPoster && (
              <button
                type="button"
                data-testid="view-poster-eye-button"
                aria-label="View complete event poster"
                onClick={() => setPosterPopupOpen(true)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-md border text-xs font-bold uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer ${
                  darkMode
                    ? 'border-[#BFFF00] bg-[#BFFF00] text-black hover:bg-[#d2ff4d]'
                    : 'border-black bg-black text-white hover:bg-[#7A00FF] hover:border-[#7A00FF]'
                }`}
              >
                <Eye className="w-4 h-4" />
                <span>View Poster</span>
              </button>
            )}
          </div>

          {hasPoster && (
            <div
              onClick={() => setPosterPopupOpen(true)}
              className="relative group cursor-pointer rounded-md overflow-hidden border border-white/15 max-w-sm"
            >
              <img
                src={event.posterUrl}
                alt={`${event.title} poster preview`}
                className="w-full h-44 object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-[#BFFF00]">
                <Eye className="w-5 h-5" />
                <span>Click to View Complete Poster</span>
              </div>
            </div>
          )}
        </div>

        {/* Mutual Friends Div */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Users className={`w-4 h-4 ${darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}`} />
              <span>Mutual Friends Registered for This Event ({mutualFriendsRegistered.length})</span>
            </h2>
          </div>

          <div
            data-testid="mutual-friends-scroll-box"
            className={`max-h-44 overflow-y-auto rounded-md border p-4 space-y-2.5 ${
              darkMode ? 'border-white/15 bg-[#050507]' : 'border-black/12 bg-zinc-50'
            }`}
          >
            {mutualFriendsRegistered.length === 0 ? (
              <p className="text-xs text-zinc-400 py-2">
                None of your mutual friends have registered for this event yet.
              </p>
            ) : (
              mutualFriendsRegistered.map((mf) => (
                <div
                  key={mf.id}
                  className={`flex items-center justify-between gap-3 p-3 rounded-md border ${
                    darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/12 bg-white'
                  }`}
                >
                  <div>
                    <div className="text-sm font-semibold">{mf.studentName}</div>
                    <div className="text-xs text-zinc-400 font-mono tabular-nums">
                      {mf.rollNumber} · Year {mf.year} · {mf.branch}
                    </div>
                  </div>
                  <span className={`text-xs font-bold flex items-center gap-1 ${darkMode ? 'text-[#BFFF00]' : 'text-emerald-600'}`}>
                    <UserCheck className="w-3.5 h-3.5" /> Mutual Friend Registered
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Creator Management Section: View & Delete Registered Participants */}
        {isCreator && (
          <div className={`space-y-3 pt-4 border-t ${darkMode ? 'border-white/15' : 'border-black/10'}`}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold flex items-center gap-2">
                <FileText className={`w-4 h-4 ${darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}`} />
                <span>Registered Participants ({event.registrations.length})</span>
              </h2>
              <span className="text-xs text-zinc-400">
                Click any student to inspect their submitted form fields or delete their registration
              </span>
            </div>

            {event.registrations.length === 0 ? (
              <p className="text-sm text-zinc-400 py-3">
                No students have registered for this event yet.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {event.registrations.map((reg) => (
                  <div
                    key={reg.id}
                    className={`flex items-center justify-between gap-4 p-3.5 rounded-md border transition-all duration-300 ${
                      darkMode
                        ? 'border-white/15 bg-[#050507] hover:border-[#BFFF00]/60'
                        : 'border-black/12 bg-zinc-50 hover:border-black/40'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedRegistrant(reg)}
                      className="text-left flex-1 min-w-0 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-bold hover:underline ${darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}`}>
                          {reg.studentName}
                        </span>
                        {reg.userId === event.creatorId && (
                          <span
                            className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm border ${
                              darkMode
                                ? 'bg-[#BFFF00]/15 text-[#BFFF00] border-[#BFFF00]/40'
                                : 'bg-black text-white border-black'
                            }`}
                          >
                            Event Creator (Auto-Member)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400 font-mono tabular-nums">
                        {reg.rollNumber} · Year {reg.year} · {reg.branch} · {reg.email}
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedRegistrant(reg)}
                        className={`px-3 py-1.5 rounded-md border text-xs font-bold uppercase tracking-wider cursor-pointer transition-all duration-300 active:scale-95 ${
                          darkMode
                            ? 'border-white/20 bg-[#0C0C10] text-white hover:border-[#BFFF00]'
                            : 'border-black/20 bg-white text-black hover:bg-black hover:text-white'
                        }`}
                      >
                        View Form Responses
                      </button>
                      {reg.userId !== event.creatorId && (
                        <button
                          type="button"
                          onClick={() => onRemoveParticipant(event.id, reg.userId)}
                          aria-label={`Delete participant ${reg.studentName}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs font-bold uppercase tracking-wider cursor-pointer transition-all duration-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bottom Participate / Register Action */}
        <div
          className={`pt-4 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
            darkMode ? 'border-white/15' : 'border-black/10'
          }`}
        >
          <div className="text-xs text-zinc-400">
            {!isRunning ? (
              <span className="text-amber-500 font-semibold">
                Cannot register expired event — Registration window has closed.
              </span>
            ) : alreadyRegistered ? (
              <span className={`font-semibold ${darkMode ? 'text-[#BFFF00]' : 'text-emerald-600'}`}>
                You are already a registered member of this event.
              </span>
            ) : (
              <span>
                Click Participate below to open the Google Form registration sheet for {event.title}.
              </span>
            )}
          </div>

          <div
            className="relative"
            onMouseEnter={() => {
              if (!isRunning) setHoverExpiredBtn(true);
            }}
            onMouseLeave={() => setHoverExpiredBtn(false)}
          >
            {hoverExpiredBtn && !isRunning && (
              <div
                role="tooltip"
                className="absolute -top-10 right-0 px-3 py-1.5 rounded-md bg-[#050507] border border-white/20 text-white text-xs font-medium whitespace-nowrap shadow-md z-10"
              >
                Cannot register expired event
              </div>
            )}

            <button
              type="button"
              disabled={!isRunning || alreadyRegistered}
              title={!isRunning ? 'Cannot register expired event' : undefined}
              onClick={() => {
                if (isRunning && !alreadyRegistered) {
                  onOpenParticipateForm(event);
                }
              }}
              className={`px-6 py-3 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-300 whitespace-nowrap ${
                !isRunning
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : alreadyRegistered
                  ? darkMode
                    ? 'bg-[#BFFF00]/20 text-[#BFFF00] border border-[#BFFF00]/50 cursor-default'
                    : 'bg-emerald-600 text-white opacity-90 cursor-default'
                  : darkMode
                  ? 'bg-[#BFFF00] hover:bg-[#d2ff4d] active:scale-[0.98] text-black cursor-pointer shadow-lg'
                  : 'bg-black hover:bg-[#7A00FF] active:scale-[0.98] text-white cursor-pointer shadow-lg'
              }`}
            >
              {!isRunning
                ? 'Cannot register expired event'
                : alreadyRegistered
                ? 'Already Registered'
                : 'Participate'}
            </button>
          </div>
        </div>
      </div>

      {/* Complete Poster Popup UI (Only rendered when hasPoster is true and posterPopupOpen is true) */}
      {hasPoster && posterPopupOpen && (
        <div
          data-testid="poster-popup-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`${event.title} complete poster`}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-sm animate-fade-backdrop"
          onClick={() => setPosterPopupOpen(false)}
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
                  onClick={() => setPosterPopupOpen(false)}
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
    </div>
  );
};
