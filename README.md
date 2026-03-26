# Classroom Management System

Basic but complete Node.js + Express backend for a classroom management platform.

## Features

- User registration and login with JWT
- Role-based access for admin, teacher, and student
- Class creation and student enrollment
- Assignment creation, submission, and grading
- Admin user management and reporting
- MySQL schema included for quick setup

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and update database credentials.

3. Initialize the database:

```bash
npm run init-db
```

4. Start the server:

```bash
npm run dev
```

## API Base URL

`http://localhost:3000`

## Main Routes

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/verify`
- `POST /api/classes`
- `GET /api/classes`
- `POST /api/classes/enroll`
- `GET /api/classes/:id/students`
- `POST /api/assignments`
- `GET /api/assignments/class/:classId`
- `POST /api/assignments/:id/submit`
- `POST /api/assignments/:id/grade`
- `GET /api/admin/users`
- `GET /api/admin/reports`

## Notes

- File uploads are stored in the `uploads/` folder.
- Authorization header format: `Bearer <token>`
- You should create at least one `admin` user using the register route.
