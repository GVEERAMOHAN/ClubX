# 🎓 ClubHub — College Club Management System

A full-featured Club Management System with **3 user roles**, built with HTML/CSS/JS and **Firebase** (Auth + Firestore).

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML + CSS + JavaScript |
| Authentication | Firebase Auth (Email/Password) |
| Database | Cloud Firestore (NoSQL) |

## 👥 User Roles

| Role | Access |
|------|--------|
| **Admin** | Full control — manage clubs, events, announcements, users |
| **Coordinator** | Manage assigned clubs — events, announcements, member join requests |
| **Student** | Browse clubs, join/leave, view events & announcements |

## 📁 Project Structure

```
club-management-system/
├── index.html              ← Home + Login + Register
├── student.html            ← Student dashboard
├── coordinator.html        ← Coordinator dashboard
├── admin.html              ← Admin dashboard
├── css/
│   └── style.css           ← All styles
├── js/
│   ├── firebase-config.js  ← Firebase init + helpers
│   ├── auth.js             ← Login/Register/Logout
│   ├── student.js          ← Student logic
│   ├── coordinator.js      ← Coordinator logic
│   └── admin.js            ← Admin logic
└── README.md
```

## 🔧 Setup Instructions

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add Project"** → name it (e.g., `club-management`) → Create
3. Go to **Project Settings** → scroll down → click **"Add app"** → choose **Web (</>) **
4. Copy the config object

### Step 2: Add Firebase Config
Open `js/firebase-config.js` and replace the placeholder values:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

### Step 3: Enable Firebase Auth
1. In Firebase Console → **Authentication** → **Get Started**
2. Enable **Email/Password** sign-in method

### Step 4: Create Firestore Database
1. In Firebase Console → **Firestore Database** → **Create Database**
2. Start in **Test Mode** (for development)
3. Choose your region → **Enable**

### Step 5: Create Admin Account
1. Open `index.html` and register as a student or coordinator
2. Go to Firebase Console → Firestore → `users` collection
3. Find your user document → change `role` field to `"admin"`
4. Refresh the page — you'll be redirected to the Admin dashboard

### Step 6: Run the Project
Open `index.html` in a browser using **Live Server** (VS Code extension) or any local server.

> ⚠️ Firebase requires HTTP(S), so opening the file directly (`file://`) won't work. Use Live Server.

## 📊 Firestore Collections

| Collection | Fields |
|------------|--------|
| `users` | name, email, phone, department, year, role, joinedClubs, createdAt |
| `clubs` | name, description, about, icon, coordinatorId, memberCount, createdAt |
| `events` | title, description, clubId, eventDate, time, venue, createdBy, createdAt |
| `announcements` | title, content, clubId, postedBy, createdAt |
| `joinRequests` | studentId, studentName, studentEmail, clubId, status, requestedAt |

## 🎨 Architecture Diagram (for presentation)

```
┌────────────────────────────────────────────────────────┐
│                    FRONTEND (Browser)                  │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ index.html│  │ student.html │  │ coordinator.html │ │
│  │ (Public)  │  │ (Student)    │  │ (Coordinator)    │ │
│  └──────────┘  └──────────────┘  └──────────────────┘ │
│                     ┌──────────────┐                   │
│                     │  admin.html  │                   │
│                     │  (Admin)     │                   │
│                     └──────────────┘                   │
│  ┌─────────────────────────────────────────────────┐   │
│  │              JavaScript (auth.js, *.js)         │   │
│  └────────────────────┬────────────────────────────┘   │
└───────────────────────┼────────────────────────────────┘
                        │ Firebase SDK
┌───────────────────────┼────────────────────────────────┐
│               FIREBASE (Backend-as-a-Service)          │
│  ┌────────────────┐   │   ┌───────────────────────┐    │
│  │  Firebase Auth  │◄──┼──►│  Cloud Firestore (DB) │   │
│  │  (Login/Signup) │   │   │  (NoSQL Database)     │   │
│  └────────────────┘   │   └───────────────────────┘    │
└────────────────────────────────────────────────────────┘
```

## 📝 License

This is a college project. Free to use for educational purposes.
