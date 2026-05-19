# Housing Society Management System

A housing society management web application with a member dashboard, admin panel, notice board, payment tracking, gallery, FAQs, and secure authentication. New users must create a society member profile after logging in before accessing member features.

---

## ��� What this app is

- A housing society management system
- Supports member profile creation after login
- Includes a dedicated admin panel for society management
- Provides member-facing notices, payment summaries, FAQs, gallery, and notifications
- Not a hotel booking app

---

## ��� Key Features

### Member Experience
- Secure sign in / sign up with Clerk
- Create member profile after login to become a registered member
- Member dashboard with:
  - payment history and status
  - notice previews
  - in-app notifications
  - questions and FAQ support

### Admin Experience
- Manage members
- Create, update, delete notices
- Manage FAQ entries
- Manage community gallery images
- Review payment records

### Common Functionality
- Role-based access control for members and admins
- Protected routes for member and admin sections
- Real-time updates via Socket.io
- Scheduled backend jobs for payment reminders
- Cloudinary for image uploads
- API security with Helmet and rate limiting

---

## ���️ Project Structure

```
housingSociety/
├── client/                    # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── context/           # App state and auth helpers
│   │   ├── i18n/              # Localization setup
│   │   ├── pages/             # Page views
│   │   ├── utils/             # Frontend utilities
   │   └── assets/            # Asset helpers
│   ├── package.json
│   └── README.md
│
├── server/                    # Express backend
│   ├── configs/               # DB and service configuration
│   ├── controllers/           # Route handlers
│   ├── middleware/            # Auth and upload middleware
│   ├── models/                # Mongoose schemas
│   ├── routes/                # API routes
│   ├── services/              # Business logic helpers
│   ├── utils/                 # Utility functions
│   ├── jobs/                  # Cron / scheduled tasks
│   └── server.js              # App entry point
│
└── README.md
```

---

## ��� Setup

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Clerk account for authentication
- Cloudinary account for image uploads
- SSLCommerz account for payment integration (optional)

### Backend Setup

```bash
cd server
npm install
```

Create `server/.env` with:

```env
PORT=5000
MONGODB_URI=your_mongodb_uri
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_WEBHOOK_SECRET=your_clerk_webhook_secret
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
SSL_STORE_ID=your_sslcommerz_store_id
SSL_STORE_PASSWORD=your_sslcommerz_password
EMAIL_USER=your_email_username
EMAIL_PASS=your_email_password
```

Run the backend:

```bash
npm run server
```

### Frontend Setup

```bash
cd client
npm install
```

Create `client/.env` with:

```env
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
VITE_API_URL=http://localhost:5000
```

Run the frontend:

```bash
npm run dev
```

---

## ��� Usage Flow

1. Visit the homepage.
2. Use `/sign-up` or `/sign-in` to authenticate.
3. After signing in, new users are redirected to `/create-profile`.
4. Once a member profile exists, the user can access `/dashboard`.
5. Admin users access `/admin` and manage society operations.

---

## ��� Important Routes

- `/` — Public landing page
- `/sign-in` — Login page
- `/sign-up` — Register page
- `/create-profile` — Member profile creation page
- `/dashboard` — Member dashboard
- `/admin` — Admin panel
- `/notices` — Notice board
- `/gallery` — Gallery page
- `/contact` — Contact page

---

## ��� Tech Stack

### Frontend
- React
- Vite
- Tailwind CSS
- Clerk
- React Router DOM
- Framer Motion
- i18next
- Socket.io Client
- Axios

### Backend
- Node.js + Express
- MongoDB + Mongoose
- Clerk Express middleware
- Socket.io
- Cloudinary
- Nodemailer
- node-cron
- SSLCommerz
- Helmet
- express-rate-limit

---

## ⚠️ Notes

- This project is a **housing society management system**, not a hotel booking application.
- Member access requires profile creation after authentication.
- Admin panel is only available for users with the `admin` role.

---

## ��� License

No license is specified in the repository; add one if you plan to distribute or publish this project.
