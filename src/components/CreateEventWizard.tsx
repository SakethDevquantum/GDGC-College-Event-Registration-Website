import React, { useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { FormFieldCategory, UserProfile, validateEventDates } from '../utils/eventLogic';

interface CustomFormFieldDraft {
  fieldName: string;
  fieldType: FormFieldCategory;
  options: string[];
  isRequired: boolean;
}

interface CreateEventWizardProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  darkMode: boolean;
  onCancel: () => void;
  onCreateEvent: (payload: {
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
  }) => Promise<{ ok: boolean; error?: string }>;
}

function toLocalDatetimeValue(hoursFromNow: number): string {
  const d = new Date(Date.now() + hoursFromNow * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface CalendarDateTimeFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (nextVal: string) => void;
  darkMode: boolean;
}

const CalendarDateTimeField: React.FC<CalendarDateTimeFieldProps> = ({
  id,
  label,
  value,
  onChange,
  darkMode,
}) => {
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [datePartRaw, timePartRaw] = (value || '').split('T');
  const datePart = datePartRaw || '2026-10-24';
  const timePart = (timePartRaw || '10:00').slice(0, 5);

  const parsedDate = new Date(`${datePart}T${timePart}:00`);
  const safeYear = Number.isNaN(parsedDate.getFullYear()) ? 2026 : parsedDate.getFullYear();
  const safeMonth = Number.isNaN(parsedDate.getMonth()) ? 9 : parsedDate.getMonth();
  const safeDay = Number.isNaN(parsedDate.getDate()) ? 1 : parsedDate.getDate();

  const [viewYear, setViewYear] = useState<number>(safeYear);
  const [viewMonth, setViewMonth] = useState<number>(safeMonth);

  const pad = (n: number) => String(n).padStart(2, '0');

  const handleDatePartChange = (nextDateStr: string) => {
    if (!nextDateStr) return;
    onChange(`${nextDateStr}T${timePart}`);
    const [y, m] = nextDateStr.split('-').map(Number);
    if (y && m) {
      setViewYear(y);
      setViewMonth(m - 1);
    }
  };

  const handleTimePartChange = (nextTimeStr: string) => {
    if (!nextTimeStr) return;
    onChange(`${datePart}T${nextTimeStr}`);
  };

  const handleSelectDay = (dayNum: number) => {
    const nextDateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(dayNum)}`;
    onChange(`${nextDateStr}T${timePart}`);
    setCalendarOpen(false);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);

  return (
    <div className="relative space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="block text-xs font-bold uppercase tracking-wider">
          {label} <span className="text-red-500">*</span>
        </label>
        <button
          type="button"
          onClick={() => {
            setCalendarOpen((prev) => !prev);
          }}
          data-testid={`calendar-toggle-${id}`}
          className={`inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider hover:underline cursor-pointer ${
            darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'
          }`}
        >
          <CalendarIcon className="w-3.5 h-3.5" />
          <span>{calendarOpen ? 'Close Calendar' : 'Open Calendar'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
        {/* Native Calendar Date Picker Input */}
        <div className="sm:col-span-7 relative">
          <input
            ref={dateInputRef}
            id={id}
            type="date"
            required
            aria-label={label}
            value={datePart}
            onClick={() => {
              try {
                (dateInputRef.current as any)?.showPicker?.();
              } catch {
                // Ignore if showPicker is already open or unsupported in headless browser
              }
            }}
            onChange={(e) => handleDatePartChange(e.target.value)}
            className={`w-full px-3.5 py-2.5 rounded-md border text-sm font-mono tabular-nums cursor-pointer focus:outline-none focus:ring-2 ${
              darkMode
                ? 'border-white/20 bg-[#050507] text-white [color-scheme:dark] focus:ring-[#BFFF00]'
                : 'border-black/20 bg-zinc-50 text-black [color-scheme:light] focus:ring-[#7A00FF]'
            }`}
          />
        </div>

        {/* Time Input */}
        <div className="sm:col-span-5 relative">
          <input
            id={`${id}-time`}
            type="time"
            required
            aria-label={`${label} Time`}
            value={timePart}
            onChange={(e) => handleTimePartChange(e.target.value)}
            className={`w-full px-3.5 py-2.5 rounded-md border text-sm font-mono tabular-nums cursor-pointer focus:outline-none focus:ring-2 ${
              darkMode
                ? 'border-white/20 bg-[#050507] text-white [color-scheme:dark] focus:ring-[#BFFF00]'
                : 'border-black/20 bg-zinc-50 text-black [color-scheme:light] focus:ring-[#7A00FF]'
            }`}
          />
        </div>
      </div>

      {/* Interactive Visual Calendar Picker Popover */}
      {calendarOpen && (
        <div
          data-testid={`calendar-popover-${id}`}
          className={`z-30 mt-2 p-4 rounded-md border shadow-2xl space-y-3 animate-card-left ${
            darkMode ? 'border-white/20 bg-[#050507] text-white' : 'border-black/20 bg-white text-black'
          }`}
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Previous month"
              className={`p-1.5 rounded-md border cursor-pointer ${
                darkMode
                  ? 'border-white/20 bg-[#0C0C10] hover:border-[#BFFF00]'
                  : 'border-black/20 bg-zinc-100 hover:bg-zinc-200'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-sm font-bold">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Next month"
              className={`p-1.5 rounded-md border cursor-pointer ${
                darkMode
                  ? 'border-white/20 bg-[#0C0C10] hover:border-[#BFFF00]'
                  : 'border-black/20 bg-zinc-100 hover:bg-zinc-200'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-zinc-400">
            {WEEKDAY_LABELS.map((wd) => (
              <div key={wd} className="py-1">
                {wd}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((dayNum, idx) => {
              if (dayNum === null) {
                return <div key={`empty-${idx}`} className="h-8" />;
              }
              const isSelected =
                dayNum === safeDay && viewMonth === safeMonth && viewYear === safeYear;
              return (
                <button
                  key={dayNum}
                  type="button"
                  onClick={() => handleSelectDay(dayNum)}
                  className={`h-8 rounded-md text-xs font-mono tabular-nums font-semibold transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? darkMode
                        ? 'bg-[#BFFF00] text-black shadow-sm'
                        : 'bg-black text-white shadow-sm'
                      : darkMode
                      ? 'hover:bg-white/10 text-zinc-200'
                      : 'hover:bg-zinc-100 text-zinc-800'
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const CreateEventWizard: React.FC<CreateEventWizardProps> = ({
  currentUser,
  allUsers,
  darkMode,
  onCancel,
  onCreateEvent,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState('');
  const [tag, setTag] = useState('Hackathon');
  const [registrationStart, setRegistrationStart] = useState(() => toLocalDatetimeValue(1));
  const [registrationEnd, setRegistrationEnd] = useState(() => toLocalDatetimeValue(24));
  const [eventStart, setEventStart] = useState(() => toLocalDatetimeValue(30));
  const [eventEnd, setEventEnd] = useState(() => toLocalDatetimeValue(48));
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [posterFileName, setPosterFileName] = useState('');
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [allowedUserIds, setAllowedUserIds] = useState<string[]>([]);

  const handlePosterFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPosterFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPosterUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Step 2: Custom registration form fields — starts empty!
  const [formFields, setFormFields] = useState<CustomFormFieldDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const otherUsers = allUsers.filter((u) => u.id !== currentUser.id);

  const handleToggleAllowedUser = (uid: string) => {
    setAllowedUserIds((prev) => (prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]));
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (title.trim().length < 2) {
      setError('Please enter an event title (at least 2 characters).');
      return;
    }
    if (venue.trim().length < 2) {
      setError('Please enter the event venue.');
      return;
    }
    if (description.trim().length < 5) {
      setError('Please enter the full event description.');
      return;
    }

    const dateValidation = validateEventDates({
      registrationStart: new Date(registrationStart).toISOString(),
      registrationEnd: new Date(registrationEnd).toISOString(),
      eventStart: new Date(eventStart).toISOString(),
      eventEnd: new Date(eventEnd).toISOString(),
    });

    if (!dateValidation.valid) {
      setError(dateValidation.error || 'Invalid event or registration dates.');
      return;
    }

    setStep(2);
  };

  const handleAddField = () => {
    setFormFields((prev) => [
      ...prev,
      {
        fieldName: '',
        fieldType: 'text',
        options: ['Option 1', 'Option 2'],
        isRequired: true,
      },
    ]);
  };

  const handleUpdateField = (idx: number, patch: Partial<CustomFormFieldDraft>) => {
    setFormFields((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  };

  const handleAddOption = (fieldIdx: number) => {
    setFormFields((prev) =>
      prev.map((item, i) =>
        i === fieldIdx
          ? { ...item, options: [...item.options, `Option ${item.options.length + 1}`] }
          : item
      )
    );
  };

  const handleUpdateOption = (fieldIdx: number, optIdx: number, value: string) => {
    setFormFields((prev) =>
      prev.map((item, i) =>
        i === fieldIdx
          ? {
              ...item,
              options: item.options.map((opt, j) => (j === optIdx ? value : opt)),
            }
          : item
      )
    );
  };

  const handleRemoveOption = (fieldIdx: number, optIdx: number) => {
    setFormFields((prev) =>
      prev.map((item, i) =>
        i === fieldIdx
          ? {
              ...item,
              options: item.options.filter((_, j) => j !== optIdx),
            }
          : item
      )
    );
  };

  const handleRemoveField = (idx: number) => {
    setFormFields((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    for (let i = 0; i < formFields.length; i++) {
      const f = formFields[i];
      if (!f.fieldName.trim()) {
        setError(`Please enter a Field Name for custom field #${i + 1}, or remove the empty field.`);
        return;
      }
      if (f.fieldType === 'single_radio' || f.fieldType === 'multi_radio') {
        const cleanedOptions = f.options.map((o) => o.trim()).filter(Boolean);
        if (cleanedOptions.length === 0) {
          setError(`Please provide at least one option for "${f.fieldName.trim()}".`);
          return;
        }
      }
    }

    setSubmitting(true);
    const res = await onCreateEvent({
      title: title.trim(),
      tag: tag.trim() || 'Technical',
      venue: venue.trim(),
      description: description.trim(),
      posterUrl: posterUrl.trim(),
      registrationStart: new Date(registrationStart).toISOString(),
      registrationEnd: new Date(registrationEnd).toISOString(),
      eventStart: new Date(eventStart).toISOString(),
      eventEnd: new Date(eventEnd).toISOString(),
      friendsOnly,
      allowedUserIds,
      formFields: formFields.map((f) => ({
        fieldName: f.fieldName.trim(),
        fieldType: f.fieldType,
        options:
          f.fieldType === 'single_radio' || f.fieldType === 'multi_radio'
            ? f.options.map((o) => o.trim()).filter(Boolean)
            : [],
        isRequired: f.isRequired,
      })),
    });
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error || 'Could not create event.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 animate-slide-left">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={step === 2 ? () => setStep(1) : onCancel}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-md border text-xs font-bold uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer ${
            darkMode
              ? 'border-white/20 bg-[#0C0C10] hover:border-[#BFFF00] text-white'
              : 'border-black/20 bg-white hover:bg-black hover:text-white text-black'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{step === 2 ? 'Back to Step 1 (Event Details)' : 'Back to Home'}</span>
        </button>

        <div className="text-xs font-mono tabular-nums text-zinc-400">
          Step {step} of 2 · {step === 1 ? 'Event Schedule & Visibility' : 'Registration Form Builder'}
        </div>
      </div>

      <div
        className={`p-6 sm:p-8 rounded-md border ${
          darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/15 bg-white'
        }`}
      >
        {error && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-md border border-red-500/60 bg-red-950/60 text-red-200 text-sm"
          >
            {error}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleNextStep} className="space-y-5 animate-slide-left">
            <div>
              <h2 className="font-display text-xl sm:text-2xl uppercase tracking-tight">
                Step 1: Create New Technical Event
              </h2>
              <p className={`text-xs mt-1 ${darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Configure event title, calendar registration window, non-overlapping event schedule, venue, and
                audience access rules.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="ev-title" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                  Event Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="ev-title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Quantum Computing & Qiskit Workshop"
                  className={`w-full px-3.5 py-2.5 rounded-md border text-sm focus:outline-none focus:ring-2 ${
                    darkMode
                      ? 'border-white/20 bg-[#050507] text-white focus:ring-[#BFFF00]'
                      : 'border-black/20 bg-zinc-50 text-black focus:ring-[#7A00FF]'
                  }`}
                />
              </div>

              <div>
                <label htmlFor="ev-tag" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                  Event Tag <span className="text-red-500">*</span>
                </label>
                <input
                  id="ev-tag"
                  type="text"
                  required
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="Hackathon / Robotics / Workshop"
                  className={`w-full px-3.5 py-2.5 rounded-md border text-sm focus:outline-none focus:ring-2 ${
                    darkMode
                      ? 'border-white/20 bg-[#050507] text-white focus:ring-[#BFFF00]'
                      : 'border-black/20 bg-zinc-50 text-black focus:ring-[#7A00FF]'
                  }`}
                />
              </div>
            </div>

            {/* Calendar Inputs for Registration Time (Start & End) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CalendarDateTimeField
                id="reg-start"
                label="Registration Start Date"
                value={registrationStart}
                onChange={setRegistrationStart}
                darkMode={darkMode}
              />

              <CalendarDateTimeField
                id="reg-end"
                label="Registration End Date"
                value={registrationEnd}
                onChange={setRegistrationEnd}
                darkMode={darkMode}
              />
            </div>

            {/* Calendar Inputs for Event Date (Start & End — Must be strictly after Registration End) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CalendarDateTimeField
                id="evt-start"
                label="Event Start Date"
                value={eventStart}
                onChange={setEventStart}
                darkMode={darkMode}
              />

              <CalendarDateTimeField
                id="evt-end"
                label="Event End Date"
                value={eventEnd}
                onChange={setEventEnd}
                darkMode={darkMode}
              />
            </div>
            <p className="text-xs text-zinc-400">
              Note: Choose dates using the calendar picker above. Event start date/time must be strictly after
              registration end date/time (cannot be before or overlapping with registration).
            </p>

            {/* Venue */}
            <div>
              <label htmlFor="ev-venue" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                Venue <span className="text-red-500">*</span>
              </label>
              <input
                id="ev-venue"
                type="text"
                required
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="e.g. Sir C.V. Raman Auditorium, Academic Block B"
                className={`w-full px-3.5 py-2.5 rounded-md border text-sm focus:outline-none focus:ring-2 ${
                  darkMode
                    ? 'border-white/20 bg-[#050507] text-white focus:ring-[#BFFF00]'
                    : 'border-black/20 bg-zinc-50 text-black focus:ring-[#7A00FF]'
                }`}
              />
            </div>

            {/* Full Event Description */}
            <div>
              <label htmlFor="ev-desc" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                Full Event Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="ev-desc"
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide full event agenda, prerequisites, hardware/software details, and prizes..."
                className={`w-full px-3.5 py-2.5 rounded-md border text-sm focus:outline-none focus:ring-2 ${
                  darkMode
                    ? 'border-white/20 bg-[#050507] text-white focus:ring-[#BFFF00]'
                    : 'border-black/20 bg-zinc-50 text-black focus:ring-[#7A00FF]'
                }`}
              />
            </div>

            {/* Optional Event Poster Picture Upload */}
            <div
              className={`p-4 rounded-md border space-y-3 ${
                darkMode ? 'border-white/15 bg-[#050507]' : 'border-black/12 bg-zinc-50'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <label
                    htmlFor="ev-poster-upload"
                    className="block text-xs font-bold uppercase tracking-wider"
                  >
                    Attach Event Poster Picture{' '}
                    <span className="text-zinc-400 font-normal normal-case">(Optional — Not Mandatory)</span>
                  </label>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Optionally upload a poster image for this event. Students can view the complete poster by clicking
                    the eye icon when checking out the event.
                  </p>
                </div>

                <label
                  htmlFor="ev-poster-upload"
                  data-testid="upload-event-poster-label"
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-md border text-xs font-bold uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer shrink-0 ${
                    darkMode
                      ? 'border-white/20 bg-[#0C0C10] hover:border-[#BFFF00] text-white'
                      : 'border-black/20 bg-white hover:bg-black hover:text-white text-black'
                  }`}
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>{posterUrl ? 'Change Poster Picture' : 'Attach Poster Picture'}</span>
                  <input
                    id="ev-poster-upload"
                    data-testid="upload-event-poster-input"
                    type="file"
                    accept="image/*"
                    onChange={handlePosterFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {posterUrl ? (
                <div
                  data-testid="attached-poster-preview"
                  className={`flex items-center justify-between gap-4 p-3 rounded-md border ${
                    darkMode ? 'border-[#BFFF00]/40 bg-[#0C0C10]' : 'border-black/15 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={posterUrl}
                      alt="Event poster preview"
                      className="w-16 h-16 rounded-md object-cover border border-[#BFFF00] shrink-0"
                    />
                    <div className="min-w-0">
                      <div className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}`}>
                        Poster Attached
                      </div>
                      <div className="text-xs text-zinc-400 truncate">
                        {posterFileName || 'Uploaded event poster'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPosterUrl('');
                      setPosterFileName('');
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-red-500/50 text-red-400 hover:bg-red-950/40 text-xs font-bold uppercase tracking-wider cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Remove Poster</span>
                  </button>
                </div>
              ) : (
                <div className="text-xs text-zinc-400 italic">
                  No poster attached yet (optional). If left empty, &ldquo;No poster attached for this event&rdquo; will
                  be shown.
                </div>
              )}
            </div>

            {/* Visibility Controls: Friends Only Toggle + Multi-Select Allowed Users */}
            <div
              className={`p-4 rounded-md border space-y-4 ${
                darkMode ? 'border-white/15 bg-[#050507]' : 'border-black/12 bg-zinc-50'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <label className="inline-flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={friendsOnly}
                    onChange={(e) => setFriendsOnly(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <div>
                    <span className="text-sm font-semibold block">Friends only can register</span>
                    <span className="text-xs text-zinc-400">
                      Restrict event visibility and registration to your friends list
                    </span>
                  </div>
                </label>

                <button
                  type="button"
                  onClick={() => setShowUserSelector((prev) => !prev)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md border text-xs font-bold uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer ${
                    allowedUserIds.length > 0
                      ? darkMode
                        ? 'border-[#BFFF00] bg-[#BFFF00]/15 text-[#BFFF00]'
                        : 'border-black bg-black text-white'
                      : darkMode
                      ? 'border-white/20 bg-[#0C0C10] text-white hover:border-[#BFFF00]'
                      : 'border-black/20 bg-white text-black hover:border-black'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>
                    Choose the users you can only allow to register
                    {allowedUserIds.length > 0 ? ` (${allowedUserIds.length} selected)` : ''}
                  </span>
                </button>
              </div>

              {showUserSelector && (
                <div className={`pt-3 border-t space-y-2 animate-slide-left ${darkMode ? 'border-white/15' : 'border-black/10'}`}>
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>
                      Multi-select specific students allowed to see and register from the Home screen (leave
                      unselected to allow all eligible students):
                    </span>
                    {allowedUserIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setAllowedUserIds([])}
                        className={`font-bold uppercase tracking-wider hover:underline cursor-pointer ${
                          darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'
                        }`}
                      >
                        Clear selection
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pt-1">
                    {otherUsers.map((u) => {
                      const selected = allowedUserIds.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleToggleAllowedUser(u.id)}
                          className={`flex items-center justify-between p-2.5 rounded-md border text-left text-xs transition-all duration-300 cursor-pointer ${
                            selected
                              ? darkMode
                                ? 'border-[#BFFF00] bg-[#BFFF00]/15 text-white'
                                : 'border-black bg-zinc-100 text-black'
                              : darkMode
                              ? 'border-white/15 bg-[#0C0C10] hover:border-white/40'
                              : 'border-black/15 bg-white hover:border-black/40'
                          }`}
                        >
                          <div className="truncate pr-2">
                            <div className="font-semibold truncate">{u.name}</div>
                            <div className="text-zinc-400 font-mono tabular-nums">
                              {u.rollNumber} · Year {u.year} · {u.branch}
                            </div>
                          </div>
                          <div
                            className={`w-4 h-4 rounded-sm flex items-center justify-center shrink-0 border ${
                              selected
                                ? darkMode
                                  ? 'bg-[#BFFF00] border-[#BFFF00] text-black'
                                  : 'bg-black border-black text-white'
                                : 'border-zinc-500'
                            }`}
                          >
                            {selected && <Check className="w-3 h-3" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer active:scale-[0.98] ${
                  darkMode
                    ? 'bg-[#BFFF00] hover:bg-[#d2ff4d] text-black shadow-lg'
                    : 'bg-black hover:bg-[#7A00FF] text-white shadow-lg'
                }`}
              >
                <span>Next: Step 2 (Registration Form Fields)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleFinalSubmit} className="space-y-6 animate-slide-left">
            <div>
              <h2 className="font-display text-xl sm:text-2xl uppercase tracking-tight">
                Step 2: Configure Registration Form Fields
              </h2>
              <p className={`text-xs mt-1 ${darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Click &ldquo;Add Field&rdquo; below to add custom form questions. Choose each field&apos;s
                category (<strong>Text field</strong>, <strong>Single select radio</strong>, or{' '}
                <strong>Multi select radio</strong>) and toggle whether it is Required* or Optional. The event
                creator ({currentUser.name}) is automatically added as a registered member.
              </p>
            </div>

            {formFields.length === 0 ? (
              <div
                className={`p-8 rounded-md border border-dashed text-center space-y-2 ${
                  darkMode ? 'border-white/20 bg-[#050507]' : 'border-black/20 bg-zinc-50'
                }`}
              >
                <p className="text-sm font-medium">No custom registration fields added yet.</p>
                <p className="text-xs text-zinc-400">
                  Click &ldquo;Add Field&rdquo; below to define custom questions (Text field, Single select
                  radio, or Multi select radio), or publish now with the standard student fields.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {formFields.map((field, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-md border space-y-4 animate-card-left ${
                      darkMode ? 'border-white/15 bg-[#050507]' : 'border-black/15 bg-zinc-50'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
                      <div className="flex-1 w-full">
                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                          Field Name / Question{' '}
                          {field.isRequired ? <span className="text-red-500">*</span> : '(Optional)'}
                        </label>
                        <input
                          type="text"
                          required
                          value={field.fieldName}
                          onChange={(e) => handleUpdateField(index, { fieldName: e.target.value })}
                          placeholder="e.g. GitHub Repository URL, T-Shirt Size, or Domains of Interest"
                          className={`w-full px-3.5 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 ${
                            darkMode
                              ? 'border-white/20 bg-[#0C0C10] text-white focus:ring-[#BFFF00]'
                              : 'border-black/20 bg-white text-black focus:ring-[#7A00FF]'
                          }`}
                        />
                      </div>

                      <div className="w-full sm:w-52">
                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                          Field Category
                        </label>
                        <select
                          aria-label={`Field category for field ${index + 1}`}
                          value={field.fieldType}
                          onChange={(e) =>
                            handleUpdateField(index, {
                              fieldType: e.target.value as FormFieldCategory,
                            })
                          }
                          className={`w-full px-3 py-2 rounded-md border text-sm font-medium focus:outline-none focus:ring-2 ${
                            darkMode
                              ? 'border-white/20 bg-[#0C0C10] text-white focus:ring-[#BFFF00]'
                              : 'border-black/20 bg-white text-black focus:ring-[#7A00FF]'
                          }`}
                        >
                          <option value="text">Text field</option>
                          <option value="single_radio">Single select radio</option>
                          <option value="multi_radio">Multi select radio</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2 self-end">
                        <button
                          type="button"
                          onClick={() => handleUpdateField(index, { isRequired: !field.isRequired })}
                          className={`px-3 py-2 rounded-md border text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer whitespace-nowrap ${
                            field.isRequired
                              ? darkMode
                                ? 'border-[#BFFF00] bg-[#BFFF00]/15 text-[#BFFF00]'
                                : 'border-black bg-black text-white'
                              : darkMode
                              ? 'border-white/20 bg-[#0C0C10] text-zinc-400'
                              : 'border-black/20 bg-white text-zinc-600'
                          }`}
                        >
                          {field.isRequired ? 'Required *' : 'Optional'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveField(index)}
                          aria-label={`Remove field ${index + 1}`}
                          className="p-2 rounded-md text-red-500 hover:bg-red-950/50 transition-all duration-300 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Category Buttons for quick visual switching */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-zinc-400 mr-1">
                        Choose Category:
                      </span>
                      {(
                        [
                          { id: 'text', label: 'Text field' },
                          { id: 'single_radio', label: 'Single select radio' },
                          { id: 'multi_radio', label: 'Multi select radio' },
                        ] as { id: FormFieldCategory; label: string }[]
                      ).map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleUpdateField(index, { fieldType: cat.id })}
                          className={`px-2.5 py-1 rounded-sm border text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                            field.fieldType === cat.id
                              ? darkMode
                                ? 'border-[#BFFF00] bg-[#BFFF00] text-black'
                                : 'border-black bg-black text-white'
                              : darkMode
                              ? 'border-white/20 bg-[#0C0C10] text-zinc-300 hover:border-[#BFFF00]'
                              : 'border-black/20 bg-white text-zinc-700 hover:border-black'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    {/* Radio Options Builder for Single Select Radio & Multi Select Radio */}
                    {(field.fieldType === 'single_radio' || field.fieldType === 'multi_radio') && (
                      <div
                        className={`p-3.5 rounded-md border space-y-2.5 ${
                          darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/15 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold ${darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}`}>
                            {field.fieldType === 'single_radio'
                              ? 'Single Select Radio Options (user chooses 1 option)'
                              : 'Multi Select Radio Options (user can choose multiple options)'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddOption(index)}
                            className={`inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider hover:underline cursor-pointer ${
                              darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Option</span>
                          </button>
                        </div>

                        <div className="space-y-2">
                          {field.options.map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-center gap-2">
                              <input
                                type="radio"
                                disabled
                                className="w-3.5 h-3.5"
                              />
                              <input
                                type="text"
                                required
                                value={opt}
                                onChange={(e) => handleUpdateOption(index, optIdx, e.target.value)}
                                placeholder={`Option ${optIdx + 1}`}
                                className={`flex-1 px-3 py-1.5 rounded-md border text-xs focus:outline-none focus:ring-2 ${
                                  darkMode
                                    ? 'border-white/20 bg-[#050507] text-white focus:ring-[#BFFF00]'
                                    : 'border-black/20 bg-zinc-50 text-black focus:ring-[#7A00FF]'
                                }`}
                              />
                              {field.options.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOption(index, optIdx)}
                                  aria-label={`Remove option ${optIdx + 1}`}
                                  className="p-1.5 rounded-md text-red-500 hover:bg-red-950/50 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div>
              <button
                type="button"
                onClick={handleAddField}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-md border text-xs font-bold uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer ${
                  darkMode
                    ? 'border-white/20 bg-[#050507] hover:border-[#BFFF00] text-white'
                    : 'border-black/20 bg-zinc-100 hover:bg-black hover:text-white text-black'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Add Field</span>
              </button>
            </div>

            <div
              className={`p-4 rounded-md border text-xs flex items-center justify-between ${
                darkMode
                  ? 'border-white/15 bg-[#050507] text-zinc-400'
                  : 'border-black/15 bg-zinc-50 text-zinc-600'
              }`}
            >
              <span>
                Form automatically includes Student Name, Roll Number, Email Address, and the{' '}
                <strong>Submit</strong> button.
              </span>
              <span className="font-mono tabular-nums font-semibold">
                {formFields.length} custom {formFields.length === 1 ? 'field' : 'fields'}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`px-4 py-2.5 rounded-md border text-xs font-bold uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer ${
                  darkMode
                    ? 'border-white/20 bg-[#050507] text-white'
                    : 'border-black/20 bg-white text-black'
                }`}
              >
                Previous Step
              </button>

              <button
                type="submit"
                disabled={submitting}
                className={`px-6 py-3 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer active:scale-[0.98] disabled:opacity-50 ${
                  darkMode
                    ? 'bg-[#BFFF00] hover:bg-[#d2ff4d] text-black shadow-lg'
                    : 'bg-black hover:bg-[#7A00FF] text-white shadow-lg'
                }`}
              >
                {submitting ? 'Publishing Event...' : 'Publish Event & Registration Form'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
