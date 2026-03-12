// ==========================================
// LOCAL DATABASE MOCK (Replaces Firebase)
// ==========================================
// This simulates Firebase Auth + Firestore using localStorage.
// No setup needed — works instantly offline.
// For production, replace this with real Firebase SDK.

// ==========================================
// STORAGE LAYER
// ==========================================
const LocalDB = {
  get(collection) {
    const data = localStorage.getItem(`clubhub_${collection}`);
    return data ? JSON.parse(data) : {};
  },
  set(collection, data) {
    localStorage.setItem(`clubhub_${collection}`, JSON.stringify(data));
  },
  getAuth() {
    const data = localStorage.getItem('clubhub_auth');
    return data ? JSON.parse(data) : null;
  },
  setAuth(user) {
    if (user) {
      localStorage.setItem('clubhub_auth', JSON.stringify(user));
    } else {
      localStorage.removeItem('clubhub_auth');
    }
  }
};

// ==========================================
// GENERATE UNIQUE IDs
// ==========================================
function generateId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
}

// ==========================================
// FIREBASE AUTH MOCK
// ==========================================
class MockAuth {
  constructor() {
    this._listeners = [];
    this._currentUser = null;

    // Restore session
    const saved = LocalDB.getAuth();
    if (saved) {
      this._currentUser = { uid: saved.uid, email: saved.email };
    }

    // Notify listeners after DOM loads
    setTimeout(() => {
      this._listeners.forEach(cb => cb(this._currentUser));
    }, 100);
  }

  onAuthStateChanged(callback) {
    this._listeners.push(callback);
    // Fire immediately if user exists
    setTimeout(() => callback(this._currentUser), 50);
  }

  async signInWithEmailAndPassword(email, password) {
    const users = LocalDB.get('users');
    const uid = Object.keys(users).find(id => users[id].email === email);

    if (!uid) {
      throw { code: 'auth/user-not-found', message: 'No account found with this email.' };
    }

    if (users[uid]._password !== password) {
      throw { code: 'auth/wrong-password', message: 'Incorrect password.' };
    }

    this._currentUser = { uid, email };
    LocalDB.setAuth({ uid, email });
    this._listeners.forEach(cb => cb(this._currentUser));

    return { user: { uid, email } };
  }

  async createUserWithEmailAndPassword(email, password) {
    const users = LocalDB.get('users');
    const existing = Object.keys(users).find(id => users[id].email === email);

    if (existing) {
      throw { code: 'auth/email-already-in-use', message: 'Email already registered.' };
    }

    if (password.length < 6) {
      throw { code: 'auth/weak-password', message: 'Password should be at least 6 characters.' };
    }

    const uid = generateId();
    this._currentUser = { uid, email };
    LocalDB.setAuth({ uid, email });

    // Store password hash (just storing plain for demo)
    users[uid] = { _password: password, email };
    LocalDB.set('users', users);

    this._listeners.forEach(cb => cb(this._currentUser));
    return { user: { uid, email } };
  }

  async signOut() {
    this._currentUser = null;
    LocalDB.setAuth(null);
    this._listeners.forEach(cb => cb(null));
  }

  get currentUser() {
    return this._currentUser;
  }
}

// ==========================================
// FIRESTORE MOCK
// ==========================================
class MockTimestamp {
  constructor(date) {
    this._date = date || new Date();
  }
  toDate() {
    return this._date;
  }
  toJSON() {
    return { _type: 'timestamp', _value: this._date.toISOString() };
  }
}

// Revive timestamps from JSON
function reviveTimestamps(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj._type === 'timestamp') return new MockTimestamp(new Date(obj._value));
  for (const key of Object.keys(obj)) {
    obj[key] = reviveTimestamps(obj[key]);
  }
  return obj;
}

class MockDocSnapshot {
  constructor(id, data, exists = true) {
    this.id = id;
    this._data = data;
    this.exists = exists;
  }
  data() {
    return this._data ? reviveTimestamps({ ...this._data }) : undefined;
  }
}

class MockQuerySnapshot {
  constructor(docs) {
    this._docs = docs;
    this.size = docs.length;
    this.empty = docs.length === 0;
  }
  forEach(callback) {
    this._docs.forEach(callback);
  }
}

class MockDocRef {
  constructor(collection, docId) {
    this._collection = collection;
    this._docId = docId;
    this.ref = this;
  }

  async get() {
    const data = LocalDB.get(this._collection);
    const doc = data[this._docId];
    return new MockDocSnapshot(this._docId, doc || null, !!doc);
  }

  async set(value) {
    const data = LocalDB.get(this._collection);
    // Remove internal password from display but keep it
    data[this._docId] = { ...data[this._docId], ...value };
    LocalDB.set(this._collection, data);
  }

  async update(updates) {
    const data = LocalDB.get(this._collection);
    if (!data[this._docId]) throw new Error('Document not found');

    for (const [key, value] of Object.entries(updates)) {
      if (value && value._type === 'fieldValue') {
        switch (value._operation) {
          case 'increment':
            data[this._docId][key] = (data[this._docId][key] || 0) + value._value;
            break;
          case 'arrayUnion':
            if (!Array.isArray(data[this._docId][key])) data[this._docId][key] = [];
            if (!data[this._docId][key].includes(value._value)) {
              data[this._docId][key].push(value._value);
            }
            break;
          case 'arrayRemove':
            if (Array.isArray(data[this._docId][key])) {
              data[this._docId][key] = data[this._docId][key].filter(v => v !== value._value);
            }
            break;
          case 'serverTimestamp':
            data[this._docId][key] = new MockTimestamp().toJSON();
            break;
        }
      } else {
        data[this._docId][key] = value;
      }
    }
    LocalDB.set(this._collection, data);
  }

  async delete() {
    const data = LocalDB.get(this._collection);
    delete data[this._docId];
    LocalDB.set(this._collection, data);
  }
}

class MockQuery {
  constructor(collection, filters = [], orderByField = null, orderDir = 'asc') {
    this._collection = collection;
    this._filters = filters;
    this._orderByField = orderByField;
    this._orderDir = orderDir;
  }

  where(field, op, value) {
    return new MockQuery(
      this._collection,
      [...this._filters, { field, op, value }],
      this._orderByField,
      this._orderDir
    );
  }

  orderBy(field, dir = 'asc') {
    return new MockQuery(this._collection, this._filters, field, dir);
  }

  async get() {
    const data = LocalDB.get(this._collection);
    let results = Object.entries(data)
      .filter(([id, doc]) => !id.startsWith('_'))
      .map(([id, doc]) => {
        const revived = reviveTimestamps({ ...doc });
        return new MockDocSnapshot(id, revived);
      });

    // Apply filters
    for (const f of this._filters) {
      results = results.filter(snap => {
        const docData = snap.data();
        const val = docData[f.field];

        switch (f.op) {
          case '==': return val === f.value;
          case '!=': return val !== f.value;
          case '>': return val > f.value;
          case '<': return val < f.value;
          case '>=': return val >= f.value;
          case '<=': return val <= f.value;
          case 'array-contains':
            return Array.isArray(val) && val.includes(f.value);
          default: return true;
        }
      });
    }

    // Apply ordering
    if (this._orderByField) {
      results.sort((a, b) => {
        let aVal = a.data()[this._orderByField];
        let bVal = b.data()[this._orderByField];

        // Handle timestamps
        if (aVal && aVal.toDate) aVal = aVal.toDate().getTime();
        if (bVal && bVal.toDate) bVal = bVal.toDate().getTime();
        if (aVal && aVal._type === 'timestamp') aVal = new Date(aVal._value).getTime();
        if (bVal && bVal._type === 'timestamp') bVal = new Date(bVal._value).getTime();

        if (aVal < bVal) return this._orderDir === 'desc' ? 1 : -1;
        if (aVal > bVal) return this._orderDir === 'desc' ? -1 : 1;
        return 0;
      });
    }

    return new MockQuerySnapshot(results);
  }
}

class MockCollectionRef extends MockQuery {
  constructor(name) {
    super(name);
    this._name = name;
  }

  doc(docId) {
    return new MockDocRef(this._name, docId);
  }

  async add(value) {
    const id = generateId();
    const data = LocalDB.get(this._name);

    // Process field values
    const processed = {};
    for (const [key, val] of Object.entries(value)) {
      if (val && val._type === 'fieldValue' && val._operation === 'serverTimestamp') {
        processed[key] = new MockTimestamp().toJSON();
      } else {
        processed[key] = val;
      }
    }

    data[id] = processed;
    LocalDB.set(this._name, data);
    return new MockDocRef(this._name, id);
  }
}

class MockFirestore {
  collection(name) {
    return new MockCollectionRef(name);
  }

  batch() {
    const ops = [];
    return {
      delete(docRef) {
        ops.push({ type: 'delete', ref: docRef });
      },
      async commit() {
        for (const op of ops) {
          if (op.type === 'delete') await op.ref.delete();
        }
      }
    };
  }
}

// ==========================================
// FIREBASE NAMESPACE (Global)
// ==========================================
const firebase = {
  firestore: {
    FieldValue: {
      serverTimestamp() {
        return { _type: 'fieldValue', _operation: 'serverTimestamp' };
      },
      increment(n) {
        return { _type: 'fieldValue', _operation: 'increment', _value: n };
      },
      arrayUnion(val) {
        return { _type: 'fieldValue', _operation: 'arrayUnion', _value: val };
      },
      arrayRemove(val) {
        return { _type: 'fieldValue', _operation: 'arrayRemove', _value: val };
      }
    }
  }
};

const auth = new MockAuth();
const db = new MockFirestore();

// ==========================================
// SEED DEFAULT DATA (runs if missing/empty)
// ==========================================
function seedDefaultData() {
  // Force re-seed if clubs are missing (handles stale data from previous sessions)
  const existingClubs = LocalDB.get('clubs');
  const hasClubs = Object.keys(existingClubs).length > 0;
  const isSeeded = localStorage.getItem('clubhub_seeded');

  if (isSeeded && hasClubs) return; // Already seeded and data exists

  // Clear old data first
  localStorage.removeItem('clubhub_users');
  localStorage.removeItem('clubhub_clubs');
  localStorage.removeItem('clubhub_events');
  localStorage.removeItem('clubhub_announcements');
  localStorage.removeItem('clubhub_joinRequests');
  localStorage.removeItem('clubhub_auth');

  const now = new MockTimestamp();

  // --- Admin User ---
  const adminId = 'admin_001';
  const users = {};
  users[adminId] = {
    _password: 'admin123',
    name: 'Admin User',
    email: 'admin@college.edu',
    phone: '9999999999',
    department: 'Administration',
    year: 0,
    role: 'admin',
    joinedClubs: [],
    createdAt: now.toJSON()
  };

  // --- Coordinator Users ---
  const coord1Id = 'coord_001';
  users[coord1Id] = {
    _password: 'coord123',
    name: 'Rahul Verma',
    email: 'rahul@college.edu',
    phone: '9876543210',
    department: 'CSE',
    year: 3,
    role: 'coordinator',
    joinedClubs: ['club_coding', 'club_robotics'],
    createdAt: now.toJSON()
  };

  const coord2Id = 'coord_002';
  users[coord2Id] = {
    _password: 'coord123',
    name: 'Sneha Patel',
    email: 'sneha@college.edu',
    phone: '9876543211',
    department: 'ECE',
    year: 4,
    role: 'coordinator',
    joinedClubs: ['club_music', 'club_drama'],
    createdAt: now.toJSON()
  };

  // --- Student Users ---
  const stud1Id = 'stud_001';
  users[stud1Id] = {
    _password: 'student123',
    name: 'Priya Sharma',
    email: 'priya@college.edu',
    phone: '9876543212',
    department: 'CSE',
    year: 2,
    role: 'student',
    joinedClubs: ['club_coding'],
    createdAt: now.toJSON()
  };

  const stud2Id = 'stud_002';
  users[stud2Id] = {
    _password: 'student123',
    name: 'Amit Mehta',
    email: 'amit@college.edu',
    phone: '9876543213',
    department: 'ISE',
    year: 2,
    role: 'student',
    joinedClubs: ['club_coding', 'club_music'],
    createdAt: now.toJSON()
  };

  const stud3Id = 'stud_003';
  users[stud3Id] = {
    _password: 'student123',
    name: 'Neha Kapoor',
    email: 'neha@college.edu',
    phone: '9876543214',
    department: 'CSE',
    year: 3,
    role: 'student',
    joinedClubs: ['club_robotics'],
    createdAt: now.toJSON()
  };

  LocalDB.set('users', users);

  // --- Clubs ---
  const clubs = {
    club_coding: {
      name: 'Coding Club',
      description: 'Learn programming, participate in hackathons, and build innovative projects.',
      about: 'The Coding Club is a community of passionate programmers and tech enthusiasts who come together to learn, share knowledge, and build innovative projects. We organize regular workshops, hackathons, and coding competitions.',
      icon: '💻',
      coordinatorId: coord1Id,
      memberCount: 3,
      createdAt: now.toJSON()
    },
    club_music: {
      name: 'Music Society',
      description: 'Express yourself through melody, rhythm, and performance.',
      about: 'The Music Society brings together musicians, singers, and music lovers. We organize jam sessions, concerts, and music workshops throughout the year.',
      icon: '🎵',
      coordinatorId: coord2Id,
      memberCount: 2,
      createdAt: now.toJSON()
    },
    club_robotics: {
      name: 'Robotics Club',
      description: 'Build robots, learn electronics, and compete in robotics competitions.',
      about: 'The Robotics Club is where engineering meets creativity. Members design, build, and program robots for various competitions and research projects.',
      icon: '🤖',
      coordinatorId: coord1Id,
      memberCount: 2,
      createdAt: now.toJSON()
    },
    club_drama: {
      name: 'Drama Club',
      description: 'Unleash creativity through theatre performances and workshops.',
      about: 'The Drama Club brings stories to life on stage. We produce plays, conduct acting workshops, and participate in inter-college theatre festivals.',
      icon: '🎭',
      coordinatorId: coord2Id,
      memberCount: 1,
      createdAt: now.toJSON()
    },
    club_sports: {
      name: 'Sports Club',
      description: 'Stay fit, compete in tournaments, and build teamwork skills.',
      about: 'The Sports Club promotes physical fitness and sportsmanship. We organize inter-departmental tournaments and represent the college in various sports events.',
      icon: '⚽',
      coordinatorId: '',
      memberCount: 0,
      createdAt: now.toJSON()
    },
    club_photography: {
      name: 'Photography Club',
      description: 'Capture moments and showcase your artistic vision through the lens.',
      about: 'The Photography Club is for anyone who loves capturing the world through their camera. We organize photo walks, exhibitions, and workshops on photography techniques.',
      icon: '📸',
      coordinatorId: '',
      memberCount: 0,
      createdAt: now.toJSON()
    }
  };
  LocalDB.set('clubs', clubs);

  // --- Events ---
  const events = {};
  events[generateId()] = {
    title: 'Web Development Workshop',
    description: 'Learn HTML, CSS, and JavaScript from scratch. Build your first website in 2 hours!',
    clubId: 'club_coding',
    eventDate: '2026-03-25',
    time: '3:00 PM - 5:00 PM',
    venue: 'Computer Lab A',
    createdBy: coord1Id,
    createdAt: now.toJSON()
  };
  events[generateId()] = {
    title: 'Annual Music Fest',
    description: 'Showcase your musical talent! Solo and group performances welcome.',
    clubId: 'club_music',
    eventDate: '2026-03-28',
    time: '6:00 PM - 10:00 PM',
    venue: 'Main Auditorium',
    createdBy: coord2Id,
    createdAt: now.toJSON()
  };
  events[generateId()] = {
    title: 'Robo Wars Competition',
    description: 'Build battle robots and compete head-to-head! Exciting prizes to be won.',
    clubId: 'club_robotics',
    eventDate: '2026-04-05',
    time: '10:00 AM - 4:00 PM',
    venue: 'Main Ground',
    createdBy: coord1Id,
    createdAt: now.toJSON()
  };
  events[generateId()] = {
    title: 'Hackathon 2026',
    description: '48-hour coding marathon. Build something amazing and win prizes worth ₹50,000!',
    clubId: 'club_coding',
    eventDate: '2026-04-15',
    time: '9:00 AM onwards',
    venue: 'Tech Hub',
    createdBy: coord1Id,
    createdAt: now.toJSON()
  };
  events[generateId()] = {
    title: 'Stage Play: The Modern Classics',
    description: 'A dramatic retelling of classic stories with a modern twist.',
    clubId: 'club_drama',
    eventDate: '2026-04-20',
    time: '5:00 PM - 7:30 PM',
    venue: 'Auditorium B',
    createdBy: coord2Id,
    createdAt: now.toJSON()
  };
  LocalDB.set('events', events);

  // --- Announcements ---
  const announcements = {};
  announcements[generateId()] = {
    title: 'Hackathon Registration Open!',
    content: 'Registration for the Annual Hackathon is now open! Join us for 48 hours of coding, innovation, and prizes worth ₹50,000. Limited seats — register now!',
    clubId: 'club_coding',
    postedBy: coord1Id,
    createdAt: new MockTimestamp(new Date(Date.now() - 2 * 86400000)).toJSON()
  };
  announcements[generateId()] = {
    title: 'Music Fest Auditions',
    content: 'Auditions for the Annual Music Fest are next week. Showcase your talent and be part of the biggest musical event of the year. Open to all students!',
    clubId: 'club_music',
    postedBy: coord2Id,
    createdAt: new MockTimestamp(new Date(Date.now() - 3 * 86400000)).toJSON()
  };
  announcements[generateId()] = {
    title: 'New Members Welcome!',
    content: 'The Robotics Club is accepting new members! No prior experience needed. Join us every Wednesday at 4 PM in Lab C-102.',
    clubId: 'club_robotics',
    postedBy: coord1Id,
    createdAt: new MockTimestamp(new Date(Date.now() - 5 * 86400000)).toJSON()
  };
  announcements[generateId()] = {
    title: 'Drama Auditions Open',
    content: 'Auditions for "The Modern Classics" are now open! We need actors, backstage crew, and set designers. No experience required.',
    clubId: 'club_drama',
    postedBy: coord2Id,
    createdAt: new MockTimestamp(new Date(Date.now() - 7 * 86400000)).toJSON()
  };
  LocalDB.set('announcements', announcements);

  // --- Join Requests ---
  const joinRequests = {};
  joinRequests[generateId()] = {
    studentId: stud3Id,
    studentName: 'Neha Kapoor',
    studentEmail: 'neha@college.edu',
    clubId: 'club_coding',
    status: 'pending',
    requestedAt: new MockTimestamp(new Date(Date.now() - 1 * 86400000)).toJSON()
  };
  LocalDB.set('joinRequests', joinRequests);

  localStorage.setItem('clubhub_seeded', 'true');
  console.log('✅ Demo data seeded successfully!');
}

// Reset all data and re-seed
function resetDemoData() {
  localStorage.removeItem('clubhub_seeded');
  localStorage.removeItem('clubhub_users');
  localStorage.removeItem('clubhub_clubs');
  localStorage.removeItem('clubhub_events');
  localStorage.removeItem('clubhub_announcements');
  localStorage.removeItem('clubhub_joinRequests');
  localStorage.removeItem('clubhub_auth');
  seedDefaultData();
  showToast('Demo data reset!', 'success');
  setTimeout(() => window.location.href = 'index.html', 500);
}

// Run seed
seedDefaultData();

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function navigateToPage(pageName) {
  const pages = document.querySelectorAll('.page');
  pages.forEach(page => page.classList.add('hidden'));

  const target = document.getElementById(`${pageName}-page`);
  if (target) target.classList.remove('hidden');

  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => link.classList.remove('active'));
  const activeLink = document.querySelector(`[data-page="${pageName}"]`);
  if (activeLink) activeLink.classList.add('active');
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : (timestamp._type === 'timestamp' ? new Date(timestamp._value) : new Date(timestamp));
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeAgo(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : (timestamp._type === 'timestamp' ? new Date(timestamp._value) : new Date(timestamp));
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  return formatDate(timestamp);
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function parseEventDate(dateStr) {
  const date = new Date(dateStr);
  return {
    day: date.getDate().toString().padStart(2, '0'),
    month: date.toLocaleString('en', { month: 'short' }).toUpperCase()
  };
}

console.log('🔥 ClubHub Local Database initialized');
console.log('📋 Demo Accounts:');
console.log('   Admin:       admin@college.edu / admin123');
console.log('   Coordinator: rahul@college.edu / coord123');
console.log('   Student:     priya@college.edu / student123');
