// ==========================================
// AUTH MODULE — Login, Register, Logout
// ==========================================

// Listen for auth state changes
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // User is logged in — get their role from Firestore
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                const role = userData.role;
                const currentPage = window.location.pathname.split('/').pop();

                // Redirect to correct role page if not already there
                if (role === 'admin' && currentPage !== 'admin.html') {
                    window.location.href = 'admin.html';
                } else if (role === 'coordinator' && currentPage !== 'coordinator.html') {
                    window.location.href = 'coordinator.html';
                } else if (role === 'student' && currentPage !== 'student.html') {
                    window.location.href = 'student.html';
                }
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    } else {
        // User is NOT logged in — redirect to index if on protected page
        const currentPage = window.location.pathname.split('/').pop();
        if (['student.html', 'coordinator.html', 'admin.html'].includes(currentPage)) {
            window.location.href = 'index.html';
        }
    }
});

// ==========================================
// LOGIN
// ==========================================
async function loginUser(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const userDoc = await db.collection('users').doc(userCredential.user.uid).get();

        if (!userDoc.exists) {
            showToast('User profile not found. Contact admin.', 'error');
            await auth.signOut();
            return;
        }

        const userData = userDoc.data();
        showToast(`Welcome back, ${userData.name}!`, 'success');

        // Redirect based on role
        setTimeout(() => {
            if (userData.role === 'admin') window.location.href = 'admin.html';
            else if (userData.role === 'coordinator') window.location.href = 'coordinator.html';
            else window.location.href = 'student.html';
        }, 500);

    } catch (error) {
        console.error('Login error:', error);
        if (error.code === 'auth/user-not-found') {
            showToast('No account found with this email.', 'error');
        } else if (error.code === 'auth/wrong-password') {
            showToast('Incorrect password.', 'error');
        } else if (error.code === 'auth/invalid-email') {
            showToast('Invalid email address.', 'error');
        } else {
            showToast('Login failed. Please try again.', 'error');
        }
    }
}

// ==========================================
// REGISTER
// ==========================================
async function registerUser(name, email, password, role, department, year, phone) {
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);

        // Create user document in Firestore
        await db.collection('users').doc(userCredential.user.uid).set({
            name: name,
            email: email,
            phone: phone || '',
            department: department || '',
            year: parseInt(year) || 1,
            role: role, // 'student' or 'coordinator'
            joinedClubs: [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('Account created successfully!', 'success');

        // Redirect based on role
        setTimeout(() => {
            if (role === 'coordinator') window.location.href = 'coordinator.html';
            else window.location.href = 'student.html';
        }, 500);

    } catch (error) {
        console.error('Registration error:', error);
        if (error.code === 'auth/email-already-in-use') {
            showToast('Email already registered. Try logging in.', 'error');
        } else if (error.code === 'auth/weak-password') {
            showToast('Password should be at least 6 characters.', 'error');
        } else {
            showToast('Registration failed. Please try again.', 'error');
        }
    }
}

// ==========================================
// LOGOUT
// ==========================================
async function logoutUser() {
    try {
        await auth.signOut();
        showToast('Logged out successfully!', 'success');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500);
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Logout failed.', 'error');
    }
}
