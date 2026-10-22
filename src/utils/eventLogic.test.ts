import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEntryDetails,
  validateEventDates,
  computeEventRuntimeStatus,
  computeProfileCompletion,
  shouldAutoDeleteIgnoredEvent,
  isEventVisibleToUser,
  filterAndSortEvents,
  filterUsersForFriends,
  getParticipatedEvents,
  buildRegistrationConfirmationEmail,
  EventRecord,
  UserProfile,
} from './eventLogic';

test('validateEntryDetails validates name, year (1-4), branch, and roll number', () => {
  assert.equal(
    validateEntryDetails({
      name: 'Aarav Sharma',
      year: 3,
      branch: 'cse-ai&ml',
      rollNumber: '22CS301',
    }).valid,
    true
  );

  assert.equal(
    validateEntryDetails({
      name: '',
      year: 3,
      branch: 'cse',
      rollNumber: '22CS301',
    }).valid,
    false
  );

  assert.equal(
    validateEntryDetails({
      name: 'Aarav',
      year: 5,
      branch: 'cse',
      rollNumber: '22CS301',
    }).valid,
    false
  );

  assert.equal(
    validateEntryDetails({
      name: 'Aarav',
      year: 2,
      branch: 'Biotech',
      rollNumber: '22CS301',
    }).valid,
    false
  );
});

test('validateEventDates rejects event dates that are before or overlapping with registration dates', () => {
  const validResult = validateEventDates({
    registrationStart: '2026-10-22T09:00:00.000Z',
    registrationEnd: '2026-10-23T18:00:00.000Z',
    eventStart: '2026-10-24T10:00:00.000Z',
    eventEnd: '2026-10-24T17:00:00.000Z',
  });
  assert.equal(validResult.valid, true);

  const overlappingResult = validateEventDates({
    registrationStart: '2026-10-22T09:00:00.000Z',
    registrationEnd: '2026-10-24T12:00:00.000Z',
    eventStart: '2026-10-24T10:00:00.000Z',
    eventEnd: '2026-10-24T17:00:00.000Z',
  });
  assert.equal(overlappingResult.valid, false);

  const beforeResult = validateEventDates({
    registrationStart: '2026-10-25T09:00:00.000Z',
    registrationEnd: '2026-10-26T12:00:00.000Z',
    eventStart: '2026-10-23T10:00:00.000Z',
    eventEnd: '2026-10-23T17:00:00.000Z',
  });
  assert.equal(beforeResult.valid, false);
});

test('computeEventRuntimeStatus calculates running/outdated and countdown labels accurately', () => {
  const now = Date.parse('2026-10-21T12:00:00.000Z');

  const oneHourEvent = computeEventRuntimeStatus(
    {
      registrationStart: '2026-10-19T12:00:00.000Z',
      registrationEnd: '2026-10-21T12:30:00.000Z',
      eventStart: '2026-10-21T12:55:00.000Z',
      eventEnd: '2026-10-21T16:00:00.000Z',
    },
    now
  );
  assert.equal(oneHourEvent.status, 'running');
  assert.equal(oneHourEvent.countdownLabel, '1 hr to go');

  const outdatedEvent = computeEventRuntimeStatus(
    {
      registrationStart: '2026-10-10T12:00:00.000Z',
      registrationEnd: '2026-10-12T12:00:00.000Z',
      eventStart: '2026-10-14T10:00:00.000Z',
      eventEnd: '2026-10-14T18:00:00.000Z',
    },
    now
  );
  assert.equal(outdatedEvent.status, 'outdated');
  assert.equal(outdatedEvent.isExpired, true);
});

test('shouldAutoDeleteIgnoredEvent auto-deletes expired events and events ignored for more than 7 days', () => {
  const now = Date.parse('2026-10-21T12:00:00.000Z');
  const activeEvent = {
    registrationStart: '2026-10-18T00:00:00.000Z',
    registrationEnd: '2026-10-25T00:00:00.000Z',
    eventStart: '2026-10-26T00:00:00.000Z',
    eventEnd: '2026-10-27T00:00:00.000Z',
  };

  // Ignored 2 days ago -> retained with 5 days remaining
  const recentIgnore = shouldAutoDeleteIgnoredEvent(activeEvent, '2026-10-19T12:00:00.000Z', now);
  assert.equal(recentIgnore.shouldDelete, false);
  assert.equal(recentIgnore.daysRemaining, 5);

  // Ignored 8 days ago -> auto-deleted (>7 days)
  const oldIgnore = shouldAutoDeleteIgnoredEvent(activeEvent, '2026-10-13T10:00:00.000Z', now);
  assert.equal(oldIgnore.shouldDelete, true);
  assert.equal(oldIgnore.reason, 'older_than_7_days');

  // Expired event ignored 1 hour ago -> auto-deleted ('expired')
  const expiredEvent = {
    registrationStart: '2026-10-01T00:00:00.000Z',
    registrationEnd: '2026-10-05T00:00:00.000Z',
    eventStart: '2026-10-06T00:00:00.000Z',
    eventEnd: '2026-10-07T00:00:00.000Z',
  };
  const expiredIgnore = shouldAutoDeleteIgnoredEvent(expiredEvent, '2026-10-21T11:00:00.000Z', now);
  assert.equal(expiredIgnore.shouldDelete, true);
  assert.equal(expiredIgnore.reason, 'expired');
});

test('isEventVisibleToUser enforces friends-only and specific allowed users visibility', () => {
  const publicEvent = { creatorId: 'u1', friendsOnly: false, allowedUserIds: [] };
  assert.equal(isEventVisibleToUser(publicEvent, 'u3', ['u2']), true);

  const friendsOnlyEvent = { creatorId: 'u1', friendsOnly: true, allowedUserIds: [] };
  assert.equal(isEventVisibleToUser(friendsOnlyEvent, 'u2', ['u2']), true);
  assert.equal(isEventVisibleToUser(friendsOnlyEvent, 'u3', ['u2']), false);

  const allowlistEvent = { creatorId: 'u1', friendsOnly: false, allowedUserIds: ['u4'] };
  assert.equal(isEventVisibleToUser(allowlistEvent, 'u4', ['u2']), true);
  assert.equal(isEventVisibleToUser(allowlistEvent, 'u2', ['u2']), false);
  assert.equal(isEventVisibleToUser(allowlistEvent, 'u1', []), true);
});

test('filterAndSortEvents sorts by trending, new, old, running, outdated and excludes ignored events', () => {
  const now = Date.parse('2026-10-21T12:00:00.000Z');
  const sampleEvents: EventRecord[] = [
    {
      id: 'e1',
      creatorId: 'u1',
      creatorName: 'Aarav',
      creatorRollNumber: '22CS101',
      creatorYear: 3,
      creatorBranch: 'cse',
      creatorPhone: '9876543210',
      creatorAvatarUrl: '',
      title: 'Alpha Robotics Jam',
      tag: 'Robotics',
      venue: 'Main Auditorium',
      description: 'Autonomous rover build challenge',
      registrationStart: '2026-10-18T00:00:00.000Z',
      registrationEnd: '2026-10-22T00:00:00.000Z',
      eventStart: '2026-10-23T00:00:00.000Z',
      eventEnd: '2026-10-24T00:00:00.000Z',
      friendsOnly: false,
      allowedUserIds: [],
      formFields: [],
      registrations: [{} as any, {} as any],
      isFavourite: false,
      isIgnored: false,
      createdAt: '2026-10-18T10:00:00.000Z',
      updatedAt: '2026-10-18T10:00:00.000Z',
    },
    {
      id: 'e2',
      creatorId: 'u1',
      creatorName: 'Aarav',
      creatorRollNumber: '22CS101',
      creatorYear: 3,
      creatorBranch: 'cse',
      creatorPhone: '9876543210',
      creatorAvatarUrl: '',
      title: 'Legacy Cloud Summit',
      tag: 'Cloud',
      venue: 'Seminar Hall 2',
      description: 'Past workshop on distributed systems',
      registrationStart: '2026-10-01T00:00:00.000Z',
      registrationEnd: '2026-10-05T00:00:00.000Z',
      eventStart: '2026-10-06T00:00:00.000Z',
      eventEnd: '2026-10-07T00:00:00.000Z',
      friendsOnly: false,
      allowedUserIds: [],
      formFields: [],
      registrations: [],
      isFavourite: false,
      isIgnored: false,
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
    },
    {
      id: 'e3',
      creatorId: 'u1',
      creatorName: 'Aarav',
      creatorRollNumber: '22CS101',
      creatorYear: 3,
      creatorBranch: 'cse',
      creatorPhone: '9876543210',
      creatorAvatarUrl: '',
      title: 'Ignored Event Demo',
      tag: 'AI',
      venue: 'Hall 4',
      description: 'Ignored by user',
      registrationStart: '2026-10-18T00:00:00.000Z',
      registrationEnd: '2026-10-22T00:00:00.000Z',
      eventStart: '2026-10-23T00:00:00.000Z',
      eventEnd: '2026-10-24T00:00:00.000Z',
      friendsOnly: false,
      allowedUserIds: [],
      formFields: [],
      registrations: [],
      isFavourite: false,
      isIgnored: true,
      createdAt: '2026-10-19T10:00:00.000Z',
      updatedAt: '2026-10-19T10:00:00.000Z',
    },
  ];

  const runningOnly = filterAndSortEvents(sampleEvents, {
    search: '',
    filterMode: 'running',
    currentUserId: 'u2',
    friendIdsByCreator: {},
    nowMs: now,
  });
  assert.equal(runningOnly.length, 1);
  assert.equal(runningOnly[0].id, 'e1');

  const outdatedOnly = filterAndSortEvents(sampleEvents, {
    search: '',
    filterMode: 'outdated',
    currentUserId: 'u2',
    friendIdsByCreator: {},
    nowMs: now,
  });
  assert.equal(outdatedOnly.length, 1);
  assert.equal(outdatedOnly[0].id, 'e2');
});

test('filterUsersForFriends filters by name, rollNumber, branch, and year', () => {
  const users: UserProfile[] = [
    {
      id: 'u1',
      name: 'Aarav Sharma',
      username: 'aarav_s',
      rollNumber: '22AIML101',
      year: 3,
      branch: 'cse-ai&ml',
      phone: '9876543210',
      email: 'aarav@college.edu',
      avatarUrl: '',
      silentNotifications: false,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'u2',
      name: 'Rohan Verma',
      username: 'rohan_v',
      rollNumber: '23ECE204',
      year: 2,
      branch: 'ECE',
      phone: '9876543211',
      email: 'rohan@college.edu',
      avatarUrl: '',
      silentNotifications: false,
      createdAt: '',
      updatedAt: '',
    },
  ];

  const byBranch = filterUsersForFriends(users, {
    search: '',
    searchBy: 'all',
    branchFilter: 'ECE',
    yearFilter: 'all',
    currentUserId: 'u1',
  });
  assert.equal(byBranch.length, 1);
  assert.equal(byBranch[0].name, 'Rohan Verma');
});

test('computeProfileCompletion calculates completion percentage accurately', () => {
  const partialProfile = computeProfileCompletion({
    name: 'Aarav Sharma',
    username: 'aarav_s',
    rollNumber: '22AIML101',
    year: 3,
    branch: 'cse-ai&ml',
    phone: '',
    email: '',
    avatarUrl: '',
  });
  assert.equal(partialProfile.completedCount, 5);
  assert.equal(partialProfile.totalCount, 8);
  assert.equal(partialProfile.percentage, 63);
  assert.deepEqual(partialProfile.missingFields, ['Phone Number', 'Email Address', 'Profile Picture']);

  const fullProfile = computeProfileCompletion({
    name: 'Aarav Sharma',
    username: 'aarav_s',
    rollNumber: '22AIML101',
    year: 3,
    branch: 'cse-ai&ml',
    phone: '9876543210',
    email: 'aarav@college.edu',
    avatarUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ',
  });
  assert.equal(fullProfile.completedCount, 8);
  assert.equal(fullProfile.totalCount, 8);
  assert.equal(fullProfile.percentage, 100);
  assert.equal(fullProfile.missingFields.length, 0);
});

test('getParticipatedEvents includes events where user is an auto-participated event creator as well as joined events', () => {
  const sampleEvents: EventRecord[] = [
    {
      id: 'evt-created-by-u1',
      creatorId: 'u1',
      creatorName: 'Aarav Sharma',
      creatorRollNumber: '22AIML101',
      creatorYear: 3,
      creatorBranch: 'cse-ai&ml',
      creatorPhone: '9876543210',
      creatorEmail: 'aarav@college.edu',
      creatorAvatarUrl: '',
      title: 'Aarav Created & Auto-Participated Event',
      tag: 'AI & ML',
      venue: 'Main Auditorium',
      description: 'Neural Architecture Search Workshop',
      registrationStart: '2026-10-18T00:00:00.000Z',
      registrationEnd: '2026-10-22T00:00:00.000Z',
      eventStart: '2026-10-23T00:00:00.000Z',
      eventEnd: '2026-10-24T00:00:00.000Z',
      friendsOnly: false,
      allowedUserIds: [],
      formFields: [],
      registrations: [
        {
          id: 'reg-creator',
          eventId: 'evt-created-by-u1',
          userId: 'u1',
          userName: 'Aarav Sharma',
          userRollNumber: '22AIML101',
          userYear: 3,
          userBranch: 'cse-ai&ml',
          userPhone: '9876543210',
          userEmail: 'aarav@college.edu',
          answers: {},
          registeredAt: '2026-10-18T10:00:00.000Z',
        },
      ],
      isFavourite: false,
      isIgnored: false,
      createdAt: '2026-10-18T10:00:00.000Z',
      updatedAt: '2026-10-18T10:00:00.000Z',
    },
    {
      id: 'evt-created-by-u2',
      creatorId: 'u2',
      creatorName: 'Diya Nair',
      creatorRollNumber: '22CSE204',
      creatorYear: 3,
      creatorBranch: 'cse',
      creatorPhone: '9876543211',
      creatorEmail: 'diya@college.edu',
      creatorAvatarUrl: '',
      title: 'Diya Event Joined by Aarav',
      tag: 'Systems',
      venue: 'Seminar Hall 2',
      description: 'Systems Engineering Hackathon',
      registrationStart: '2026-10-18T00:00:00.000Z',
      registrationEnd: '2026-10-22T00:00:00.000Z',
      eventStart: '2026-10-23T00:00:00.000Z',
      eventEnd: '2026-10-24T00:00:00.000Z',
      friendsOnly: false,
      allowedUserIds: [],
      formFields: [],
      registrations: [
        {
          id: 'reg-u1',
          eventId: 'evt-created-by-u2',
          userId: 'u1',
          userName: 'Aarav Sharma',
          userRollNumber: '22AIML101',
          userYear: 3,
          userBranch: 'cse-ai&ml',
          userPhone: '9876543210',
          userEmail: 'aarav@college.edu',
          answers: {},
          registeredAt: '2026-10-19T10:00:00.000Z',
        },
      ],
      isFavourite: false,
      isIgnored: false,
      createdAt: '2026-10-18T10:00:00.000Z',
      updatedAt: '2026-10-18T10:00:00.000Z',
    },
  ];

  const participated = getParticipatedEvents(sampleEvents, 'u1');
  assert.equal(participated.length, 2);
  assert.equal(participated.some((e) => e.id === 'evt-created-by-u1'), true);
  assert.equal(participated.some((e) => e.id === 'evt-created-by-u2'), true);
});

test('buildRegistrationConfirmationEmail includes event description, creator details, and submitted registration details', () => {
  const email = buildRegistrationConfirmationEmail({
    id: 'email-1',
    eventId: 'evt-1',
    userId: 'u2',
    toEmail: 'rohan.verma@festcampus.edu',
    eventTitle: 'Neural Architecture Search & LLM Systems Symposium',
    eventTag: 'AI & Deep Learning',
    eventVenue: 'Main Turing Auditorium, Block A',
    eventDescription: 'Deep-dive technical symposium covering speculative decoding and GPU kernel optimization.',
    registrationStart: '2026-10-20T09:00:00.000Z',
    registrationEnd: '2026-10-26T18:00:00.000Z',
    eventStart: '2026-10-28T10:00:00.000Z',
    eventEnd: '2026-10-29T17:00:00.000Z',
    creatorName: 'Aarav Sharma',
    creatorRollNumber: '22AIML101',
    creatorBranch: 'cse-ai&ml',
    creatorYear: 3,
    creatorPhone: '9845012345',
    creatorEmail: 'aarav.sharma@festcampus.edu',
    studentName: 'Rohan Verma',
    studentRollNumber: '23ECE309',
    studentBranch: 'ECE',
    studentYear: 2,
    studentPhone: '9845054321',
    answers: {
      'Preferred Compute Track': 'CUDA & Triton Kernels',
      'GitHub Profile': 'https://github.com/rohanverma-ece',
    },
    createdAt: '2026-10-22T10:00:00.000Z',
  });

  assert.equal(
    email.subject,
    'Registration Confirmation: Neural Architecture Search & LLM Systems Symposium [AI & Deep Learning]'
  );
  assert.equal(email.bodyText.includes('Deep-dive technical symposium covering speculative decoding'), true);
  assert.equal(email.bodyText.includes('Aarav Sharma'), true);
  assert.equal(email.bodyText.includes('aarav.sharma@festcampus.edu'), true);
  assert.equal(email.bodyText.includes('Rohan Verma'), true);
  assert.equal(email.bodyText.includes('Preferred Compute Track: CUDA & Triton Kernels'), true);
  assert.equal(email.bodyText.includes('GitHub Profile: https://github.com/rohanverma-ece'), true);
});

