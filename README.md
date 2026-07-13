# React + Vite

## DOMIX server

The React app reads and saves application data through a small Python backend
using SQLite. The backend can also serve the built frontend so other computers on
the same LAN can connect by opening the server machine's IP address.

Build and run the LAN server:

```bash
npm.cmd run build
python backend/server.py --host 0.0.0.0 --port 8000
```

On Windows you can just run:

```bat
run.bat
```

Then open this from another machine on the same network:

`http://SERVER_IP:8000`

On first run, if the SQLite database has no user yet, the backend creates:

- Email: `admin@gmail.com`
- Password: `admin123@`
- Role: `admin`

You can override the first admin with `DOMIX_ADMIN_EMAIL` and
`DOMIX_ADMIN_PASSWORD`, or create/update an account manually:

```bash
python backend/server.py --create-user your@gmail.com "STRONG_PASSWORD" admin
```

The account is stored in `data/domix.sqlite3`.

Backend structure:

- `backend/server.py`: thin HTTP routing and static file serving
- `backend/db/`: SQLite connection, schema, migrations, app data, users, sessions
- `backend/services/`: auth and account business logic
- `backend/security.py`: password and token hashing

Chat messages are stored in the `chat_messages` SQLite table. The frontend polls
the chat APIs every 2 seconds for near-realtime updates and unread badges.
Admins can create, rename, delete chat groups, and manage group members.

Create more users:

```bash
python backend/server.py --create-user ketoan@gmail.com "PASSWORD" user
python backend/server.py --create-user sep_xem@gmail.com "PASSWORD" user
```

Roles:

- `admin`: manage accounts and read/write data
- `user`: read/write data

Every logged-in user can change only their own password in the "Tài khoản của tôi"
screen. Admin users can open "Tài khoản" to list, add, edit, lock, and delete
member accounts.

Passwords are stored as PBKDF2-SHA256 hashes in `data/domix.sqlite3`. For network
encryption, run with HTTPS certificates:

```bash
python backend/server.py --host 0.0.0.0 --port 8443 --certfile cert.pem --keyfile key.pem
```

The SQLite file is intentionally ignored by Git.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
