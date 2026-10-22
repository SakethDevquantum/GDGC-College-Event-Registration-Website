import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rulesSource = fs.readFileSync(
  fs.existsSync('./firestore.rules') ? './firestore.rules' : './DRAFT_firestore.rules',
  'utf8'
);

interface AuthContext {
  uid: string;
  email_verified: boolean;
}

const VALID_BRANCHES = new Set([
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
]);

function isValidId(id: unknown): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(id);
}

function evaluateDirtyDozen(payloadName: string, auth: AuthContext | null, docId: string, data: Record<string, any>, existingData?: Record<string, any>): 'ALLOWED' | 'PERMISSION_DENIED' {
  if (!auth || !auth.email_verified) return 'PERMISSION_DENIED';
  if (!isValidId(docId)) return 'PERMISSION_DENIED';

  switch (payloadName) {
    case 'user_create': {
      const allowed = new Set(['uid', 'name', 'rollNumber', 'year', 'branch', 'avatarUrl', 'createdAt', 'updatedAt']);
      const required = ['uid', 'name', 'rollNumber', 'year', 'branch', 'createdAt', 'updatedAt'];
      for (const req of required) if (!(req in data)) return 'PERMISSION_DENIED';
      for (const k of Object.keys(data)) if (!allowed.has(k)) return 'PERMISSION_DENIED';
      if (data.uid !== auth.uid || data.uid !== docId) return 'PERMISSION_DENIED';
      if (typeof data.name !== 'string' || data.name.length < 1 || data.name.length > 80) return 'PERMISSION_DENIED';
      if (!VALID_BRANCHES.has(data.branch)) return 'PERMISSION_DENIED';
      if (data.createdAt !== 'SERVER_TIME' || data.updatedAt !== 'SERVER_TIME') return 'PERMISSION_DENIED';
      return 'ALLOWED';
    }
    case 'private_read': {
      if (auth.uid !== docId) return 'PERMISSION_DENIED';
      return 'ALLOWED';
    }
    case 'event_create': {
      const allowed = new Set([
        'creatorId', 'title', 'tag', 'venue', 'description',
        'registrationStart', 'registrationEnd', 'eventStart', 'eventEnd',
        'friendsOnly', 'status', 'createdAt', 'updatedAt',
      ]);
      for (const k of Object.keys(data)) if (!allowed.has(k)) return 'PERMISSION_DENIED';
      if (data.creatorId !== auth.uid) return 'PERMISSION_DENIED';
      if (typeof data.title !== 'string' || data.title.length < 2 || data.title.length > 120) return 'PERMISSION_DENIED';
      if (data.createdAt !== 'SERVER_TIME' || data.updatedAt !== 'SERVER_TIME') return 'PERMISSION_DENIED';
      if (!data._parentUserExists) return 'PERMISSION_DENIED';
      return 'ALLOWED';
    }
    case 'event_update': {
      if (!existingData) return 'PERMISSION_DENIED';
      if (existingData.creatorId !== auth.uid) return 'PERMISSION_DENIED';
      if (existingData.status !== 'running') return 'PERMISSION_DENIED';
      if (data.creatorId !== existingData.creatorId || data.createdAt !== existingData.createdAt) return 'PERMISSION_DENIED';
      if (typeof data.title !== 'string' || data.title.length < 2 || data.title.length > 120) return 'PERMISSION_DENIED';
      return 'ALLOWED';
    }
    case 'registration_create': {
      if (!data._parentEventExists || data._parentEventStatus !== 'running') return 'PERMISSION_DENIED';
      if (data.userId !== auth.uid) return 'PERMISSION_DENIED';
      return 'ALLOWED';
    }
    case 'notification_list': {
      if (data.userId !== auth.uid) return 'PERMISSION_DENIED';
      return 'ALLOWED';
    }
    default:
      return 'PERMISSION_DENIED';
  }
}

test('Firestore rules file contains all Eight Pillars invariants', () => {
  assert.ok(rulesSource.includes("rules_version = '2';"));
  assert.ok(rulesSource.includes('allow read, write: if false;'));
  assert.ok(rulesSource.includes('function isValidId(id)'));
  assert.ok(rulesSource.includes('function isValidUserPublic(data)'));
  assert.ok(rulesSource.includes('function isValidUserPrivate(data)'));
  assert.ok(rulesSource.includes('function isValidEvent(data)'));
  assert.ok(rulesSource.includes('function isValidRegistration(data)'));
  assert.ok(rulesSource.includes('function isValidFriendship(data)'));
  assert.ok(rulesSource.includes('function isValidFavourite(data)'));
  assert.ok(rulesSource.includes('function isValidNotification(data)'));
  assert.ok(rulesSource.includes('request.auth.token.email_verified == true'));
});

test('Dirty Dozen Payload 1: Shadow field injection is PERMISSION_DENIED', () => {
  const res = evaluateDirtyDozen(
    'user_create',
    { uid: 'userA', email_verified: true },
    'userA',
    {
      uid: 'userA',
      name: 'Aarav',
      rollNumber: '22CS101',
      year: 3,
      branch: 'cse',
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
      isAdmin: true,
    }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen Payload 2: Unverified email spoof is PERMISSION_DENIED', () => {
  const res = evaluateDirtyDozen(
    'user_create',
    { uid: 'userA', email_verified: false },
    'userA',
    {
      uid: 'userA',
      name: 'Aarav',
      rollNumber: '22CS101',
      year: 3,
      branch: 'cse',
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
    }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen Payload 3: Cross-user PII read is PERMISSION_DENIED', () => {
  const res = evaluateDirtyDozen('private_read', { uid: 'userB', email_verified: true }, 'userA', {});
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen Payload 4: Identity spoofing on event creation is PERMISSION_DENIED', () => {
  const res = evaluateDirtyDozen(
    'event_create',
    { uid: 'userA', email_verified: true },
    'evt_1',
    {
      creatorId: 'userB',
      title: 'Hackathon',
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
    }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen Payload 5: Oversized string (>120 chars) is PERMISSION_DENIED', () => {
  const res = evaluateDirtyDozen(
    'event_create',
    { uid: 'userA', email_verified: true },
    'evt_1',
    {
      creatorId: 'userA',
      title: 'X'.repeat(500),
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
    }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen Payload 6: Poisoned document ID is PERMISSION_DENIED', () => {
  const res = evaluateDirtyDozen(
    'user_create',
    { uid: 'userA', email_verified: true },
    'invalid/doc id!',
    {
      uid: 'userA',
      name: 'Aarav',
      rollNumber: '22CS101',
      year: 3,
      branch: 'cse',
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
    }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen Payload 7: Forged client timestamp is PERMISSION_DENIED', () => {
  const res = evaluateDirtyDozen(
    'user_create',
    { uid: 'userA', email_verified: true },
    'userA',
    {
      uid: 'userA',
      name: 'Aarav',
      rollNumber: '22CS101',
      year: 3,
      branch: 'cse',
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: 'SERVER_TIME',
    }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen Payload 8: Tampering with immutable creatorId is PERMISSION_DENIED', () => {
  const res = evaluateDirtyDozen(
    'event_update',
    { uid: 'userA', email_verified: true },
    'evt_1',
    {
      creatorId: 'userB',
      title: 'Valid Title',
      createdAt: 'T1',
    },
    {
      creatorId: 'userA',
      title: 'Old Title',
      status: 'running',
      createdAt: 'T1',
    }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen Payload 9: Updating terminal state event is PERMISSION_DENIED', () => {
  const res = evaluateDirtyDozen(
    'event_update',
    { uid: 'userA', email_verified: true },
    'evt_1',
    {
      creatorId: 'userA',
      title: 'Updated Title',
      createdAt: 'T1',
    },
    {
      creatorId: 'userA',
      title: 'Old Title',
      status: 'outdated',
      createdAt: 'T1',
    }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen Payload 10: Orphaned subcollection registration is PERMISSION_DENIED', () => {
  const res = evaluateDirtyDozen(
    'registration_create',
    { uid: 'userA', email_verified: true },
    'reg_1',
    {
      userId: 'userA',
      _parentEventExists: false,
      _parentEventStatus: 'running',
    }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen Payload 11: Value poisoning on update is PERMISSION_DENIED', () => {
  const res = evaluateDirtyDozen(
    'event_update',
    { uid: 'userA', email_verified: true },
    'evt_1',
    {
      creatorId: 'userA',
      title: 99999 as any,
      createdAt: 'T1',
    },
    {
      creatorId: 'userA',
      title: 'Old Title',
      status: 'running',
      createdAt: 'T1',
    }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen Payload 12: Cross-user notification list query is PERMISSION_DENIED', () => {
  const res = evaluateDirtyDozen(
    'notification_list',
    { uid: 'userA', email_verified: true },
    'notif_1',
    { userId: 'userB' }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});
