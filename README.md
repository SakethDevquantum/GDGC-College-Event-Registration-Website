# Fest-Register — College Technical Event Portal

A modern, full-stack college technical fest and symposia platform designed for engineering campuses. Fest-Register allows students to host hackathons, technical workshops, capture-the-flag (CTF) cyber arenas, and paper presentations with custom Google Forms–style registration fields, discover mutual friends participating in each event, communicate via real-time WebSocket chat, and manage their student profiles.

---

## 🌟 Key Features

### 1. Student Authentication & Profile Management
- **Unique Student Credentials**: Sign in with a unique username and secure password (salted `scrypt` hashing).
- **Academic Profile**: Tracks student name, roll number, college branch (CSE, AI&ML, Data Science, Cyber Security, IT, ECE, EEE, Mechanical, Aeronautical, Civil), study year (1–4), phone number, email address, and profile avatar.
- **Profile Completion Tracker**: Live progress indicator showing profile completion percentage and reminders to add contact details.
- **Account Controls**: Instant sign-out and full student account deletion with a confirmation modal (`"Do you really want to drop your account, this action cannot be undone?"`).

### 2. Immersive Landing Page Experience
- **Cinematic Looping Video Background**: High-definition video background (`Vibrant_Festival_Crowd`) continuously playing and looping with a 2-second delay upon completion.
- **Contained Exclusively to Auth**: Active only on the landing sign-in/registration screen to keep the dashboard clean and focused.

### 3. Technical Event Creation & Form Builder
- **2-Step Wizard**:
  - **Step 1: Event Essentials**: Event title, category tag (Hackathon, Workshop, Symposium, CTF, etc.), venue/lab, detailed markdown description, registration timeline (start & end), event schedule, access level (public vs. mutual friends only), and optional high-resolution event poster upload.
  - **Step 2: Dynamic Form Builder**: Add custom questions for participants with text, numeric, single choice (radio), multiple choice (checkboxes), and dropdown options.
- **High-Resolution Poster Preview Modal**: Click the eye icon on any event card to view the full poster in a pop-up modal with zoom and close controls. Displays `"No poster attached for this event"` when an event has no poster.
- **Event Lifecycle Tracking**: Real-time status indicators (Upcoming, Running, Registration Closed, Outdated) with countdown timers.

### 4. Mutual Friend Tracking & Social Sync
- **Friend Connections**: Add campus peers by username or name to create mutual friendships.
- **Event Mutual Presence**: Event cards highlight registered friends with profile badges and instant checkout details.

### 5. Real-Time Friend Chat
- **WebSocket Synchronization**: Real-time two-way messaging on `/ws/chat`.
- **Live Typing Indicators**: Displays `"<Friend> is typing..."` when the active peer is writing.
- **Image Sharing**: Upload pictures in chat with high-quality preview and one-click local device download.
- **Recipient Notifications**: Live toast notification popup when an incoming message is received (e.g. `Aarav Sharma said "Hi"`).

### 6. Notifications & Schedule Reminders
- **Smart Notification Feed**: Real-time alerts for friend requests, incoming chat messages, event countdowns, and registration email confirmation receipts.
- **Favourites & Ignored Events**: Bookmark events into your personal shortlist or dismiss events from the home feed with one-click restore options.

### 7. Durable Zero-Data-Loss Architecture
- **Dual Persistence Engine**: Native SQLite database (`fest_register.sqlite`) with automated synchronization to disk snapshots (`fest_db_backup.json`).
- Reloading the browser, restarting the development server, or cloning to a new machine preserves all created events, registrations, user profiles, chat messages, and friendships.

---

## 🛠️ Tools & Technologies Used

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **Build Tool & Bundler** | [Vite 8](https://vitejs.dev/) (ESM, Hot Module Replacement) |
| **Styling & Design** | [Tailwind CSS v4](https://tailwindcss.com/) with `@tailwindcss/vite` |
| **Icons & UI Utilities** | [Lucide React](https://lucide.dev/) (Clean icons) & [Motion](https://motion.dev/) (Smooth animations) |
| **Backend & Server** | [Node.js](https://nodejs.org/) (ESM) + [Express 4](https://expressjs.com/) |
| **Real-Time Communication** | [ws (WebSocket)](https://github.com/websockets/ws) for bi-directional live friend messaging |
| **Database & Persistence** | Built-in SQLite via `node:sqlite` (`DatabaseSync`) + disk JSON backup (`fest_db_backup.json`) |
| **Security & Cryptography** | Native Node.js `crypto` with `scrypt` salt-and-hash for password protection |

---

## 🚀 Running in Your Local Environment (VS Code / Antigravity)

Follow these minimal steps to run the complete portal on your local machine with full database, authentication, media, and WebSocket features.

Make sure you made your required changes by adding secret keys and your cloud details in firebase-applet-config.json

### 1. Prerequisites
- **Node.js**: Version **22.5.0 or newer** (Node 22 LTS or Node 24 is recommended for native built-in `node:sqlite` and full ESM support).
  - Verify your version in your terminal:
    ```bash
    node -v
    ```
- **npm** or **bun**: npm (comes pre-bundled with Node.js).
- **Git**: To clone the repository.

### 2. Clone the Repository
```bash
git clone <your-repository-url>
cd <repository-directory>
```

### 3. Install Dependencies
Install all required dependencies:
```bash
npm install
```

### 4. Start the Application
Start the unified full-stack server (runs Express API, WebSockets, SQLite, and Vite dev server together):
```bash
npm run dev
```

The terminal will confirm:
```
Fest-Register server listening on http://localhost:3000
```

### 5. Open in Your Browser
Visit [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🔑 Default Accounts for Testing

The application comes pre-seeded with campus student profiles so you can immediately sign in, test mutual friendships, and try out real-time chat:

| Username | Password | Full Name | Academic Branch |
| :--- | :--- | :--- | :--- |
| `aarav_sharma` | `Student@123` | Aarav Sharma | CSE - AI & ML (Year 3) |
| `diya_nair` | `Student@123` | Diya Nair | CSE (Year 3) |
| `rohan_verma` | `Student@123` | Rohan Verma | ECE (Year 2) |
| `sneha_reddy` | `Student@123` | Sneha Reddy | IT (Year 4) |
| `kabir_mehta` | `Student@123` | Kabir Mehta | CSE - Cyber Security (Year 2) |
| `ananya_iyer` | `Student@123` | Ananya Iyer | Mechanical (Year 1) |

*You can also click **"New? Register"** on the landing page to register any new student account. Default placeholders are pre-filled with `Saketh Reddy`, username `saketh_reddy`, and roll number `24951A05Y8`.*

---

## 📁 Project Directory Structure

```
├── .env.example              # Environment variables template (optional configs)
├── fest_db_backup.json       # Durable JSON database snapshot for zero-config setups
├── fest_register.sqlite      # Active SQLite database file
├── index.html                # Single Page Application HTML entry point
├── package.json              # Project scripts and dependencies
├── public/                   # Static media assets & looping landing background video
│   └── assets/aistudio/      # Vibrant festival crowd video and portal media
├── server.ts                 # Express REST API, SQLite database, and WebSocket server
├── src/
│   ├── App.tsx               # Main application controller, state sync, and navigation
│   ├── main.tsx              # React client entry point
│   ├── index.css             # Tailwind CSS entry point
│   ├── components/           # UI views and modular components
│   │   ├── CreateEventWizard.tsx     # 2-step event creation with dynamic form builder
│   │   ├── EntryScreen.tsx           # Student login & registration forms
│   │   ├── EventCard.tsx             # Interactive event card with poster modal trigger
│   │   ├── EventDetailsView.tsx      # Comprehensive event view & registration flow
│   │   ├── FriendsView.tsx           # Real-time WebSocket chat & friend management
│   │   ├── GoogleFormView.tsx        # Dynamic participant registration questionnaire
│   │   ├── LandingBackgroundVideo.tsx# Fullscreen looping background video
│   │   ├── NotificationsView.tsx     # Student notifications list
│   │   ├── ProfileView.tsx           # Profile editor, sign out & delete account modal
│   │   └── ToastPopup.tsx            # Live message and action notification toasts
│   └── utils/
│       └── eventLogic.ts     # Event scheduling, status calculations & validation logic
├── tsconfig.json             # TypeScript configuration
└── vite.config.ts            # Vite build and dev server configuration
```

---

## ⚙️ Available Scripts

- **`npm run dev`**: Starts the unified full-stack server with Vite middleware on port 3000.
- **`npm run build`**: Compiles TypeScript and creates an optimized production bundle in `dist/`.
- **`npm run start`**: Runs the server in production mode.
- **`npm run lint`**: Runs TypeScript type checking (`tsc --noEmit`).
