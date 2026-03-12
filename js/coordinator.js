// ==========================================
// COORDINATOR.JS — Coordinator page logic
// ==========================================

let currentUser = null;
let currentUserData = null;
let myClubIds = [];
let clubNamesMap = {};
let editingEventId = null;

// Auth listener
auth.onAuthStateChanged(async (user) => {
    if (!user) return;
    currentUser = user;

    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'coordinator') return;

    currentUserData = userDoc.data();

    document.getElementById('user-avatar').textContent = getInitials(currentUserData.name);
    document.getElementById('user-name').textContent = currentUserData.name;
    document.getElementById('welcome-msg').textContent = `Welcome, ${currentUserData.name.split(' ')[0]}! 📋`;

    // Find clubs assigned to this coordinator
    const clubsSnap = await db.collection('clubs')
        .where('coordinatorId', '==', currentUser.uid).get();

    myClubIds = [];
    clubNamesMap = {};
    clubsSnap.forEach(doc => {
        myClubIds.push(doc.id);
        clubNamesMap[doc.id] = doc.data().name;
    });

    loadDashboard();
    loadMembers();
    loadEvents();
    loadAnnouncements();
    loadRequests();
    populateClubSelectors();
});

// Navigation
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToPage(e.target.getAttribute('data-page'));
    });
});

// ==========================================
// DASHBOARD
// ==========================================
async function loadDashboard() {
    try {
        document.getElementById('stat-clubs').textContent = myClubIds.length;

        if (myClubIds.length === 0) {
            document.getElementById('club-subtitle').textContent = 'No clubs assigned yet. Ask admin to assign you.';
            document.getElementById('my-clubs-list').innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <div class="empty-icon">📋</div>
          <h4>No clubs assigned</h4>
          <p>Contact admin to get assigned to a club.</p>
        </div>`;
            return;
        }

        // Count members across all clubs
        let totalMembers = 0;
        const container = document.getElementById('my-clubs-list');
        container.innerHTML = '';

        for (const clubId of myClubIds) {
            const clubDoc = await db.collection('clubs').doc(clubId).get();
            if (!clubDoc.exists) continue;
            const club = clubDoc.data();
            totalMembers += club.memberCount || 0;

            container.innerHTML += `
        <div class="club-card">
          <div class="club-header">
            <h3>${club.name}</h3>
            <p>Coordinator</p>
          </div>
          <div class="club-body">
            <p>${club.description || ''}</p>
            <div class="club-meta"><span>👥 ${club.memberCount || 0} members</span></div>
          </div>
        </div>`;
        }

        document.getElementById('stat-members').textContent = totalMembers;

        // Count events
        let totalEvents = 0;
        for (const clubId of myClubIds) {
            const eventsSnap = await db.collection('events').where('clubId', '==', clubId).get();
            totalEvents += eventsSnap.size;
        }
        document.getElementById('stat-events').textContent = totalEvents;

        // Count pending requests
        let pendingRequests = 0;
        for (const clubId of myClubIds) {
            const reqSnap = await db.collection('joinRequests')
                .where('clubId', '==', clubId)
                .where('status', '==', 'pending').get();
            pendingRequests += reqSnap.size;
        }
        document.getElementById('stat-requests').textContent = pendingRequests;

    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// ==========================================
// MEMBERS
// ==========================================
async function loadMembers() {
    try {
        const container = document.getElementById('members-list');
        container.innerHTML = '';

        if (myClubIds.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><h4>No clubs assigned</h4></div>`;
            return;
        }

        let hasMembers = false;
        for (const clubId of myClubIds) {
            const usersSnap = await db.collection('users')
                .where('joinedClubs', 'array-contains', clubId).get();

            usersSnap.forEach(doc => {
                hasMembers = true;
                const user = doc.data();
                container.innerHTML += `
          <div class="member-item">
            <div class="member-avatar">${getInitials(user.name)}</div>
            <div class="member-info">
              <span>${user.name}</span>
              <small>${user.department || ''} • Year ${user.year || ''} • ${user.email}</small>
            </div>
          </div>`;
            });
        }

        if (!hasMembers) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><h4>No members yet</h4><p>Members will appear here once students join your clubs.</p></div>`;
        }
    } catch (error) {
        console.error('Error loading members:', error);
    }
}

// ==========================================
// EVENTS
// ==========================================
function populateClubSelectors() {
    const eventSelect = document.getElementById('event-club');
    const annSelect = document.getElementById('ann-club');

    const options = myClubIds.map(id => `<option value="${id}">${clubNamesMap[id]}</option>`).join('');
    eventSelect.innerHTML = options || '<option disabled>No clubs assigned</option>';
    annSelect.innerHTML = options || '<option disabled>No clubs assigned</option>';
}

async function loadEvents() {
    try {
        const container = document.getElementById('events-list');
        container.innerHTML = '';

        if (myClubIds.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><h4>No clubs assigned</h4></div>`;
            return;
        }

        let hasEvents = false;
        for (const clubId of myClubIds) {
            const eventsSnap = await db.collection('events')
                .where('clubId', '==', clubId)
                .orderBy('createdAt', 'desc').get();

            eventsSnap.forEach(doc => {
                hasEvents = true;
                const event = doc.data();
                const dateObj = parseEventDate(event.eventDate);

                container.innerHTML += `
          <div class="event-card">
            <div class="event-date">
              <span class="day">${dateObj.day}</span>
              <span class="month">${dateObj.month}</span>
            </div>
            <div class="event-info">
              <h3>${event.title}</h3>
              <div class="event-details">
                <span class="event-detail-item">⏰ ${event.time || 'TBD'}</span>
                <span class="event-detail-item">📍 ${event.venue || 'TBD'}</span>
                <span class="event-detail-item">🎯 ${clubNamesMap[event.clubId] || ''}</span>
              </div>
              <p style="color:#718096;margin-top:0.5rem;">${event.description || ''}</p>
              <div style="margin-top:0.75rem;display:flex;gap:0.5rem;">
                <button class="btn-primary btn-sm" onclick="editEvent('${doc.id}')">Edit</button>
                <button class="btn-danger btn-sm" onclick="deleteEvent('${doc.id}')">Delete</button>
              </div>
            </div>
          </div>`;
            });
        }

        if (!hasEvents) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><h4>No events yet</h4><p>Create your first event!</p></div>`;
        }
    } catch (error) {
        console.error('Error loading events:', error);
    }
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
        console.error('Error saving event:', error);
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
        showToast('Failed to delete event.', 'error');
    }
}

// ==========================================
// ANNOUNCEMENTS
// ==========================================
async function loadAnnouncements() {
    try {
        const container = document.getElementById('announcements-list');
        container.innerHTML = '';

        if (myClubIds.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">📢</div><h4>No clubs assigned</h4></div>`;
            return;
        }

        let hasAnn = false;
        for (const clubId of myClubIds) {
            const annSnap = await db.collection('announcements')
                .where('clubId', '==', clubId)
                .orderBy('createdAt', 'desc').get();

            annSnap.forEach(doc => {
                hasAnn = true;
                const ann = doc.data();
                container.innerHTML += `
          <div class="announcement-card">
            <div class="announcement-header">
              <span class="announcement-badge">${clubNamesMap[ann.clubId] || ''}</span>
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

        if (!hasAnn) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">📢</div><h4>No announcements</h4><p>Post your first announcement!</p></div>`;
        }
    } catch (error) {
        console.error('Error loading announcements:', error);
    }
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
    } catch (error) {
        console.error('Error posting announcement:', error);
        showToast('Failed to post announcement.', 'error');
    }
});

async function deleteAnnouncement(annId) {
    if (!confirm('Delete this announcement?')) return;
    try {
        await db.collection('announcements').doc(annId).delete();
        showToast('Announcement deleted.', 'success');
        loadAnnouncements();
    } catch (error) {
        showToast('Failed to delete.', 'error');
    }
}

// ==========================================
// JOIN REQUESTS
// ==========================================
async function loadRequests() {
    try {
        const tbody = document.getElementById('requests-tbody');
        const emptyState = document.getElementById('requests-empty');
        tbody.innerHTML = '';

        if (myClubIds.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }

        let hasRequests = false;
        for (const clubId of myClubIds) {
            const reqSnap = await db.collection('joinRequests')
                .where('clubId', '==', clubId)
                .orderBy('requestedAt', 'desc').get();

            reqSnap.forEach(doc => {
                hasRequests = true;
                const req = doc.data();
                const isPending = req.status === 'pending';

                tbody.innerHTML += `
          <tr>
            <td>${req.studentName || 'Unknown'}</td>
            <td>${req.studentEmail || ''}</td>
            <td>${clubNamesMap[req.clubId] || ''}</td>
            <td>${timeAgo(req.requestedAt)}</td>
            <td><span class="badge badge-${req.status}">${req.status}</span></td>
            <td>
              ${isPending ? `
                <div class="table-actions">
                  <button class="btn-success btn-sm" onclick="approveRequest('${doc.id}')">Approve</button>
                  <button class="btn-danger btn-sm" onclick="rejectRequest('${doc.id}')">Reject</button>
                </div>
              ` : '—'}
            </td>
          </tr>`;
            });
        }

        if (!hasRequests) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
        }
    } catch (error) {
        console.error('Error loading requests:', error);
    }
}

async function approveRequest(requestId) {
    try {
        const reqDoc = await db.collection('joinRequests').doc(requestId).get();
        if (!reqDoc.exists) return;
        const req = reqDoc.data();

        // Update request status
        await db.collection('joinRequests').doc(requestId).update({ status: 'approved' });

        // Add club to student's joinedClubs
        await db.collection('users').doc(req.studentId).update({
            joinedClubs: firebase.firestore.FieldValue.arrayUnion(req.clubId)
        });

        // Increment member count
        await db.collection('clubs').doc(req.clubId).update({
            memberCount: firebase.firestore.FieldValue.increment(1)
        });

        showToast('Request approved!', 'success');
        loadRequests();
        loadDashboard();
        loadMembers();
    } catch (error) {
        console.error('Error approving request:', error);
        showToast('Failed to approve request.', 'error');
    }
}

async function rejectRequest(requestId) {
    if (!confirm('Reject this join request?')) return;
    try {
        await db.collection('joinRequests').doc(requestId).update({ status: 'rejected' });
        showToast('Request rejected.', 'success');
        loadRequests();
        loadDashboard();
    } catch (error) {
        showToast('Failed to reject request.', 'error');
    }
}
