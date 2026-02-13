snow-station-booking/
├── index.html                 # Main website with integrated calendar
├── admin.html                # Admin management panel
├── data/
│   ├── calendar-availability.xlsx    # Availability overrides
│   └── calendar-bookings.xlsx        # Booking records
├── scripts/
│   ├── excel-handler.js      # Excel parsing logic
│   ├── github-sync.js        # GitHub API integration
│   ├── booking-system.js     # Core booking system
│   └── snowstation-integration.js    # Custom integration
└── .github/
    └── workflows/
        └── sync-data.yml     # GitHub Action