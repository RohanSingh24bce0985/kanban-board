# 📋 Enterprise Kanban Board

A secure, full-stack Single Page Application (SPA) for task management. Features include JWT authentication, isolated project boards, an interactive calendar, and real-time analytics. 

Built with Node.js, Express, MongoDB, and Vanilla JavaScript.

## 🏗️ Project Architecture & Folder Structure

Ensure your files are organized exactly like this before running the application:

my-kanban-board/
│
├── Backend/
│   ├── node_modules/       # (Generated after running npm install)
│   ├── .env                # ⚠️ Security variables (You must create this)
│   ├── package.json        # Backend dependencies & scripts
│   ├── package-lock.json   # Dependency lock file
│   └── server.js           # Express API, MongoDB models, & Auth routing
│
├── index.html              # Main SPA Dashboard (Kanban, Calendar, Analytics)
├── login.html              # Authentication UI (Login / Register)
├── style.css               # Global styles & CSS Grid layouts
└── script.js               # Frontend SPA controller & secure API fetcher
