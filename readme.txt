Calendar/ (Public Repository)
│
├── 📄 index.html                 # Main booking page
├── 📄 admin.html                 # Admin dashboard (basic, points to private data)
├── 📄 readme.txt                 # Documentation
│
├── 📁 .github/
│   └── 📁 workflows/
│       └── 📄 process-booking.yml    # GitHub Actions workflow (triggers private repo update)
│       └── 📄 static.yml             # GitHub Actions workflow (deploy github page)
│   └── 📁 scripts/
│       └── 📄 add-booking.js         # Node.js script that processes Excel files
│
├── 📁 scripts/
│   ├── 📄 booking-system.js          # Core booking logic (modified to use workflow)
│   ├── 📄 excel-handler.js           # Excel handling (unchanged)
│   ├── 📄 github-sync.js             # UPDATED: Now triggers workflow, no tokens
│   └── 📄 snowstation-integration.js # UI integration (unchanged)
│
├── 📁 styles/
│   ├── 📄 home.css                    # Main styles
│   └── 📄 calendar.css                # Calendar styles
