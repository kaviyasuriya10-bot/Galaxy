# 🌌 MilkyMemory — Full Flask + MySQL Web App

This package contains the complete MilkyMemory website: frontend + Flask backend + MySQL database + image uploads.

## Project structure

```text
MilkyMemory/
├── app.py
├── requirements.txt
├── schema.sql
├── .env.example
├── README.md
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
└── uploads/
```

## 1. Create the MySQL database

Run `schema.sql` in MySQL, or run:

```sql
CREATE DATABASE milkymemory CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 2. Install Python packages

```bash
python -m venv venv
```

Windows:
```bash
venv\Scripts\activate
```

macOS/Linux:
```bash
source venv/bin/activate
```

Then:

```bash
pip install -r requirements.txt
```

## 3. Configure MySQL

Set the database URL. The easiest option on Windows PowerShell is:

```powershell
$env:DATABASE_URL="mysql+pymysql://root:YOUR_PASSWORD@127.0.0.1:3306/milkymemory"
$env:SECRET_KEY="change-this-to-a-long-random-secret"
```

Or create a `.env` file if you later add python-dotenv.

## 4. Start the website

```bash
python app.py
```

Open:

```text
http://127.0.0.1:5000
```

## What is included

- Create account
- Secure password hashing
- Flask session login/logout
- Per-user private memories
- MySQL persistence
- Create/edit/delete memories
- Image upload
- Galaxy memory stars
- Timeline
- Albums stored in MySQL
- Tags
- Search
- Stats
- Theme and animation controls
- Zoom controls
- Basic AI Companion API
- User isolation: API queries always use the logged-in user's ID

### Important

This is a local/project-ready implementation. For public production deployment, also use HTTPS, a production WSGI server, a strong secret key, secure cookie settings, CSRF protection, rate limiting, and a production database configuration.
