export const BRANCH_OPTIONS = [
  'cse',
  'cse-ai&ml',
  'cse-ds',
  'cse-cyber security',
  'IT',
  'ECE',
  'EEE',
  'Mechanical',
  'Aeronautical',
  'Civil',
] as const;

export type BranchType = (typeof BRANCH_OPTIONS)[number];

export const YEAR_OPTIONS = [1, 2, 3, 4] as const;
export type CollegeYear = (typeof YEAR_OPTIONS)[number];

export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const VALIDATION_CONSTANTS = {
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  MAX_ID_LEN: 128,
  MIN_NAME_LEN: 1,
  MAX_NAME_LEN: 80,
  MIN_USERNAME_LEN: 3,
  MAX_USERNAME_LEN: 40,
  MIN_PASSWORD_LEN: 4,
  MAX_PASSWORD_LEN: 128,
  MIN_ROLL_LEN: 1,
  MAX_ROLL_LEN: 40,
  MIN_PHONE_LEN: 7,
  MAX_PHONE_LEN: 20,
  MAX_EMAIL_LEN: 120,
  MIN_TITLE_LEN: 2,
  MAX_TITLE_LEN: 120,
  MIN_TAG_LEN: 2,
  MAX_TAG_LEN: 40,
  MIN_VENUE_LEN: 2,
  MAX_VENUE_LEN: 120,
  MIN_DESC_LEN: 5,
  MAX_DESC_LEN: 4000,
  MAX_NOTIFICATION_LEN: 500,
} as const;

export interface UserProfile {
  id: string;
  username: string;
  name: string;
  rollNumber: string;
  year: number;
  branch: BranchType;
  phone: string;
  email: string;
  avatarUrl: string;
  silentNotifications: boolean;
  createdAt: string;
  updatedAt: string;
}

export type FormFieldCategory = 'text' | 'single_radio' | 'multi_radio';

export interface EventFormField {
  id: string;
  fieldName: string;
  fieldType?: FormFieldCategory;
  options?: string[];
  isRequired: boolean;
}

export interface EventRegistrationItem {
  id: string;
  eventId: string;
  userId: string;
  studentName: string;
  rollNumber: string;
  year: number;
  branch: BranchType;
  phone: string;
  avatarUrl: string;
  email: string;
  answers: Record<string, string>;
  createdAt: string;
}

export interface EventRecord {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorRollNumber: string;
  creatorYear: number;
  creatorBranch: BranchType;
  creatorPhone: string;
  creatorEmail?: string;
  creatorAvatarUrl: string;
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
  formFields: EventFormField[];
  registrations: EventRegistrationItem[];
  isFavourite: boolean;
  isIgnored?: boolean;
  ignoredAt?: string | null;
  isDismissedFromHome?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageRecord {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  imageUrl: string;
  imageName: string;
  createdAt: string;
}

export interface RegistrationEmailRecord {
  id: string;
  eventId: string;
  userId: string;
  toEmail: string;
  subject: string;
  eventTitle: string;
  eventTag: string;
  eventVenue: string;
  eventDescription: string;
  registrationStart: string;
  registrationEnd: string;
  eventStart: string;
  eventEnd: string;
  creatorName: string;
  creatorRollNumber: string;
  creatorBranch: BranchType;
  creatorYear: number;
  creatorPhone: string;
  creatorEmail: string;
  studentName: string;
  studentRollNumber: string;
  studentBranch: BranchType;
  studentYear: number;
  studentPhone: string;
  answers: Record<string, string>;
  bodyText: string;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  senderId: string;
  type:
    | 'event_created'
    | 'event_participated'
    | 'event_cancelled'
    | 'countdown'
    | 'friend_added'
    | 'friend_removed'
    | 'participant_removed'
    | 'friend_message'
    | 'email_sent';
  message: string;
  isRead: boolean;
  createdAt: string;
}

export type EventFilterMode = 'all' | 'trending' | 'new' | 'old' | 'running' | 'outdated';

export type PasswordStrengthLevel = 'poor' | 'average' | 'strong';

export function evaluatePasswordStrength(password: string): {
  level: PasswordStrengthLevel;
  label: 'Poor' | 'Average' | 'Strong';
  score: 1 | 2 | 3;
} {
  const pwd = password || '';
  let points = 0;

  if (pwd.length >= 6) points += 1;
  if (pwd.length >= 10) points += 1;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) points += 1;
  if (/\d/.test(pwd)) points += 1;
  if (/[^a-zA-Z0-9]/.test(pwd)) points += 1;

  if (pwd.length < 6 || points <= 1) {
    return { level: 'poor', label: 'Poor', score: 1 };
  }
  if (points <= 3) {
    return { level: 'average', label: 'Average', score: 2 };
  }
  return { level: 'strong', label: 'Strong', score: 3 };
}

export function validateEntryDetails(input: {
  name: string;
  year: number;
  branch: string;
  rollNumber: string;
}): { valid: boolean; error?: string } {
  const trimmedName = (input.name || '').trim();
  const trimmedRoll = (input.rollNumber || '').trim();

  if (
    trimmedName.length < VALIDATION_CONSTANTS.MIN_NAME_LEN ||
    trimmedName.length > VALIDATION_CONSTANTS.MAX_NAME_LEN
  ) {
    return { valid: false, error: 'Please enter a valid student name (1–80 characters).' };
  }
  if (!YEAR_OPTIONS.includes(Number(input.year) as CollegeYear)) {
    return { valid: false, error: 'College year must be between 1 and 4.' };
  }
  if (!BRANCH_OPTIONS.includes(input.branch as BranchType)) {
    return { valid: false, error: 'Please select a valid college branch.' };
  }
  if (
    trimmedRoll.length < VALIDATION_CONSTANTS.MIN_ROLL_LEN ||
    trimmedRoll.length > VALIDATION_CONSTANTS.MAX_ROLL_LEN
  ) {
    return { valid: false, error: 'Please enter your college roll number (1–40 characters).' };
  }
  return { valid: true };
}

export function validateRegistrationDetails(input: {
  name: string;
  year: number;
  branch: string;
  rollNumber: string;
  username: string;
  password: string;
  confirmPassword: string;
}): { valid: boolean; error?: string } {
  const baseCheck = validateEntryDetails({
    name: input.name,
    year: input.year,
    branch: input.branch,
    rollNumber: input.rollNumber,
  });
  if (!baseCheck.valid) {
    return baseCheck;
  }

  const trimmedUsername = (input.username || '').trim();
  if (
    trimmedUsername.length < VALIDATION_CONSTANTS.MIN_USERNAME_LEN ||
    trimmedUsername.length > VALIDATION_CONSTANTS.MAX_USERNAME_LEN
  ) {
    return { valid: false, error: 'Username must be between 3 and 40 characters.' };
  }

  const pwd = input.password || '';
  if (pwd.length < VALIDATION_CONSTANTS.MIN_PASSWORD_LEN) {
    return { valid: false, error: 'Password must be at least 4 characters long.' };
  }
  if (pwd.length > VALIDATION_CONSTANTS.MAX_PASSWORD_LEN) {
    return { valid: false, error: 'Password cannot exceed 128 characters.' };
  }

  if (pwd !== (input.confirmPassword || '')) {
    return { valid: false, error: 'Confirm password does not match the password entered.' };
  }

  return { valid: true };
}

export function isValidEmail(email: string): boolean {
  const trimmed = (email || '').trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= VALIDATION_CONSTANTS.MAX_EMAIL_LEN &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
  );
}

export function checkUserContactRequirements(
  user: Pick<UserProfile, 'phone' | 'email'>,
  actionLabel: 'create or host an event' | 'participate in an event'
): { valid: boolean; error?: string } {
  const hasPhone = Boolean(user.phone && user.phone.trim().length >= VALIDATION_CONSTANTS.MIN_PHONE_LEN);
  const hasEmail = isValidEmail(user.email || '');

  if (!hasPhone && !hasEmail) {
    return {
      valid: false,
      error: `To ${actionLabel}, you must first add your phone number and email address in your Profile.`,
    };
  }
  if (!hasPhone) {
    return {
      valid: false,
      error: `To ${actionLabel}, you must first add your phone number in your Profile.`,
    };
  }
  if (!hasEmail) {
    return {
      valid: false,
      error: `To ${actionLabel}, you must first add your email address in your Profile.`,
    };
  }
  return { valid: true };
}

export function computeProfileCompletion(profile: {
  name: string;
  username: string;
  rollNumber: string;
  year: number;
  branch: string;
  phone: string;
  email: string;
  avatarUrl: string;
}): {
  percentage: number;
  completedCount: number;
  totalCount: number;
  missingFields: string[];
} {
  const checks: { label: string; done: boolean }[] = [
    { label: 'Student Name', done: Boolean(profile.name && profile.name.trim().length > 0) },
    { label: 'Username', done: Boolean(profile.username && profile.username.trim().length >= 3) },
    { label: 'Roll Number', done: Boolean(profile.rollNumber && profile.rollNumber.trim().length > 0) },
    { label: 'College Year', done: YEAR_OPTIONS.includes(Number(profile.year) as CollegeYear) },
    { label: 'Branch', done: BRANCH_OPTIONS.includes(profile.branch as BranchType) },
    {
      label: 'Phone Number',
      done: Boolean(profile.phone && profile.phone.trim().length >= VALIDATION_CONSTANTS.MIN_PHONE_LEN),
    },
    { label: 'Email Address', done: isValidEmail(profile.email || '') },
    { label: 'Profile Picture', done: Boolean(profile.avatarUrl && profile.avatarUrl.trim().length > 0) },
  ];

  const completedCount = checks.filter((c) => c.done).length;
  const totalCount = checks.length;
  const percentage = Math.round((completedCount / totalCount) * 100);
  const missingFields = checks.filter((c) => !c.done).map((c) => c.label);

  return {
    percentage,
    completedCount,
    totalCount,
    missingFields,
  };
}

export function validateEventDates(dates: {
  registrationStart: string;
  registrationEnd: string;
  eventStart: string;
  eventEnd: string;
}): { valid: boolean; error?: string } {
  const regStartMs = Date.parse(dates.registrationStart);
  const regEndMs = Date.parse(dates.registrationEnd);
  const evtStartMs = Date.parse(dates.eventStart);
  const evtEndMs = Date.parse(dates.eventEnd);

  if ([regStartMs, regEndMs, evtStartMs, evtEndMs].some((ms) => Number.isNaN(ms))) {
    return { valid: false, error: 'All registration and event start/end dates must be valid timestamps.' };
  }

  if (regEndMs <= regStartMs) {
    return { valid: false, error: 'Registration end time must be after registration start time.' };
  }

  if (evtStartMs <= regEndMs) {
    return {
      valid: false,
      error:
        'Event start date/time must be strictly after registration end date/time (cannot be before or overlapping with registration).',
    };
  }

  if (evtEndMs <= evtStartMs) {
    return { valid: false, error: 'Event end time must be after event start time.' };
  }

  return { valid: true };
}

export function computeEventRuntimeStatus(
  event: Pick<EventRecord, 'registrationStart' | 'registrationEnd' | 'eventStart' | 'eventEnd'>,
  nowMs: number = Date.now()
): {
  status: 'running' | 'outdated';
  isExpired: boolean;
  countdownLabel: string | null;
} {
  const evtEndMs = Date.parse(event.eventEnd);
  const evtStartMs = Date.parse(event.eventStart);
  const regEndMs = Date.parse(event.registrationEnd);

  const isExpired = nowMs > evtEndMs || nowMs > regEndMs;
  const status: 'running' | 'outdated' = nowMs > evtEndMs ? 'outdated' : 'running';

  let countdownLabel: string | null = null;
  if (nowMs < evtStartMs) {
    const diffHours = (evtStartMs - nowMs) / (1000 * 60 * 60);
    if (diffHours <= 1.5) {
      countdownLabel = '1 hr to go';
    } else if (diffHours <= 28) {
      countdownLabel = '1 day to go';
    } else if (diffHours <= 54) {
      countdownLabel = '2 days to go';
    }
  }

  return {
    status,
    isExpired,
    countdownLabel,
  };
}

export function shouldAutoDeleteIgnoredEvent(
  event: Pick<EventRecord, 'registrationStart' | 'registrationEnd' | 'eventStart' | 'eventEnd'>,
  ignoredAtIso: string,
  nowMs: number = Date.now()
): {
  shouldDelete: boolean;
  reason?: 'expired' | 'older_than_7_days';
  daysRemaining: number;
} {
  const { status, isExpired } = computeEventRuntimeStatus(event, nowMs);
  if (status === 'outdated' || isExpired) {
    return {
      shouldDelete: true,
      reason: 'expired',
      daysRemaining: 0,
    };
  }

  const ignoredAtMs = Date.parse(ignoredAtIso);
  if (Number.isNaN(ignoredAtMs)) {
    return {
      shouldDelete: false,
      daysRemaining: 7,
    };
  }

  const elapsedMs = nowMs - ignoredAtMs;
  if (elapsedMs > SEVEN_DAYS_MS) {
    return {
      shouldDelete: true,
      reason: 'older_than_7_days',
      daysRemaining: 0,
    };
  }

  const daysRemaining = Math.max(
    1,
    Math.ceil((SEVEN_DAYS_MS - elapsedMs) / (24 * 60 * 60 * 1000))
  );

  return {
    shouldDelete: false,
    daysRemaining,
  };
}

export function isEventVisibleToUser(
  event: Pick<EventRecord, 'creatorId' | 'friendsOnly' | 'allowedUserIds'>,
  currentUserId: string,
  creatorFriendIds: string[]
): boolean {
  if (event.creatorId === currentUserId) {
    return true;
  }

  const hasSpecificAllowlist = Array.isArray(event.allowedUserIds) && event.allowedUserIds.length > 0;
  const isFriendOfCreator = creatorFriendIds.includes(currentUserId);

  if (hasSpecificAllowlist && event.friendsOnly) {
    return event.allowedUserIds.includes(currentUserId) && isFriendOfCreator;
  }
  if (hasSpecificAllowlist) {
    return event.allowedUserIds.includes(currentUserId);
  }
  if (event.friendsOnly) {
    return isFriendOfCreator;
  }
  return true;
}

export function filterAndSortEvents(
  events: EventRecord[],
  options: {
    search: string;
    filterMode: EventFilterMode;
    currentUserId: string;
    friendIdsByCreator: Record<string, string[]>;
    nowMs?: number;
  }
): EventRecord[] {
  const nowMs = options.nowMs ?? Date.now();
  const query = (options.search || '').trim().toLowerCase();

  const visible = events.filter((evt) => {
    // Exclude events ignored/deleted from the Home screen
    if (evt.isIgnored || evt.isDismissedFromHome) {
      return false;
    }

    const creatorFriends = options.friendIdsByCreator[evt.creatorId] || [];
    if (!isEventVisibleToUser(evt, options.currentUserId, creatorFriends)) {
      return false;
    }

    if (query) {
      const hay = `${evt.title} ${evt.tag} ${evt.venue} ${evt.description} ${evt.creatorName}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }

    const { status } = computeEventRuntimeStatus(evt, nowMs);
    if (options.filterMode === 'running' && status !== 'running') return false;
    if (options.filterMode === 'outdated' && status !== 'outdated') return false;

    return true;
  });

  const sorted = [...visible];
  switch (options.filterMode) {
    case 'trending':
      sorted.sort((a, b) => {
        const statA = computeEventRuntimeStatus(a, nowMs).status === 'running' ? 1 : 0;
        const statB = computeEventRuntimeStatus(b, nowMs).status === 'running' ? 1 : 0;
        if (b.registrations.length !== a.registrations.length) {
          return b.registrations.length - a.registrations.length;
        }
        return statB - statA;
      });
      break;
    case 'new':
      sorted.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      break;
    case 'old':
      sorted.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
      break;
    case 'running':
      sorted.sort((a, b) => Date.parse(a.eventStart) - Date.parse(b.eventStart));
      break;
    case 'outdated':
      sorted.sort((a, b) => Date.parse(b.eventEnd) - Date.parse(a.eventEnd));
      break;
    default:
      sorted.sort((a, b) => {
        const statA = computeEventRuntimeStatus(a, nowMs).status === 'running' ? 1 : 0;
        const statB = computeEventRuntimeStatus(b, nowMs).status === 'running' ? 1 : 0;
        if (statB !== statA) return statB - statA;
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      });
      break;
  }

  return sorted;
}

export function filterUsersForFriends(
  users: UserProfile[],
  criteria: {
    search: string;
    searchBy: 'all' | 'name' | 'rollNumber' | 'branch' | 'year';
    branchFilter: string;
    yearFilter: string;
    currentUserId: string;
  }
): UserProfile[] {
  const q = (criteria.search || '').trim().toLowerCase();

  return users.filter((u) => {
    if (u.id === criteria.currentUserId) return false;

    if (criteria.branchFilter && criteria.branchFilter !== 'all' && u.branch !== criteria.branchFilter) {
      return false;
    }

    if (criteria.yearFilter && criteria.yearFilter !== 'all' && String(u.year) !== String(criteria.yearFilter)) {
      return false;
    }

    if (!q) return true;

    switch (criteria.searchBy) {
      case 'name':
        return u.name.toLowerCase().includes(q);
      case 'rollNumber':
        return u.rollNumber.toLowerCase().includes(q);
      case 'branch':
        return u.branch.toLowerCase().includes(q);
      case 'year':
        return String(u.year).includes(q);
      default:
        return (
          u.name.toLowerCase().includes(q) ||
          u.rollNumber.toLowerCase().includes(q) ||
          u.branch.toLowerCase().includes(q) ||
          String(u.year).includes(q)
        );
    }
  });
}

export function getParticipatedEvents(events: EventRecord[], userId: string): EventRecord[] {
  if (!userId) return [];
  return events.filter((e) => e.registrations.some((r) => r.userId === userId));
}

export function buildRegistrationConfirmationEmail(input: {
  id: string;
  eventId: string;
  userId: string;
  toEmail: string;
  eventTitle: string;
  eventTag: string;
  eventVenue: string;
  eventDescription: string;
  registrationStart: string;
  registrationEnd: string;
  eventStart: string;
  eventEnd: string;
  creatorName: string;
  creatorRollNumber: string;
  creatorBranch: BranchType;
  creatorYear: number;
  creatorPhone: string;
  creatorEmail: string;
  studentName: string;
  studentRollNumber: string;
  studentBranch: BranchType;
  studentYear: number;
  studentPhone: string;
  answers: Record<string, string>;
  createdAt: string;
}): RegistrationEmailRecord {
  const subject = `Registration Confirmation: ${input.eventTitle} [${input.eventTag}]`;
  const answerEntries = Object.entries(input.answers || {});
  const formattedAnswers =
    answerEntries.length > 0
      ? answerEntries.map(([k, v]) => `  • ${k}: ${v || 'N/A'}`).join('\n')
      : '  • Standard Registration (No additional custom form fields)';

  const bodyText = [
    `Hello ${input.studentName},`,
    ``,
    `Your registration for "${input.eventTitle}" (${input.eventTag}) has been confirmed!`,
    ``,
    `=== EVENT DETAILS & DESCRIPTION ===`,
    `Event Title: ${input.eventTitle}`,
    `Category / Tag: ${input.eventTag}`,
    `Venue: ${input.eventVenue}`,
    `Registration Window: ${new Date(input.registrationStart).toLocaleString('en-US')} – ${new Date(
      input.registrationEnd
    ).toLocaleString('en-US')}`,
    `Event Schedule: ${new Date(input.eventStart).toLocaleString('en-US')} – ${new Date(
      input.eventEnd
    ).toLocaleString('en-US')}`,
    `Description:`,
    `${input.eventDescription}`,
    ``,
    `=== EVENT CREATOR / ORGANIZER DETAILS ===`,
    `Organizer Name: ${input.creatorName}`,
    `Roll Number: ${input.creatorRollNumber}`,
    `Branch & Year: ${input.creatorBranch} · Year ${input.creatorYear}`,
    `Contact Phone: ${input.creatorPhone || 'Verified on portal'}`,
    `Organizer Email: ${input.creatorEmail || 'Verified on portal'}`,
    ``,
    `=== YOUR REGISTRATION & SUBMITTED DETAILS ===`,
    `Participant Name: ${input.studentName}`,
    `Roll Number: ${input.studentRollNumber}`,
    `Branch & Year: ${input.studentBranch} · Year ${input.studentYear}`,
    `Registered Email: ${input.toEmail}`,
    `Contact Phone: ${input.studentPhone || 'Provided in profile'}`,
    `Submitted Form Responses:`,
    formattedAnswers,
    ``,
    `Thank you for registering via Fest-Register Campus Technical Portal.`,
  ].join('\n');

  return {
    ...input,
    subject,
    bodyText,
  };
}

