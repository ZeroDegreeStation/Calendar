/**
 * GitHub Sync - Triggers workflow and manages read token
 */
class GitHubSync {
    constructor() {
        this.config = {
            owner: 'ZeroDegreeStation',
            repo: 'Calendar',
            dataRepo: 'Calendar-Data'
        };
        
        this.readToken = this.loadReadToken();
        
        console.log('✅ GitHubSync initialized');
    }

    loadReadToken() {
        try {
            const token = localStorage.getItem('github_read_token');
            return token || null;
        } catch (e) {
            return null;
        }
    }

    setReadToken(token) {
        if (!token) return false;
        try {
            localStorage.setItem('github_read_token', token);
            this.readToken = token;
            return true;
        } catch (e) {
            return false;
        }
    }

    getTokenForReading() {
        return this.readToken;
    }

    hasReadToken() {
        return !!this.readToken;
    }

    async pushBookings(bookings) {
        try {
            console.log('📤 Triggering GitHub Actions workflow...');
            
            const latestBooking = bookings[bookings.length - 1];
            
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
                throw new Error(`GitHub API error: ${response.status}`);
            }
            
            console.log('✅ Workflow triggered successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to trigger workflow:', error);
            return false;
        }
    }

    // Keep for compatibility
    hasToken() { 
        return this.hasReadToken();
    }
}

if (typeof window !== 'undefined') {
    window.GitHubSync = GitHubSync;
}