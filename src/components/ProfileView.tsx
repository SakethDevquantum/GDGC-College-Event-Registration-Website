import React, { useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, Lock, LogOut, Phone, Save, Trash2, User } from 'lucide-react';
import {
  BRANCH_OPTIONS,
  YEAR_OPTIONS,
  BranchType,
  CollegeYear,
  UserProfile,
  computeProfileCompletion,
  evaluatePasswordStrength,
  isValidEmail,
} from '../utils/eventLogic';

interface ProfileViewProps {
  currentUser: UserProfile;
  createdCount: number;
  participationsCount: number;
  favouritesCount: number;
  friendsCount: number;
  darkMode: boolean;
  onUpdateProfile: (patch: {
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
  }) => Promise<{ ok: boolean; error?: string }>;
  onSignOut: () => void;
  onDeleteAccount: () => Promise<{ ok: boolean; error?: string }>;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  createdCount,
  participationsCount,
  favouritesCount,
  friendsCount,
  darkMode,
  onUpdateProfile,
  onSignOut,
  onDeleteAccount,
}) => {
  const [name, setName] = useState(currentUser.name);
  const [username, setUsername] = useState(currentUser.username || '');
  const [rollNumber, setRollNumber] = useState(currentUser.rollNumber);
  const [year, setYear] = useState<CollegeYear>(currentUser.year as CollegeYear);
  const [branch, setBranch] = useState<BranchType>(currentUser.branch);
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');
  const [selectedFileName, setSelectedFileName] = useState<string>(
    currentUser.avatarUrl ? 'Saved profile picture' : ''
  );
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const newPwdStrength = evaluatePasswordStrength(newPassword);

  const completion = computeProfileCompletion({
    name,
    username,
    rollNumber,
    year,
    branch,
    phone,
    email,
    avatarUrl,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }

    if (email.trim() && !isValidEmail(email.trim())) {
      setError('Please enter a valid student email address.');
      return;
    }

    if (newPassword.length > 0) {
      if (newPassword.length < 4) {
        setError('New password must be at least 4 characters long.');
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setError('Confirm password does not match the new password.');
        return;
      }
    }

    setSaving(true);

    const res = await onUpdateProfile({
      name: name.trim(),
      username: username.trim(),
      rollNumber: rollNumber.trim(),
      year: Number(year),
      branch,
      phone: phone.trim(),
      email: email.trim(),
      avatarUrl,
      ...(newPassword.length > 0
        ? { newPassword, confirmNewPassword }
        : {}),
    });
    setSaving(false);

    if (!res.ok) {
      setError(res.error || 'Could not update profile.');
      return;
    }

    setNewPassword('');
    setConfirmNewPassword('');
    setSuccessMsg('Profile details updated across Fest-Register.');
  };

  const hasPhone = Boolean(currentUser.phone && currentUser.phone.trim().length >= 7);
  const hasEmail = isValidEmail(currentUser.email || '');

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-slide-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-tight">Student Profile</h1>
          <p className={`text-sm mt-1 ${darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
            Manage your student name, unique username, password, academic branch, study year, optional profile
            picture, phone number, and email address.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap shrink-0">
          <div
            data-testid="profile-completion-badge"
            className={`px-4 py-2.5 rounded-md border font-mono tabular-nums text-xs font-semibold shrink-0 ${
              completion.percentage === 100
                ? darkMode
                  ? 'border-[#BFFF00] bg-[#BFFF00]/15 text-[#BFFF00]'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : darkMode
                ? 'border-white/20 bg-[#0C0C10] text-[#BFFF00]'
                : 'border-black/20 bg-white text-[#7A00FF]'
            }`}
          >
            Profile Completed: <span className="text-sm font-bold">{completion.percentage}%</span> (
            {completion.completedCount}/{completion.totalCount})
          </div>

          <button
            type="button"
            data-testid="profile-sign-out-button"
            onClick={onSignOut}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-md border text-xs font-bold uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer shrink-0 ${
              darkMode
                ? 'border-white/25 bg-[#121217] hover:border-[#BFFF00] hover:text-[#BFFF00] text-white'
                : 'border-black/20 bg-white hover:bg-black hover:text-white text-black'
            }`}
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Profile Completion Progress Card */}
      <div
        className={`float-card p-5 rounded-md border space-y-2.5 ${
          darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/15 bg-white'
        }`}
      >
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
          <span>Profile Completion Progress</span>
          <span className={`font-mono tabular-nums ${darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}`}>
            {completion.percentage}% Complete
          </span>
        </div>
        <div
          className={`w-full h-2.5 rounded-full overflow-hidden ${
            darkMode ? 'bg-[#050507] border border-white/15' : 'bg-zinc-200'
          }`}
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              completion.percentage === 100
                ? 'bg-emerald-500'
                : darkMode
                ? 'bg-[#BFFF00]'
                : 'bg-[#7A00FF]'
            }`}
            style={{ width: `${completion.percentage}%` }}
          />
        </div>
        <p className="text-xs text-zinc-400">
          {completion.missingFields.length === 0
            ? 'Your profile is 100% complete! All fields including phone number, email address, and profile picture are filled.'
            : `Remaining to reach 100%: ${completion.missingFields.join(', ')}.`}
        </p>
      </div>

      {/* Phone & Email Requirement Callout */}
      {(!hasPhone || !hasEmail) && (
        <div
          className={`p-4 rounded-md border flex items-center justify-between gap-4 ${
            darkMode
              ? 'border-amber-500/50 bg-amber-950/40 text-amber-200'
              : 'border-amber-300 bg-amber-50 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-3 text-sm">
            <Phone className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              <strong>Phone number &amp; email required for events:</strong> Adding your phone number and email
              address is optional for browsing, but both are mandatory before you can{' '}
              <strong>create an event</strong> or <strong>participate in an event</strong>.
            </span>
          </div>
        </div>
      )}

      {/* Profile Summary Header Card */}
      <div
        className={`float-card p-6 rounded-md border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 ${
          darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/15 bg-white'
        }`}
      >
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={currentUser.name}
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-full object-cover border-2 border-[#BFFF00] shrink-0"
            />
          ) : (
            <div
              className={`w-16 h-16 rounded-full font-bold text-xl flex items-center justify-center shrink-0 ${
                darkMode ? 'bg-[#BFFF00] text-black' : 'bg-black text-[#BFFF00]'
              }`}
            >
              {currentUser.name.slice(0, 2).toUpperCase()}
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold">{currentUser.name}</h2>
              <span className={`text-xs font-mono font-bold ${darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}`}>
                @{currentUser.username}
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-mono tabular-nums mt-0.5">
              Roll No: {currentUser.rollNumber} · Year {currentUser.year} · Branch: {currentUser.branch}
            </p>
            <p className="text-xs text-zinc-400 font-mono tabular-nums mt-1">
              Phone: {currentUser.phone ? currentUser.phone : 'Not added yet'} · Email:{' '}
              {currentUser.email ? currentUser.email : 'Not added yet'}
            </p>
          </div>
        </div>

        {/* Tabular Stats Strip */}
        <div className="grid grid-cols-4 gap-4 w-full sm:w-auto text-center font-mono tabular-nums">
          <div
            className={`p-3 rounded-md border ${
              darkMode ? 'border-white/15 bg-[#050507]' : 'border-black/12 bg-zinc-50'
            }`}
          >
            <div className="text-lg font-bold">{createdCount}</div>
            <div className="text-[11px] font-sans text-zinc-400">My Events</div>
          </div>
          <div
            className={`p-3 rounded-md border ${
              darkMode ? 'border-white/15 bg-[#050507]' : 'border-black/12 bg-zinc-50'
            }`}
          >
            <div className="text-lg font-bold">{participationsCount}</div>
            <div className="text-[11px] font-sans text-zinc-400">Participations</div>
          </div>
          <div
            className={`p-3 rounded-md border ${
              darkMode ? 'border-white/15 bg-[#050507]' : 'border-black/12 bg-zinc-50'
            }`}
          >
            <div className="text-lg font-bold">{friendsCount}</div>
            <div className="text-[11px] font-sans text-zinc-400">Friends</div>
          </div>
          <div
            className={`p-3 rounded-md border ${
              darkMode ? 'border-white/15 bg-[#050507]' : 'border-black/12 bg-zinc-50'
            }`}
          >
            <div className="text-lg font-bold">{favouritesCount}</div>
            <div className="text-[11px] font-sans text-zinc-400">Favourites</div>
          </div>
        </div>
      </div>

      {/* Update Details Form */}
      <div
        className={`p-6 sm:p-8 rounded-md border ${
          darkMode ? 'border-white/15 bg-[#0C0C10]' : 'border-black/15 bg-white'
        }`}
      >
        <h3 className="font-display text-lg uppercase tracking-tight mb-1">
          Update Profile &amp; Account Credentials
        </h3>
        <p className="text-xs text-zinc-400 mb-5">
          Update your student name (duplicate student names are allowed), unique username, password, branch,
          study year, phone number, email address, or profile picture. Changes immediately reflect on all events
          you created or registered for.
        </p>

        {error && (
          <div
            role="alert"
            className="mb-5 p-4 rounded-md border border-red-500/60 bg-red-950/60 text-red-200 text-sm"
          >
            {error}
          </div>
        )}

        {successMsg && (
          <div
            role="status"
            className="mb-5 p-4 rounded-md border border-emerald-500/60 bg-emerald-950/60 text-emerald-200 text-sm flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="prof-name" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                Student Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                <input
                  id="prof-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Saketh Reddy"
                  className={`w-full pl-10 pr-3.5 py-2.5 rounded-md border text-sm focus:outline-none focus:ring-2 ${
                    darkMode
                      ? 'border-white/20 bg-[#050507] text-white placeholder-zinc-500 focus:ring-[#BFFF00]'
                      : 'border-black/20 bg-zinc-50 text-black placeholder-zinc-400 focus:ring-[#7A00FF]'
                  }`}
                />
              </div>
            </div>

            <div>
              <label htmlFor="prof-username" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                Unique Username <span className="text-red-500">*</span>
              </label>
              <input
                id="prof-username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. saketh_reddy"
                className={`w-full px-3.5 py-2.5 rounded-md border text-sm font-mono focus:outline-none focus:ring-2 ${
                  darkMode
                    ? 'border-white/20 bg-[#050507] text-white placeholder-zinc-500 focus:ring-[#BFFF00]'
                    : 'border-black/20 bg-zinc-50 text-black placeholder-zinc-400 focus:ring-[#7A00FF]'
                }`}
              />
            </div>

            <div>
              <label htmlFor="prof-roll" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                Roll Number <span className="text-red-500">*</span>
              </label>
              <input
                id="prof-roll"
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="prof-year" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                College Year (1 to 4) <span className="text-red-500">*</span>
              </label>
              <select
                id="prof-year"
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

            <div>
              <label htmlFor="prof-branch" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                Branch <span className="text-red-500">*</span>
              </label>
              <select
                id="prof-branch"
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="prof-phone" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                Add Your Phone Number{' '}
                <span className="text-xs font-normal normal-case text-zinc-400">
                  (Optional here, required for event creation/participation)
                </span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                <input
                  id="prof-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98450 11223"
                  className={`w-full pl-10 pr-3.5 py-2.5 rounded-md border text-sm font-mono tabular-nums focus:outline-none focus:ring-2 ${
                    darkMode
                      ? 'border-white/20 bg-[#050507] text-white focus:ring-[#BFFF00]'
                      : 'border-black/20 bg-zinc-50 text-black focus:ring-[#7A00FF]'
                  }`}
                />
              </div>
            </div>

            <div>
              <label htmlFor="prof-email" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                Student Email Address{' '}
                <span className="text-xs font-normal normal-case text-zinc-400">
                  (Optional here, required for event creation/participation)
                </span>
              </label>
              <input
                id="prof-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-md border text-sm focus:outline-none focus:ring-2 ${
                  darkMode
                    ? 'border-white/20 bg-[#050507] text-white focus:ring-[#BFFF00]'
                    : 'border-black/20 bg-zinc-50 text-black focus:ring-[#7A00FF]'
                }`}
              />
            </div>
          </div>

          {/* Change Password Section */}
          <div
            className={`p-4 rounded-md border space-y-4 ${
              darkMode ? 'border-white/15 bg-[#050507]' : 'border-black/15 bg-zinc-50'
            }`}
          >
            <div>
              <h4 className="text-sm font-bold flex items-center gap-2">
                <Lock className={`w-4 h-4 ${darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}`} />
                <span>Change Password (Optional)</span>
              </h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Leave blank to keep your current password, or enter a new password below to update it.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="prof-new-password" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <input
                  id="prof-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className={`w-full px-3.5 py-2.5 rounded-md border text-sm focus:outline-none focus:ring-2 ${
                    darkMode
                      ? 'border-white/20 bg-[#0C0C10] text-white placeholder-zinc-500 focus:ring-[#BFFF00]'
                      : 'border-black/20 bg-white text-black placeholder-zinc-400 focus:ring-[#7A00FF]'
                  }`}
                />
                {newPassword.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="grid grid-cols-3 gap-1.5">
                      <div
                        className={`h-1.5 rounded-full ${
                          newPwdStrength.score >= 1
                            ? newPwdStrength.level === 'poor'
                              ? 'bg-red-500'
                              : newPwdStrength.level === 'average'
                              ? 'bg-slate-400'
                              : 'bg-emerald-500'
                            : 'bg-zinc-700'
                        }`}
                      />
                      <div
                        className={`h-1.5 rounded-full ${
                          newPwdStrength.score >= 2
                            ? newPwdStrength.level === 'average'
                              ? 'bg-slate-400'
                              : 'bg-emerald-500'
                            : 'bg-zinc-700'
                        }`}
                      />
                      <div
                        className={`h-1.5 rounded-full ${
                          newPwdStrength.score >= 3 ? 'bg-emerald-500' : 'bg-zinc-700'
                        }`}
                      />
                    </div>
                    <div
                      className={`text-xs font-semibold ${
                        newPwdStrength.level === 'poor'
                          ? 'text-red-500'
                          : newPwdStrength.level === 'average'
                          ? 'text-slate-400'
                          : 'text-emerald-500'
                      }`}
                    >
                      Password Strength: {newPwdStrength.label}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="prof-confirm-password" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                  Confirm New Password
                </label>
                <input
                  id="prof-confirm-password"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className={`w-full px-3.5 py-2.5 rounded-md border text-sm focus:outline-none focus:ring-2 ${
                    darkMode
                      ? 'border-white/20 bg-[#0C0C10] text-white placeholder-zinc-500 focus:ring-[#BFFF00]'
                      : 'border-black/20 bg-white text-black placeholder-zinc-400 focus:ring-[#7A00FF]'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Add Your Profile Picture (Optional) with Live Chosen Picture Preview */}
          <div>
            <label htmlFor="prof-avatar-upload" className="block text-xs font-bold uppercase tracking-wider mb-1.5">
              Add Your Profile Picture <span className="text-xs font-normal normal-case text-zinc-400">(Optional)</span>
            </label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <label
                htmlFor="prof-avatar-upload"
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-md border text-xs font-bold uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer ${
                  darkMode
                    ? 'border-white/20 bg-[#050507] hover:border-[#BFFF00] text-white'
                    : 'border-black/20 bg-zinc-100 hover:bg-black hover:text-white text-black'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>{avatarUrl ? 'Change Profile Picture' : 'Upload Profile Picture'}</span>
                <input
                  id="prof-avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {avatarUrl ? (
                <div
                  data-testid="chosen-picture-preview"
                  className={`flex items-center gap-3 p-2.5 rounded-md border ${
                    darkMode ? 'border-white/15 bg-[#050507]' : 'border-black/15 bg-zinc-50'
                  }`}
                >
                  <img
                    src={avatarUrl}
                    alt="Chosen profile preview"
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-md object-cover border border-[#BFFF00] shrink-0"
                  />
                  <div className="text-xs">
                    <div className={`font-semibold ${darkMode ? 'text-[#BFFF00]' : 'text-[#7A00FF]'}`}>
                      Chosen Picture Preview
                    </div>
                    <div className="text-zinc-400 truncate max-w-[180px]">
                      {selectedFileName || 'Profile picture selected'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarUrl('');
                      setSelectedFileName('');
                    }}
                    className="px-2.5 py-1 rounded-sm text-xs font-bold uppercase tracking-wider text-red-500 hover:bg-red-950/40 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <span className="text-xs text-zinc-400">
                  No profile picture chosen yet.
                </span>
              )}
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
            <button
              type="submit"
              disabled={saving}
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer active:scale-[0.98] disabled:opacity-50 ${
                darkMode
                  ? 'bg-[#BFFF00] hover:bg-[#d2ff4d] text-black shadow-lg'
                  : 'bg-black hover:bg-[#7A00FF] text-white shadow-lg'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Changes...' : 'Update Details'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Account Session & Danger Zone (Sign Out & Delete Account) */}
      <div
        className={`p-6 sm:p-8 rounded-md border flex flex-col sm:flex-row sm:items-center justify-between gap-5 ${
          darkMode ? 'border-red-500/30 bg-[#0C0C10]' : 'border-red-300 bg-white'
        }`}
      >
        <div className="space-y-1">
          <h3 className="font-display text-base sm:text-lg uppercase tracking-tight">
            Account Session &amp; Delete Account
          </h3>
          <p className="text-xs text-zinc-400">
            Sign out of your active session or permanently delete your student account from Fest-Register.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onSignOut}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-md border text-xs font-bold uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer ${
              darkMode
                ? 'border-white/25 bg-[#121217] hover:border-[#BFFF00] hover:text-[#BFFF00] text-white'
                : 'border-black/20 bg-zinc-100 hover:bg-black hover:text-white text-black'
            }`}
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>

          <button
            type="button"
            data-testid="profile-delete-account-button"
            onClick={() => {
              setError(null);
              setShowDeleteConfirm(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Account</span>
          </button>
        </div>
      </div>

      {/* Delete Account Confirmation Popup Modal */}
      {showDeleteConfirm && (
        <div
          data-testid="delete-account-confirm-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm account deletion"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-backdrop"
          onClick={() => {
            if (!deletingAccount) setShowDeleteConfirm(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md p-6 rounded-md border shadow-2xl space-y-5 ${
              darkMode ? 'border-red-500/50 bg-[#0C0C10] text-white' : 'border-red-300 bg-white text-black'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-md bg-red-600/20 text-red-500 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-display text-base uppercase tracking-tight text-red-500">
                  Confirm Account Deletion
                </h3>
                <p
                  data-testid="delete-account-confirm-message"
                  className={`text-sm font-medium leading-relaxed ${
                    darkMode ? 'text-zinc-200' : 'text-zinc-800'
                  }`}
                >
                  Do you really want to drop your account, this action cannot be undone?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                data-testid="confirm-delete-account-no"
                disabled={deletingAccount}
                onClick={() => setShowDeleteConfirm(false)}
                className={`px-5 py-2.5 rounded-md border text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-50 ${
                  darkMode
                    ? 'border-white/25 bg-[#121217] hover:border-white text-white'
                    : 'border-black/20 bg-zinc-100 hover:bg-black hover:text-white text-black'
                }`}
              >
                No
              </button>

              <button
                type="button"
                data-testid="confirm-delete-account-yes"
                disabled={deletingAccount}
                onClick={async () => {
                  setDeletingAccount(true);
                  const res = await onDeleteAccount();
                  setDeletingAccount(false);
                  if (!res.ok) {
                    setShowDeleteConfirm(false);
                    setError(res.error || 'Could not delete account.');
                  }
                }}
                className="px-5 py-2.5 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-50"
              >
                {deletingAccount ? 'Deleting...' : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
