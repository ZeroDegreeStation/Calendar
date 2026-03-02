/**
 * GitHub Sync - Manages read token for admin users only
 * UPDATED: No embedded token - only admin tokens from localStorage
 */
class GitHubSync {
    constructor() {
        this.config = {
            owner: 'ZeroDegreeStation',
            repo: 'Calendar',
            dataRepo: 'Calendar-Data'
        };
        
        // Only load from localStorage - NO embedded token
        this.readToken = this.loadReadToken();
        
        console.log('✅ GitHubSync initialized');
        console.log('🔑 Token exists?', !!this.readToken);
    }

    loadReadToken() {
        try {
            const token = localStorage.getItem('github_read_token');
            if (token) {
                console.log('🔑 Found admin token in localStorage');
                return token;
            }
            return null;
        } catch (e) {
            console.error('Error loading token:', e);
            return null;
        }
    }

    setReadToken(token) {
        if (!token || token.trim() === '') {
            return false;
        }
        
        try {
            localStorage.setItem('github_read_token', token);
            this.readToken = token;
            console.log('✅ Admin token saved');
            return true;
        } catch (e) {
            console.error('Error saving token:', e);
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
        // Only admins with tokens can trigger workflows
        if (!this.hasReadToken()) {
            console.log('ℹ️ No admin token - booking saved locally only');
            return false;
        }
        
        try {
            console.log('📤 Admin triggering GitHub Actions workflow...');
            
            if (!bookings || bookings.length === 0) {
                return false;
            }
            
            const latestBooking = bookings[bookings.length - 1];
            
            const payload = {
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
            };
            
            const response = await fetch(
                `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/dispatches`,
                {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                        'Authorization': `token ${this.readToken}`,
                    },
                    body: JSON.stringify(payload)
                }
            );
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('GitHub API error:', response.status, errorText);
                return false;
            }
            
            console.log('✅ Workflow triggered by admin');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to trigger workflow:', error);
            return false;
        }
    }

    // For backward compatibility
    hasToken() { 
        return this.hasReadToken();
    }
}

if (typeof window !== 'undefined') {
    window.GitHubSync = GitHubSync;
}