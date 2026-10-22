import React, { useState } from 'react';
import {
  BRANCH_OPTIONS,
  YEAR_OPTIONS,
  BranchType,
  CollegeYear,
  evaluatePasswordStrength,
  validateRegistrationDetails,
} from '../utils/eventLogic';
import { ArrowRight, Calendar, GraduationCap, Lock, Moon, ShieldCheck, Sun, User, Users } from 'lucide-react';
import { LandingBackgroundVideo } from './LandingBackgroundVideo';

interface EntryScreenProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onSignIn: (payload: {
    username: string;
    password: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onRegister: (payload: {
    name: string;
    year: number;
    branch: BranchType;
    rollNumber: string;
    username: string;
    password: string;
    confirmPassword: string;
  }) => Promise<{ ok: boolean; error?: string; code?: string }>;
}

export const EntryScreen: React.FC<EntryScreenProps> = ({
  darkMode,
  onToggleDarkMode,
  onSignIn,
  onRegister,
}) => {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');

  // Sign-In state
  const [signInUsername, setSignInUsername] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Register state
  const [name, setName] = useState('');
  const [branch, setBranch] = useState<BranchType>('cse');
  const [year, setYear] = useState<CollegeYear>(3);
  const [rollNumber, setRollNumber] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [alreadyRegisteredWarning, setAlreadyRegisteredWarning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pwdStrength = evaluatePasswordStrength(regPassword);

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAlreadyRegisteredWarning(false);

    if (!signInUsername.trim() || !signInPassword) {
      setError('Please enter both your username and password.');
      return;
    }

    setSubmitting(true);
    const res = await onSignIn({
      username: signInUsername.trim(),
      password: signInPassword,
    });
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error || 'Unable to sign in.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAlreadyRegisteredWarning(false);

    const check = validateRegistrationDetails({
      name,
      year,
      branch,
      rollNumber,
      username: regUsername,
      password: regPassword,
      confirmPassword,
    });

    if (!check.valid) {
      setError(check.error || 'Please fill all required registration details.');
      return;
    }

    setSubmitting(true);
    const res = await onRegister({
      name: name.trim(),
      year: Number(year),
      branch,
      rollNumber: rollNumber.trim(),
      username: regUsername.trim(),
      password: regPassword,
      confirmPassword,
    });
    setSubmitting(false);

    if (!res.ok) {
      if (res.code === 'ALREADY_REGISTERED') {
        setAlreadyRegisteredWarning(true);
      }
      setError(res.error || 'Unable to register student account.');
    }
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-300 relative overflow-x-hidden ${
        darkMode
          ? 'bg-[#050507] text-white'
          : 'bg-[#f8f8fa] text-black'
      }`}
    >
      {/* Full-bleed continuously looping background video with 2-second restart delay */}
      <LandingBackgroundVideo darkMode={darkMode} delayMs={2000} />

      {/* Top Bar inspired by mdntevents.com */}
      <header
        className={`sticky top-0 z-30 flex items-center justify-between gap-8 px-6 lg:px-10 py-4 border-b transition-colors duration-300 backdrop-blur-md ${
          darkMode
            ? 'border-white/15 bg-[#050507]/65'
            : 'border-black/10 bg-white/75'
        }`}
      >
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          <div
            className={`w-8 h-8 rounded-md flex items-center justify-center border ${
              darkMode
                ? 'bg-[#111116] border-white/20 text-[#BFFF00]'
                : 'bg-black border-black text-[#BFFF00]'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
          </div>
          <span className="font-display text-base sm:text-lg tracking-tight uppercase">
            FEST-REGISTER
          </span>
        </div>

        <nav
          className={`hidden md:flex items-center gap-5 px-5 py-2 rounded-md border text-xs font-medium backdrop-blur-md ${
            darkMode
              ? 'bg-black/45 border-white/20 text-zinc-200'
              : 'bg-white/70 border-black/15 text-zinc-800'
          }`}
        >
          <span className="whitespace-nowrap shrink-0 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#BFFF00]" />
            Authenticated Campus Portal
          </span>
          <span aria-hidden="true" className="opacity-40">·</span>
          <span className="whitespace-nowrap shrink-0">Technical Events &amp; Symposia</span>
          <span aria-hidden="true" className="opacity-40">·</span>
          <span className="whitespace-nowrap shrink-0">Mutual Friend Registrations</span>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-md border transition-all duration-300 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer backdrop-blur-md ${
              darkMode
                ? 'border-white/25 bg-black/55 text-white hover:border-[#BFFF00] hover:text-[#BFFF00]'
                : 'border-black/20 bg-white/85 text-black hover:bg-black hover:text-white'
            }`}
          >
            {darkMode ? <Sun className="w-3.5 h-3.5 text-[#BFFF00]" /> : <Moon className="w-3.5 h-3.5 text-[#7A00FF]" />}
            <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>
      </header>

      {/* Main Two-Column Auth Layout with Smooth Left-to-Right Slide Animation */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 py-10 lg:py-16 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center animate-slide-left">
          {/* Left Column: Editorial Campus Brief in mdntevents.com Display Style */}
          <div className="lg:col-span-6 space-y-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest">
                <span
                  className={`w-2 h-2 rounded-full ${
                    darkMode ? 'bg-[#BFFF00]' : 'bg-[#7A00FF]'
                  }`}
                />
                <span className={darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF] font-bold'}>
                  College Technical Event Registration System
                </span>
              </div>

              <h1
                className="font-display text-2xl sm:text-3xl lg:text-[38px] uppercase tracking-tight leading-[1.38] drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)]"
                style={{ textWrap: 'balance' }}
              >
                <span>REGISTER FOR CAMPUS HACKATHONS, </span>
                <span className={darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}>
                  HOST TECHNICAL EVENTS, AND TRACK FRIENDS.
                </span>
              </h1>

              <p
                className={`text-sm sm:text-base leading-relaxed max-w-xl drop-shadow-[0_2px_12px_rgba(0,0,0,0.75)] ${
                  darkMode ? 'text-zinc-200' : 'text-zinc-800 font-medium'
                }`}
              >
                Sign in with your unique username and password, or register a new student account with your name,
                academic branch, study year, and roll number to access the live campus event board, manage your
                created events, and connect with mutual friends.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div
                className={`float-card p-5 rounded-md border backdrop-blur-md transition-all duration-300 ${
                  darkMode
                    ? 'border-white/20 bg-[#0C0C10]/70 hover:border-[#BFFF00]/80'
                    : 'border-black/15 bg-white/80 hover:border-[#7A00FF]'
                }`}
              >
                <Calendar className={`w-5 h-5 mb-3 ${darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}`} />
                <div className="text-lg font-bold font-mono tabular-nums">10 Branches</div>
                <div className={`text-xs mt-1 ${darkMode ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  CSE, AI&amp;ML, ECE, Mech &amp; more
                </div>
              </div>
              <div
                className={`float-card p-5 rounded-md border backdrop-blur-md transition-all duration-300 ${
                  darkMode
                    ? 'border-white/20 bg-[#0C0C10]/70 hover:border-[#BFFF00]/80'
                    : 'border-black/15 bg-white/80 hover:border-[#7A00FF]'
                }`}
              >
                <Users className={`w-5 h-5 mb-3 ${darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}`} />
                <div className="text-lg font-bold font-mono tabular-nums">Mutual Sync</div>
                <div className={`text-xs mt-1 ${darkMode ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  See friends in each event
                </div>
              </div>
              <div
                className={`float-card p-5 rounded-md border backdrop-blur-md transition-all duration-300 ${
                  darkMode
                    ? 'border-white/20 bg-[#0C0C10]/70 hover:border-[#BFFF00]/80'
                    : 'border-black/15 bg-white/80 hover:border-[#7A00FF]'
                }`}
              >
                <ShieldCheck className={`w-5 h-5 mb-3 ${darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}`} />
                <div className="text-lg font-bold font-mono tabular-nums">Secure Auth</div>
                <div className={`text-xs mt-1 ${darkMode ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  Unique username &amp; password
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Sign In / Register Card (Re-renders smoothly in React) */}
          <div key={mode} className="lg:col-span-6 animate-card-left">
            <div
              className={`float-card p-6 sm:p-8 rounded-md border shadow-2xl backdrop-blur-md transition-all duration-300 ${
                darkMode
                  ? 'border-white/20 bg-[#0C0C10]/80 shadow-black/80'
                  : 'border-black/15 bg-white/88 shadow-zinc-200/80'
              }`}
            >
              {mode === 'signin' ? (
                <>
                  <div className="mb-6">
                    <div className="text-[11px] font-mono uppercase tracking-widest text-[#BFFF00] bg-black px-2.5 py-1 rounded-sm inline-block mb-2">
                      PORTAL ACCESS
                    </div>
                    <h2 className="font-display text-xl sm:text-2xl uppercase tracking-tight">
                      Student Sign In
                    </h2>
                    <p className={`text-sm mt-1.5 ${darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      Enter your unique username and password to access Fest-Register.
                    </p>
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="mb-5 p-3.5 rounded-md border border-red-500/60 bg-red-950/60 text-red-200 text-sm"
                    >
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleSignInSubmit} className="space-y-5">
                    <div>
                      <label htmlFor="signin-username" className="block text-xs font-bold uppercase tracking-wider mb-2">
                        Username <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                        <input
                          id="signin-username"
                          type="text"
                          required
                          value={signInUsername}
                          onChange={(e) => setSignInUsername(e.target.value)}
                          placeholder="e.g. saketh_reddy"
                          className={`w-full pl-10 pr-3.5 py-2.5 rounded-md border text-sm focus:outline-none focus:ring-2 ${
                            darkMode
                              ? 'border-white/20 bg-[#050507] text-white placeholder-zinc-500 focus:ring-[#BFFF00] focus:border-[#BFFF00]'
                              : 'border-black/20 bg-zinc-50 text-black placeholder-zinc-400 focus:ring-[#7A00FF] focus:border-[#7A00FF]'
                          }`}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="signin-password" className="block text-xs font-bold uppercase tracking-wider mb-2">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                        <input
                          id="signin-password"
                          type="password"
                          required
                          value={signInPassword}
                          onChange={(e) => setSignInPassword(e.target.value)}
                          placeholder="Enter your password"
                          className={`w-full pl-10 pr-3.5 py-2.5 rounded-md border text-sm focus:outline-none focus:ring-2 ${
                            darkMode
                              ? 'border-white/20 bg-[#050507] text-white placeholder-zinc-500 focus:ring-[#BFFF00] focus:border-[#BFFF00]'
                              : 'border-black/20 bg-zinc-50 text-black placeholder-zinc-400 focus:ring-[#7A00FF] focus:border-[#7A00FF]'
                          }`}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-md font-bold uppercase tracking-wider text-xs transition-all duration-300 cursor-pointer whitespace-nowrap active:scale-[0.99] disabled:opacity-50 ${
                        darkMode
                          ? 'bg-[#BFFF00] hover:bg-[#d2ff4d] text-black shadow-lg shadow-[#BFFF00]/10'
                          : 'bg-black hover:bg-[#7A00FF] text-white shadow-lg'
                      }`}
                    >
                      <span>{submitting ? 'Signing In...' : 'Sign In'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>

                  {/* Bottom New? Register Option */}
                  <div
                    className={`mt-6 pt-5 border-t flex items-center justify-between gap-4 ${
                      darkMode ? 'border-white/15' : 'border-black/10'
                    }`}
                  >
                    <span className={`text-xs ${darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      Don&apos;t have a student account yet?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setAlreadyRegisteredWarning(false);
                        setMode('register');
                      }}
                      className={`px-4 py-2 rounded-md border text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                        darkMode
                          ? 'border-white/25 bg-white text-black hover:bg-[#BFFF00] hover:border-[#BFFF00]'
                          : 'border-black bg-white text-black hover:bg-black hover:text-white'
                      }`}
                    >
                      New? Register
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-6">
                    <div className="text-[11px] font-mono uppercase tracking-widest text-[#BFFF00] bg-black px-2.5 py-1 rounded-sm inline-block mb-2">
                      NEW STUDENT ACCOUNT
                    </div>
                    <h2 className="font-display text-xl sm:text-2xl uppercase tracking-tight">
                      Student Registration
                    </h2>
                    <p className={`text-sm mt-1.5 ${darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      Enter your student details, choose a unique username, and set a password to register.
                    </p>
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className={`mb-5 p-3.5 rounded-md border text-sm space-y-2 ${
                        alreadyRegisteredWarning
                          ? 'border-amber-400 bg-amber-950/70 text-amber-200'
                          : 'border-red-500/60 bg-red-950/60 text-red-200'
                      }`}
                    >
                      <div>{error}</div>
                      {alreadyRegisteredWarning && (
                        <div>
                          <button
                            type="button"
                            onClick={() => {
                              setSignInUsername(regUsername);
                              setError(null);
                              setAlreadyRegisteredWarning(false);
                              setMode('signin');
                            }}
                            className="px-3 py-1.5 rounded-md bg-[#BFFF00] text-black text-xs font-bold uppercase tracking-wider cursor-pointer"
                          >
                            Go to Sign In
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <form onSubmit={handleRegisterSubmit} className="space-y-4">
                    {/* 1. Student Name (Duplicates allowed) */}
                    <div>
                      <label htmlFor="reg-name" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                        Student Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="reg-name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Saketh Reddy"
                        className={`w-full px-3.5 py-2.5 rounded-md border text-sm focus:outline-none focus:ring-2 ${
                          darkMode
                            ? 'border-white/20 bg-[#050507] text-white placeholder-zinc-500 focus:ring-[#BFFF00]'
                            : 'border-black/20 bg-zinc-50 text-black placeholder-zinc-400 focus:ring-[#7A00FF]'
                        }`}
                      />
                    </div>

                    {/* 2. Branch & College Year of Study */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="reg-branch" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                          Branch <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="reg-branch"
                          value={branch}
                          onChange={(e) => setBranch(e.target.value as BranchType)}
                          className={`w-full px-3.5 py-2.5 rounded-md border text-sm focus:outline-none focus:ring-2 ${
                            darkMode
                              ? 'border-white/20 bg-[#050507] text-white focus:ring-[#BFFF00]'
                              : 'border-black/20 bg-zinc-50 text-black focus:ring-[#7A00FF]'
                          }`}
                        >
                          {BRANCH_OPTIONS.map((br) => (
                            <option key={br} value={br}>
                              {br}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="reg-year" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                          College Year of Study (1 to 4) <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="reg-year"
                          value={year}
                          onChange={(e) => setYear(Number(e.target.value) as CollegeYear)}
                          className={`w-full px-3.5 py-2.5 rounded-md border text-sm font-mono tabular-nums focus:outline-none focus:ring-2 ${
                            darkMode
                              ? 'border-white/20 bg-[#050507] text-white focus:ring-[#BFFF00]'
                              : 'border-black/20 bg-zinc-50 text-black focus:ring-[#7A00FF]'
                          }`}
                        >
                          {YEAR_OPTIONS.map((yr) => (
                            <option key={yr} value={yr}>
                              Year {yr}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* 3. Roll Number & 4. Unique Username */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="reg-roll" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                          Roll Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="reg-roll"
                          type="text"
                          required
                          value={rollNumber}
                          onChange={(e) => setRollNumber(e.target.value)}
                          placeholder="e.g. 24951A05Y8"
                          className={`w-full px-3.5 py-2.5 rounded-md border text-sm font-mono tabular-nums focus:outline-none focus:ring-2 ${
                            darkMode
                              ? 'border-white/20 bg-[#050507] text-white placeholder-zinc-500 focus:ring-[#BFFF00]'
                              : 'border-black/20 bg-zinc-50 text-black placeholder-zinc-400 focus:ring-[#7A00FF]'
                          }`}
                        />
                      </div>

                      <div>
                        <label htmlFor="reg-username" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                          Unique Username <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="reg-username"
                          type="text"
                          required
                          value={regUsername}
                          onChange={(e) => setRegUsername(e.target.value)}
                          placeholder="e.g. saketh_reddy"
                          className={`w-full px-3.5 py-2.5 rounded-md border text-sm font-mono focus:outline-none focus:ring-2 ${
                            darkMode
                              ? 'border-white/20 bg-[#050507] text-white placeholder-zinc-500 focus:ring-[#BFFF00]'
                              : 'border-black/20 bg-zinc-50 text-black placeholder-zinc-400 focus:ring-[#7A00FF]'
                          }`}
                        />
                      </div>
                    </div>

                    {/* 5. Password with Password Strength Scale (ONLY shown for Password field during Register) */}
                    <div>
                      <label htmlFor="reg-password" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="reg-password"
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Create a password"
                        className={`w-full px-3.5 py-2.5 rounded-md border text-sm focus:outline-none focus:ring-2 ${
                          darkMode
                            ? 'border-white/20 bg-[#050507] text-white placeholder-zinc-500 focus:ring-[#BFFF00]'
                            : 'border-black/20 bg-zinc-50 text-black placeholder-zinc-400 focus:ring-[#7A00FF]'
                        }`}
                      />

                      {/* Password Strength Scale: Poor (Red), Average (Gray), Strong (Green) */}
                      <div
                        data-testid="password-strength-scale"
                        className="mt-2.5 space-y-1.5"
                      >
                        <div className="grid grid-cols-3 gap-2">
                          {/* Poor Segment (Red) */}
                          <div
                            style={{
                              backgroundColor:
                                regPassword.length > 0 && pwdStrength.score >= 1
                                  ? pwdStrength.level === 'poor'
                                    ? '#ef4444'
                                    : pwdStrength.level === 'average'
                                    ? '#94a3b8'
                                    : '#10b981'
                                  : darkMode
                                  ? '#27272a'
                                  : '#e4e4e7',
                            }}
                            className={`h-2 rounded-full transition-all duration-300 ${
                              regPassword.length > 0 && pwdStrength.score >= 1
                                ? pwdStrength.level === 'poor'
                                  ? 'bg-red-500'
                                  : pwdStrength.level === 'average'
                                  ? 'bg-slate-400'
                                  : 'bg-emerald-500'
                                : darkMode
                                ? 'bg-zinc-800'
                                : 'bg-zinc-200'
                            }`}
                          />
                          {/* Average Segment (Gray) */}
                          <div
                            style={{
                              backgroundColor:
                                regPassword.length > 0 && pwdStrength.score >= 2
                                  ? pwdStrength.level === 'average'
                                    ? '#94a3b8'
                                    : '#10b981'
                                  : darkMode
                                  ? '#27272a'
                                  : '#e4e4e7',
                            }}
                            className={`h-2 rounded-full transition-all duration-300 ${
                              regPassword.length > 0 && pwdStrength.score >= 2
                                ? pwdStrength.level === 'average'
                                  ? 'bg-slate-400'
                                  : 'bg-emerald-500'
                                : darkMode
                                ? 'bg-zinc-800'
                                : 'bg-zinc-200'
                            }`}
                          />
                          {/* Strong Segment (Green) */}
                          <div
                            style={{
                              backgroundColor:
                                regPassword.length > 0 && pwdStrength.score >= 3
                                  ? '#10b981'
                                  : darkMode
                                  ? '#27272a'
                                  : '#e4e4e7',
                            }}
                            className={`h-2 rounded-full transition-all duration-300 ${
                              regPassword.length > 0 && pwdStrength.score >= 3
                                ? 'bg-emerald-500'
                                : darkMode
                                ? 'bg-zinc-800'
                                : 'bg-zinc-200'
                            }`}
                          />
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-3 font-medium">
                            <span
                              className={
                                regPassword.length > 0 && pwdStrength.level === 'poor'
                                  ? 'text-red-500 font-bold'
                                  : 'text-red-500/70'
                              }
                            >
                              Poor
                            </span>
                            <span
                              className={
                                regPassword.length > 0 && pwdStrength.level === 'average'
                                  ? 'text-slate-400 font-bold'
                                  : 'text-slate-400/70'
                              }
                            >
                              Average
                            </span>
                            <span
                              className={
                                regPassword.length > 0 && pwdStrength.level === 'strong'
                                  ? 'text-emerald-500 font-bold'
                                  : 'text-emerald-500/70'
                              }
                            >
                              Strong
                            </span>
                          </div>

                          {regPassword.length > 0 && (
                            <span
                              className={`font-semibold ${
                                pwdStrength.level === 'poor'
                                  ? 'text-red-500'
                                  : pwdStrength.level === 'average'
                                  ? 'text-slate-400'
                                  : 'text-emerald-500'
                              }`}
                            >
                              Strength: {pwdStrength.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 6. Confirm Password (No strength scale shown here) */}
                    <div>
                      <label htmlFor="reg-confirm-password" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                        Confirm Password <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="reg-confirm-password"
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your password"
                        className={`w-full px-3.5 py-2.5 rounded-md border text-sm focus:outline-none focus:ring-2 ${
                          darkMode
                            ? 'border-white/20 bg-[#050507] text-white placeholder-zinc-500 focus:ring-[#BFFF00]'
                            : 'border-black/20 bg-zinc-50 text-black placeholder-zinc-400 focus:ring-[#7A00FF]'
                        }`}
                      />
                      {confirmPassword.length > 0 && confirmPassword !== regPassword && (
                        <p className="text-xs text-red-500 mt-1">
                          Passwords do not match.
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-md font-bold uppercase tracking-wider text-xs transition-all duration-300 cursor-pointer whitespace-nowrap active:scale-[0.99] disabled:opacity-50 ${
                        darkMode
                          ? 'bg-[#BFFF00] hover:bg-[#d2ff4d] text-black shadow-lg shadow-[#BFFF00]/10'
                          : 'bg-black hover:bg-[#7A00FF] text-white shadow-lg'
                      }`}
                    >
                      <span>{submitting ? 'Registering Account...' : 'Register & Continue to Home Page'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>

                  {/* Bottom Switch Back to Sign In */}
                  <div
                    className={`mt-6 pt-5 border-t flex items-center justify-between gap-4 ${
                      darkMode ? 'border-white/15' : 'border-black/10'
                    }`}
                  >
                    <span className={`text-xs ${darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      Already registered an account?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setAlreadyRegisteredWarning(false);
                        setMode('signin');
                      }}
                      className={`px-4 py-2 rounded-md border text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                        darkMode
                          ? 'border-white/25 bg-white text-black hover:bg-[#BFFF00] hover:border-[#BFFF00]'
                          : 'border-black bg-white text-black hover:bg-black hover:text-white'
                      }`}
                    >
                      Sign In
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
