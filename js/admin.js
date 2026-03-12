// ==========================================
// ADMIN.JS — Admin panel logic (full CRUD)
// ==========================================

let currentUser = null;
let currentUserData = null;
let clubNamesMap = {};
let allClubs = [];
let coordinatorsMap = {};
let editingClubId = null;
let editingEventId = null;
let editingUserId = null;

// Auth listener
auth.onAuthStateChanged(async (user) => {
    if (!user) return;
    currentUser = user;

    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') return;

    currentUserData = userDoc.data();
    document.getElementById('user-avatar').textContent = getInitials(currentUserData.name);
    document.getElementById('user-name').textContent = currentUserData.name;
    document.getElementById('welcome-msg').textContent = `Welcome, ${currentUserData.name.split(' ')[0]}! ⚙️`;

    loadAll();
});

async function loadAll() {
    await loadClubsData();
    loadDashboard();
    loadClubs();
    loadEvents();
    loadAnnouncements();
    loadUsers();
}

// Navigation
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToPage(e.target.getAttribute('data-page'));
    });
});

// Load clubs into maps
async function loadClubsData() {
    const snap = await db.collection('clubs').get();
    allClubs = [];
    clubNamesMap = {};
    snap.forEach(doc => {
        allClubs.push({ id: doc.id, ...doc.data() });
        clubNamesMap[doc.id] = doc.data().name;
    });

    // Load coordinators
    const coordSnap = await db.collection('users').where('role', '==', 'coordinator').get();
    coordinatorsMap = {};
    coordSnap.forEach(doc => {
        coordinatorsMap[doc.id] = doc.data().name;
    });
}

// ==========================================
// DASHBOARD
// ==========================================
async function loadDashboard() {
    const usersSnap = await db.collection('users').get();
    const eventsSnap = await db.collection('events').get();
    const annSnap = await db.collection('announcements').get();

    document.getElementById('stat-clubs').textContent = allClubs.length;
    document.getElementById('stat-users').textContent = usersSnap.size;
    document.getElementById('stat-events').textContent = eventsSnap.size;
    document.getElementById('stat-announcements').textContent = annSnap.size;
}

// ==========================================
// CLUBS MANAGEMENT
// ==========================================
async function loadClubs() {
    const tbody = document.getElementById('clubs-tbody');
    const emptyState = document.getElementById('clubs-empty');
    tbody.innerHTML = '';

    if (allClubs.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    emptyState.classList.add('hidden');

    allClubs.forEach(club => {
        const coordName = coordinatorsMap[club.coordinatorId] || '—';
        tbody.innerHTML += `
      <tr>
        <td><strong>${club.icon || '🎯'} ${club.name}</strong></td>
        <td>${(club.description || '').substring(0, 50)}${(club.description || '').length > 50 ? '...' : ''}</td>
        <td>${coordName}</td>
        <td>${club.memberCount || 0}</td>
        <td>
          <div class="table-actions">
            <button class="btn-primary btn-sm" onclick="editClub('${club.id}')">Edit</button>
            <button class="btn-danger btn-sm" onclick="deleteClub('${club.id}')">Delete</button>
          </div>
        </td>
      </tr>`;
    });

    // Populate selects
    populateClubSelects();
}

function populateClubSelects() {
    const opts = allClubs.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const eventSelect = document.getElementById('event-club');
    const annSelect = document.getElementById('ann-club');
    if (eventSelect) eventSelect.innerHTML = opts || '<option disabled>No clubs</option>';
    if (annSelect) annSelect.innerHTML = opts || '<option disabled>No clubs</option>';

    // Coordinator selector in club modal
    const coordSelect = document.getElementById('club-coordinator');
    let coordOpts = '<option value="">None</option>';
    for (const [id, name] of Object.entries(coordinatorsMap)) {
        coordOpts += `<option value="${id}">${name}</option>`;
    }
    if (coordSelect) coordSelect.innerHTML = coordOpts;
}

function openClubModal(clubId) {
    editingClubId = clubId || null;
    document.getElementById('club-modal-title').textContent = clubId ? 'Edit Club' : 'Create New Club';
    document.getElementById('club-form').reset();
    document.getElementById('club-icon').value = '🎯';
    populateClubSelects();
    document.getElementById('club-modal').classList.remove('hidden');
}

function closeClubModal() {
    document.getElementById('club-modal').classList.add('hidden');
    editingClubId = null;
}

async function editClub(clubId) {
    const clubDoc = await db.collection('clubs').doc(clubId).get();
    if (!clubDoc.exists) return;
    const club = clubDoc.data();

    document.getElementById('club-name').value = club.name;
    document.getElementById('club-desc').value = club.description || '';
    document.getElementById('club-about').value = club.about || '';
    document.getElementById('club-icon').value = club.icon || '🎯';

    openClubModal(clubId);

    // Set coordinator after modal opens
    setTimeout(() => {
        document.getElementById('club-coordinator').value = club.coordinatorId || '';
    }, 100);
}

document.getElementById('club-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
        name: document.getElementById('club-name').value.trim(),
        description: document.getElementById('club-desc').value.trim(),
        about: document.getElementById('club-about').value.trim(),
        icon: document.getElementById('club-icon').value.trim() || '🎯',
        coordinatorId: document.getElementById('club-coordinator').value || ''
    };

    try {
        if (editingClubId) {
            await db.collection('clubs').doc(editingClubId).update(data);
            showToast('Club updated!', 'success');
        } else {
            data.memberCount = 0;
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('clubs').add(data);
            showToast('Club created!', 'success');
        }
        closeClubModal();
        await loadClubsData();
        loadClubs();
        loadDashboard();
    } catch (error) {
        console.error('Error saving club:', error);
        showToast('Failed to save club.', 'error');
    }
});

async function deleteClub(clubId) {
    if (!confirm('Delete this club? This will also remove all related events and announcements.')) return;
    try {
        await db.collection('clubs').doc(clubId).delete();

        // Delete related events
        const events = await db.collection('events').where('clubId', '==', clubId).get();
        const batch1 = db.batch();
        events.forEach(doc => batch1.delete(doc.ref));
        await batch1.commit();

        // Delete related announcements
        const anns = await db.collection('announcements').where('clubId', '==', clubId).get();
        const batch2 = db.batch();
        anns.forEach(doc => batch2.delete(doc.ref));
        await batch2.commit();

        showToast('Club deleted.', 'success');
        await loadClubsData();
        loadClubs();
        loadDashboard();
    } catch (error) {
        console.error('Error deleting club:', error);
        showToast('Failed to delete club.', 'error');
    }
}

// ==========================================
// EVENTS MANAGEMENT
// ==========================================
async function loadEvents() {
    const tbody = document.getElementById('events-tbody');
    const emptyState = document.getElementById('events-empty');
    tbody.innerHTML = '';

    const snap = await db.collection('events').orderBy('createdAt', 'desc').get();

    if (snap.empty) {
        emptyState.classList.remove('hidden');
        return;
    }
    emptyState.classList.add('hidden');

    snap.forEach(doc => {
        const event = doc.data();
        tbody.innerHTML += `
      <tr>
        <td><strong>${event.title}</strong></td>
        <td>${clubNamesMap[event.clubId] || '—'}</td>
        <td>${event.eventDate || '—'}</td>
        <td>${event.venue || '—'}</td>
        <td>
          <div class="table-actions">
            <button class="btn-primary btn-sm" onclick="editEvent('${doc.id}')">Edit</button>
            <button class="btn-danger btn-sm" onclick="deleteEvent('${doc.id}')">Delete</button>
          </div>
        </td>
      </tr>`;
    });
}

function openEventModal(eventId) {
    editingEventId = eventId || null;
    document.getElementById('event-modal-title').textContent = eventId ? 'Edit Event' : 'Create New Event';
    document.getElementById('event-form').reset();
    document.getElementById('event-modal').classList.remove('hidden');
}

function closeEventModal() {
    document.getElementById('event-modal').classList.add('hidden');
    editingEventId = null;
}

async function editEvent(eventId) {
    const doc = await db.collection('events').doc(eventId).get();
    if (!doc.exists) return;
    const event = doc.data();

    document.getElementById('event-club').value = event.clubId;
    document.getElementById('event-title').value = event.title;
    document.getElementById('event-desc').value = event.description || '';
    document.getElementById('event-date').value = event.eventDate || '';
    document.getElementById('event-time').value = event.time || '';
    document.getElementById('event-venue').value = event.venue || '';

    openEventModal(eventId);
}

document.getElementById('event-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
        clubId: document.getElementById('event-club').value,
        title: document.getElementById('event-title').value.trim(),
        description: document.getElementById('event-desc').value.trim(),
        eventDate: document.getElementById('event-date').value,
        time: document.getElementById('event-time').value.trim(),
        venue: document.getElementById('event-venue').value.trim(),
        createdBy: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        if (editingEventId) {
            await db.collection('events').doc(editingEventId).update(data);
            showToast('Event updated!', 'success');
        } else {
            await db.collection('events').add(data);
            showToast('Event created!', 'success');
        }
        closeEventModal();
        loadEvents();
        loadDashboard();
    } catch (error) {
        showToast('Failed to save event.', 'error');
    }
});

async function deleteEvent(eventId) {
    if (!confirm('Delete this event?')) return;
    try {
        await db.collection('events').doc(eventId).delete();
        showToast('Event deleted.', 'success');
        loadEvents();
        loadDashboard();
    } catch (error) {
        showToast('Failed to delete.', 'error');
    }
}

// ==========================================
// ANNOUNCEMENTS MANAGEMENT
// ==========================================
async function loadAnnouncements() {
    const container = document.getElementById('announcements-list');
    const snap = await db.collection('announcements').orderBy('createdAt', 'desc').get();

    if (snap.empty) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">📢</div><h4>No announcements</h4></div>`;
        return;
    }

    container.innerHTML = '';
    snap.forEach(doc => {
        const ann = doc.data();
        container.innerHTML += `
      <div class="announcement-card">
        <div class="announcement-header">
          <span class="announcement-badge">${clubNamesMap[ann.clubId] || 'General'}</span>
          <span class="announcement-date">${timeAgo(ann.createdAt)}</span>
        </div>
        <div class="announcement-content">
          <h4 style="margin-bottom:0.5rem;color:#2d3748;">${ann.title}</h4>
          <p>${ann.content}</p>
        </div>
        <div style="margin-top:0.75rem;">
          <button class="btn-danger btn-sm" onclick="deleteAnnouncement('${doc.id}')">Delete</button>
        </div>
      </div>`;
    });
}

function openAnnouncementModal() {
    document.getElementById('announcement-form').reset();
    document.getElementById('announcement-modal').classList.remove('hidden');
}

function closeAnnouncementModal() {
    document.getElementById('announcement-modal').classList.add('hidden');
}

document.getElementById('announcement-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
        clubId: document.getElementById('ann-club').value,
        title: document.getElementById('ann-title').value.trim(),
        content: document.getElementById('ann-content').value.trim(),
        postedBy: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('announcements').add(data);
        showToast('Announcement posted!', 'success');
        closeAnnouncementModal();
        loadAnnouncements();
        loadDashboard();
    } catch (error) {
        showToast('Failed to post.', 'error');
    }
});

async function deleteAnnouncement(annId) {
    if (!confirm('Delete this announcement?')) return;
    try {
        await db.collection('announcements').doc(annId).delete();
        showToast('Deleted.', 'success');
        loadAnnouncements();
        loadDashboard();
    } catch (error) {
        showToast('Failed to delete.', 'error');
    }
}

// ==========================================
// USERS MANAGEMENT
// ==========================================
async function loadUsers() {
    const tbody = document.getElementById('users-tbody');
    const snap = await db.collection('users').get();
    tbody.innerHTML = '';

    snap.forEach(doc => {
        const user = doc.data();
        const roleBadge = `badge-${user.role}`;

        tbody.innerHTML += `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:0.5rem;">
            <div class="member-avatar" style="width:32px;height:32px;font-size:0.7rem;">${getInitials(user.name)}</div>
            <strong>${user.name}</strong>
          </div>
        </td>
        <td>${user.email}</td>
        <td>${user.department || '—'}</td>
        <td>${user.year || '—'}</td>
        <td><span class="badge ${roleBadge}">${user.role}</span></td>
        <td>
          <button class="btn-primary btn-sm" onclick="openRoleModal('${doc.id}', '${user.name}', '${user.role}')">Change Role</button>
        </td>
      </tr>`;
    });
}

function openRoleModal(userId, userName, currentRole) {
    editingUserId = userId;
    document.getElementById('role-user-name').value = userName;
    document.getElementById('role-select').value = currentRole;
    document.getElementById('role-modal').classList.remove('hidden');
}

function closeRoleModal() {
    document.getElementById('role-modal').classList.add('hidden');
    editingUserId = null;
}

document.getElementById('role-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editingUserId) return;

    const newRole = document.getElementById('role-select').value;

    try {
        await db.collection('users').doc(editingUserId).update({ role: newRole });
        showToast(`Role updated to ${newRole}!`, 'success');
        closeRoleModal();
        await loadClubsData(); // Refresh coordinators
        loadUsers();
    } catch (error) {
        showToast('Failed to update role.', 'error');
    }
});
