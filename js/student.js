// ==========================================
// STUDENT.JS — All student page logic
// ==========================================

let currentUser = null;
let currentUserData = null;

// Wait for auth then load data
auth.onAuthStateChanged(async (user) => {
    if (!user) return;
    currentUser = user;

    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'student') return;

    currentUserData = userDoc.data();

    // Update navbar
    document.getElementById('user-avatar').textContent = getInitials(currentUserData.name);
    document.getElementById('user-name').textContent = currentUserData.name;
    document.getElementById('welcome-msg').textContent = `Welcome, ${currentUserData.name.split(' ')[0]}! 👋`;

    // Load all data
    loadDashboard();
    loadAllClubs();
    loadAllEvents();
    loadAllAnnouncements();
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
        const joinedClubs = currentUserData.joinedClubs || [];

        // Stats
        const eventsSnap = await db.collection('events').get();
        const announcementsSnap = await db.collection('announcements').get();

        document.getElementById('stat-clubs').textContent = joinedClubs.length;
        document.getElementById('stat-events').textContent = eventsSnap.size;
        document.getElementById('stat-announcements').textContent = announcementsSnap.size;

        // My Clubs
        const container = document.getElementById('my-clubs-list');
        if (joinedClubs.length === 0) {
            container.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div class="empty-icon">🎯</div>
          <h4>No clubs joined yet</h4>
          <p>Browse clubs and join ones that interest you!</p>
          <button class="btn-primary" onclick="navigateToPage('clubs')" style="margin-top:1rem;">Browse Clubs</button>
        </div>`;
            return;
        }

        container.innerHTML = '';
        for (const clubId of joinedClubs) {
            const clubDoc = await db.collection('clubs').doc(clubId).get();
            if (!clubDoc.exists) continue;
            const club = clubDoc.data();
            container.innerHTML += `
        <div class="club-card">
          <div class="club-header">
            <h3>${club.name}</h3>
          </div>
          <div class="club-body">
            <p>${club.description || ''}</p>
            <div class="club-meta"><span>👥 ${club.memberCount || 0} members</span></div>
            <div class="club-actions">
              <button class="btn-primary btn-block" onclick="viewClubDetails('${clubDoc.id}')">View Details</button>
              <button class="btn-secondary" onclick="leaveClub('${clubDoc.id}')">Leave</button>
            </div>
          </div>
        </div>`;
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// ==========================================
// BROWSE CLUBS
// ==========================================
async function loadAllClubs() {
    try {
        const snapshot = await db.collection('clubs').get();
        const container = document.getElementById('all-clubs-list');

        if (snapshot.empty) {
            container.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div class="empty-icon">📋</div>
          <h4>No clubs available yet</h4>
          <p>Check back later for new clubs!</p>
        </div>`;
            return;
        }

        container.innerHTML = '';
        const joinedClubs = currentUserData.joinedClubs || [];

        snapshot.forEach(doc => {
            const club = doc.data();
            const isJoined = joinedClubs.includes(doc.id);
            const isPending = false; // Will check join requests

            container.innerHTML += `
        <div class="club-card">
          <div class="club-header">
            <h3>${club.name}</h3>
            <p>${club.icon || '🎯'} Club</p>
          </div>
          <div class="club-body">
            <p>${club.description || ''}</p>
            <div class="club-meta">
              <span>👥 ${club.memberCount || 0} members</span>
            </div>
            <div class="club-actions">
              <button class="btn-primary" onclick="viewClubDetails('${doc.id}')">View Details</button>
              ${isJoined
                    ? `<button class="btn-secondary" onclick="leaveClub('${doc.id}')">Leave</button>`
                    : `<button class="btn-success" onclick="requestJoin('${doc.id}')">Join Club</button>`
                }
            </div>
          </div>
        </div>`;
        });
    } catch (error) {
        console.error('Error loading clubs:', error);
    }
}

// ==========================================
// CLUB DETAILS
// ==========================================
async function viewClubDetails(clubId) {
    try {
        navigateToPage('club-details');

        const clubDoc = await db.collection('clubs').doc(clubId).get();
        if (!clubDoc.exists) return;
        const club = clubDoc.data();

        document.getElementById('detail-club-name').textContent = club.name;
        document.getElementById('detail-club-desc').textContent = club.description || '';
        document.getElementById('detail-club-about').textContent = club.about || club.description || 'No description available.';

        // Load members
        const membersContainer = document.getElementById('detail-members-list');
        const usersSnap = await db.collection('users')
            .where('joinedClubs', 'array-contains', clubId)
            .get();

        document.getElementById('detail-members-title').textContent = `Members (${usersSnap.size})`;
        membersContainer.innerHTML = '';

        usersSnap.forEach(doc => {
            const user = doc.data();
            membersContainer.innerHTML += `
        <div class="member-item">
          <div class="member-avatar">${getInitials(user.name)}</div>
          <div class="member-info">
            <span>${user.name}</span>
            <small>${user.department || ''} • ${user.role}</small>
          </div>
        </div>`;
        });

        if (usersSnap.empty) {
            membersContainer.innerHTML = '<p style="color:#718096;">No members yet.</p>';
        }

        // Load club events
        const eventsContainer = document.getElementById('detail-events-list');
        const eventsSnap = await db.collection('events')
            .where('clubId', '==', clubId)
            .orderBy('createdAt', 'desc')
            .get();

        eventsContainer.innerHTML = '';
        if (eventsSnap.empty) {
            eventsContainer.innerHTML = '<p style="color:#718096;">No events scheduled.</p>';
        } else {
            eventsSnap.forEach(doc => {
                const event = doc.data();
                const dateObj = parseEventDate(event.eventDate);
                eventsContainer.innerHTML += createEventCard(event, dateObj);
            });
        }

        // Load club announcements
        const annContainer = document.getElementById('detail-announcements-list');
        const annSnap = await db.collection('announcements')
            .where('clubId', '==', clubId)
            .orderBy('createdAt', 'desc')
            .get();

        annContainer.innerHTML = '';
        if (annSnap.empty) {
            annContainer.innerHTML = '<p style="color:#718096;">No announcements.</p>';
        } else {
            annSnap.forEach(doc => {
                const ann = doc.data();
                annContainer.innerHTML += createAnnouncementCard(ann);
            });
        }

    } catch (error) {
        console.error('Error loading club details:', error);
    }
}

// ==========================================
// JOIN / LEAVE CLUB
// ==========================================
async function requestJoin(clubId) {
    try {
        // Check if already requested
        const existing = await db.collection('joinRequests')
            .where('studentId', '==', currentUser.uid)
            .where('clubId', '==', clubId)
            .where('status', '==', 'pending')
            .get();

        if (!existing.empty) {
            showToast('You already have a pending request for this club.', 'error');
            return;
        }

        await db.collection('joinRequests').add({
            studentId: currentUser.uid,
            studentName: currentUserData.name,
            studentEmail: currentUserData.email,
            clubId: clubId,
            status: 'pending',
            requestedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('Join request sent! Waiting for coordinator approval.', 'success');
    } catch (error) {
        console.error('Error sending join request:', error);
        showToast('Failed to send request.', 'error');
    }
}

async function leaveClub(clubId) {
    if (!confirm('Are you sure you want to leave this club?')) return;

    try {
        // Remove from user's joinedClubs
        await db.collection('users').doc(currentUser.uid).update({
            joinedClubs: firebase.firestore.FieldValue.arrayRemove(clubId)
        });

        // Decrease member count
        await db.collection('clubs').doc(clubId).update({
            memberCount: firebase.firestore.FieldValue.increment(-1)
        });

        // Refresh user data
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        currentUserData = userDoc.data();

        showToast('You have left the club.', 'success');
        loadDashboard();
        loadAllClubs();
    } catch (error) {
        console.error('Error leaving club:', error);
        showToast('Failed to leave club.', 'error');
    }
}

// ==========================================
// EVENTS
// ==========================================
async function loadAllEvents() {
    try {
        const snapshot = await db.collection('events').orderBy('createdAt', 'desc').get();
        const container = document.getElementById('events-list');

        if (snapshot.empty) {
            container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <h4>No upcoming events</h4>
          <p>Check back later for new events!</p>
        </div>`;
            return;
        }

        container.innerHTML = '';
        // Get club names for display
        const clubsSnap = await db.collection('clubs').get();
        const clubNames = {};
        clubsSnap.forEach(doc => { clubNames[doc.id] = doc.data().name; });

        snapshot.forEach(doc => {
            const event = doc.data();
            const dateObj = parseEventDate(event.eventDate);
            const clubName = clubNames[event.clubId] || 'Unknown Club';

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
              <span class="event-detail-item">🎯 ${clubName}</span>
            </div>
            <p style="color:#718096;margin-top:0.5rem;">${event.description || ''}</p>
          </div>
        </div>`;
        });
    } catch (error) {
        console.error('Error loading events:', error);
    }
}

// ==========================================
// ANNOUNCEMENTS
// ==========================================
async function loadAllAnnouncements() {
    try {
        const snapshot = await db.collection('announcements').orderBy('createdAt', 'desc').get();
        const container = document.getElementById('announcements-list');

        if (snapshot.empty) {
            container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📢</div>
          <h4>No announcements yet</h4>
          <p>Check back later!</p>
        </div>`;
            return;
        }

        container.innerHTML = '';
        const clubsSnap = await db.collection('clubs').get();
        const clubNames = {};
        clubsSnap.forEach(doc => { clubNames[doc.id] = doc.data().name; });

        snapshot.forEach(doc => {
            const ann = doc.data();
            const clubName = clubNames[ann.clubId] || 'General';
            container.innerHTML += `
        <div class="announcement-card">
          <div class="announcement-header">
            <span class="announcement-badge">${clubName}</span>
            <span class="announcement-date">${timeAgo(ann.createdAt)}</span>
          </div>
          <div class="announcement-content">
            <h4 style="margin-bottom:0.5rem;color:#2d3748;">${ann.title}</h4>
            <p>${ann.content}</p>
          </div>
        </div>`;
        });
    } catch (error) {
        console.error('Error loading announcements:', error);
    }
}

// ==========================================
// HELPER — Card Builders
// ==========================================
function createEventCard(event, dateObj) {
    return `
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
        </div>
      </div>
    </div>`;
}

function createAnnouncementCard(ann) {
    return `
    <div class="announcement-card">
      <div class="announcement-header">
        <span class="announcement-badge">Announcement</span>
        <span class="announcement-date">${timeAgo(ann.createdAt)}</span>
      </div>
      <div class="announcement-content">
        <h4 style="margin-bottom:0.5rem;color:#2d3748;">${ann.title}</h4>
        <p>${ann.content}</p>
      </div>
    </div>`;
}
