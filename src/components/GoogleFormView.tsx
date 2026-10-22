import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';
import {
  EventRecord,
  RegistrationEmailRecord,
  UserProfile,
} from '../utils/eventLogic';
import { formatReadableDate } from './EventCard';

interface GoogleFormViewProps {
  event: EventRecord;
  currentUser: UserProfile;
  darkMode: boolean;
  onBack: () => void;
  onSubmitRegistration: (
    eventId: string,
    email: string,
    answers: Record<string, string>
  ) => Promise<{ ok: boolean; error?: string; latestEmail?: RegistrationEmailRecord }>;
}

export const GoogleFormView: React.FC<GoogleFormViewProps> = ({
  event,
  currentUser,
  darkMode,
  onBack,
  onSubmitRegistration,
}) => {
  const [email, setEmail] = useState(currentUser.email || '');
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of event.formFields) {
      init[f.fieldName] = '';
    }
    return init;
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid student email address.');
      return;
    }

    for (const f of event.formFields) {
      const val = (answers[f.fieldName] || '').trim();
      if (f.isRequired && !val) {
        setError(`"${f.fieldName}" is a required field.`);
        return;
      }
    }

    setSubmitting(true);
    const result = await onSubmitRegistration(event.id, trimmedEmail, answers);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error || 'Registration failed.');
      return;
    }

    setSubmittedSuccess(true);
  };

  if (submittedSuccess) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-4 animate-slide-left">
        <div
          className={`rounded-md border overflow-hidden ${
            darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/15 bg-white'
          }`}
        >
          <div className={`h-2.5 ${darkMode ? 'bg-[#BFFF00]' : 'bg-[#7A00FF]'}`} />
          <div className="p-6 sm:p-8 space-y-4">
            <div className={`flex items-center gap-3 ${darkMode ? 'text-[#BFFF00]' : 'text-emerald-600'}`}>
              <CheckCircle2 className="w-7 h-7 shrink-0" />
              <div>
                <h2 className="font-display text-xl sm:text-2xl uppercase">Registration Recorded!</h2>
                <p className={`text-xs mt-1 ${darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  Your participation in <span className="font-semibold">{event.title}</span> has been saved.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onBack}
                className={`px-5 py-2.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer active:scale-95 ${
                  darkMode ? 'bg-[#BFFF00] text-black hover:bg-[#d2ff4d]' : 'bg-black text-white hover:bg-[#7A00FF]'
                }`}
              >
                Return to Event Details
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-12 animate-slide-left">
      <div className="flex items-center justify-between">
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
          <span>Back to Event</span>
        </button>

        <span className={`inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider font-bold ${darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}`}>
          <FileSpreadsheet className="w-4 h-4" />
          <span>Google Form Registration Sheet</span>
        </span>
      </div>

      {/* Google Form Header Card */}
      <div
        className={`rounded-md border overflow-hidden ${
          darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/15 bg-white'
        }`}
      >
        <div className={`h-2.5 ${darkMode ? 'bg-[#BFFF00]' : 'bg-[#7A00FF]'}`} />
        <div className="p-6 space-y-2">
          <h1 className="font-display text-xl sm:text-2xl uppercase tracking-tight">
            {event.title} — Registration Form
          </h1>
          <p className="text-xs text-zinc-400 font-mono tabular-nums">
            Venue: {event.venue} · Event Starts: {formatReadableDate(event.eventStart)}
          </p>
          <p className={`text-sm pt-1 ${darkMode ? 'text-zinc-300' : 'text-zinc-600'}`}>{event.description}</p>
          <p className="text-xs text-red-500 font-medium pt-2">* Indicates required question</p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-md border border-red-500/60 bg-red-950/60 text-red-200 text-sm"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Student Name Question */}
        <div
          className={`p-5 rounded-md border space-y-2 ${
            darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/15 bg-white'
          }`}
        >
          <label className="block text-xs font-bold uppercase tracking-wider">
            Student Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            readOnly
            value={currentUser.name}
            className={`w-full px-3.5 py-2 rounded-md border text-sm ${
              darkMode
                ? 'border-white/15 bg-[#050507] text-zinc-300'
                : 'border-black/12 bg-zinc-50 text-zinc-700'
            }`}
          />
        </div>

        {/* Roll Number Question */}
        <div
          className={`p-5 rounded-md border space-y-2 ${
            darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/15 bg-white'
          }`}
        >
          <label className="block text-xs font-bold uppercase tracking-wider">
            Roll Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            readOnly
            value={`${currentUser.rollNumber} (Year ${currentUser.year} · ${currentUser.branch})`}
            className={`w-full px-3.5 py-2 rounded-md border text-sm font-mono tabular-nums ${
              darkMode
                ? 'border-white/15 bg-[#050507] text-zinc-300'
                : 'border-black/12 bg-zinc-50 text-zinc-700'
            }`}
          />
        </div>

        {/* Student Email Address Question */}
        <div
          className={`p-5 rounded-md border space-y-2 ${
            darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/15 bg-white'
          }`}
        >
          <label htmlFor="gform-email" className="block text-xs font-bold uppercase tracking-wider">
            Student Email Address <span className="text-red-500">*</span>
          </label>
          <input
            id="gform-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full px-3.5 py-2.5 rounded-md border text-sm focus:outline-none focus:ring-2 ${
              darkMode
                ? 'border-white/20 bg-[#050507] text-white focus:ring-[#BFFF00]'
                : 'border-black/20 bg-zinc-50 text-black focus:ring-[#7A00FF]'
            }`}
          />
        </div>

        {/* Custom Fields Configured by the Event Creator */}
        {event.formFields.map((field) => {
          const fType = field.fieldType || 'text';
          const fOptions =
            Array.isArray(field.options) && field.options.length > 0
              ? field.options
              : ['Option 1', 'Option 2'];
          const currentVal = answers[field.fieldName] || '';
          const multiSelectedList = currentVal
            ? currentVal
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [];

          return (
            <div
              key={field.id}
              className={`p-5 rounded-md border space-y-3 ${
                darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/15 bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={`field-${field.id}`} className="block text-sm font-semibold">
                  {field.fieldName}{' '}
                  {field.isRequired ? (
                    <span className="text-red-500">*</span>
                  ) : (
                    <span className="text-xs font-normal text-zinc-400">(Optional)</span>
                  )}
                </label>
                <span className="text-[11px] font-mono text-zinc-400">
                  {fType === 'single_radio'
                    ? 'Single select radio'
                    : fType === 'multi_radio'
                    ? 'Multi select radio'
                    : 'Text field'}
                </span>
              </div>

              {fType === 'single_radio' ? (
                <div className="space-y-2 pt-1">
                  {fOptions.map((opt, idx) => {
                    const checked = currentVal === opt;
                    return (
                      <label
                        key={idx}
                        className={`flex items-center gap-3 p-2.5 rounded-md border text-sm cursor-pointer transition-all duration-200 ${
                          checked
                            ? darkMode
                              ? 'border-[#BFFF00] bg-[#BFFF00]/15 text-[#BFFF00] font-semibold'
                              : 'border-black bg-black text-white font-semibold'
                            : darkMode
                            ? 'border-white/15 bg-[#050507] text-zinc-200 hover:border-white/40'
                            : 'border-black/15 bg-zinc-50 text-zinc-800 hover:border-black/40'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`single-radio-${field.id}`}
                          checked={checked}
                          onChange={() =>
                            setAnswers((prev) => ({
                              ...prev,
                              [field.fieldName]: opt,
                            }))
                          }
                          className="w-4 h-4"
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              ) : fType === 'multi_radio' ? (
                <div className="space-y-2 pt-1">
                  {fOptions.map((opt, idx) => {
                    const checked = multiSelectedList.includes(opt);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          const nextList = checked
                            ? multiSelectedList.filter((item) => item !== opt)
                            : [...multiSelectedList, opt];
                          setAnswers((prev) => ({
                            ...prev,
                            [field.fieldName]: nextList.join(', '),
                          }));
                        }}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-md border text-left text-sm cursor-pointer transition-all duration-200 ${
                          checked
                            ? darkMode
                              ? 'border-[#BFFF00] bg-[#BFFF00]/15 text-[#BFFF00] font-semibold'
                              : 'border-black bg-black text-white font-semibold'
                            : darkMode
                            ? 'border-white/15 bg-[#050507] text-zinc-200 hover:border-white/40'
                            : 'border-black/15 bg-zinc-50 text-zinc-800 hover:border-black/40'
                        }`}
                      >
                        <input
                          type="radio"
                          readOnly
                          checked={checked}
                          className="w-4 h-4 pointer-events-none"
                        />
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <input
                  id={`field-${field.id}`}
                  type="text"
                  required={field.isRequired}
                  value={currentVal}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [field.fieldName]: e.target.value,
                    }))
                  }
                  placeholder="Your answer"
                  className={`w-full px-3.5 py-2.5 rounded-md border text-sm focus:outline-none focus:ring-2 ${
                    darkMode
                      ? 'border-white/20 bg-[#050507] text-white focus:ring-[#BFFF00]'
                      : 'border-black/20 bg-zinc-50 text-black focus:ring-[#7A00FF]'
                  }`}
                />
              )}
            </div>
          );
        })}

        {/* Automatic Submit Button */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="submit"
            disabled={submitting}
            className={`px-6 py-3 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer active:scale-[0.98] disabled:opacity-50 ${
              darkMode
                ? 'bg-[#BFFF00] hover:bg-[#d2ff4d] text-black shadow-lg'
                : 'bg-black hover:bg-[#7A00FF] text-white shadow-lg'
            }`}
          >
            {submitting ? 'Submitting Form...' : 'Submit'}
          </button>

          <button
            type="button"
            onClick={() => {
              const reset: Record<string, string> = {};
              for (const f of event.formFields) reset[f.fieldName] = '';
              setAnswers(reset);
            }}
            className={`text-xs font-bold uppercase tracking-wider hover:underline cursor-pointer ${
              darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'
            }`}
          >
            Clear form
          </button>
        </div>
      </form>
    </div>
  );
};
