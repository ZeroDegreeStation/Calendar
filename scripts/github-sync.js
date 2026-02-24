/**
 * GitHub Sync - Triggers GitHub Actions workflow (secure, no tokens in browser)
 */
class GitHubSync {
    constructor() {
        this.config = {
            owner: 'ZeroDegreeStation',
            repo: 'Calendar'
        };
        
        console.log('✅ GitHubSync initialized (GitHub Actions mode)');
    }

    hasToken() { 
        // Always return true - server handles auth
        return true; 
    }
    
    async pushBookings(bookings) {
        try {
            console.log('📤 Triggering GitHub Actions workflow...');
            
            // Get the latest booking (the one just added)
            const latestBooking = bookings[bookings.length - 1];
            
            // Trigger the GitHub Actions workflow via repository_dispatch API
            const response = await fetch(
                `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/dispatches`,
                {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        event_type: 'new-booking',
                        client_payload: {
                            bookingId: latestBooking['Booking ID'],
                            name: latestBooking['Customer Name'],
                            email: latestBooking.Email,
                            phone: latestBooking.Phone || '',
                            date: latestBooking.Date,
                            guests: latestBooking.Guests,
                            plan: latestBooking.Plan,
                            planPrice: latestBooking['Plan Price'],
                            totalPrice: latestBooking['Total Price'],
                            requests: latestBooking['Special Requests'] || ''
                        }
                    })
                }
            );
            
            if (!response.ok) {
                const error = await response.json();
                console.error('GitHub API error:', error);
                throw new Error(`GitHub API error: ${response.status}`);
            }
            
            console.log('✅ Workflow triggered successfully');
            console.log('⏳ Booking will be processed within a few minutes');
            
            return true;
            
        } catch (error) {
            console.error('❌ Failed to trigger workflow:', error);
            return false;
        }
    }
    
    // Keep for compatibility
    async pushAvailability(availability) {
        console.log('ℹ️ Availability sync not implemented in this version');
        return true;
    }
    
    async pushAll(bookings, availability) {
        await this.pushBookings(bookings);
        return true;
    }
}

if (typeof window !== 'undefined') {
    window.GitHubSync = GitHubSync;
}