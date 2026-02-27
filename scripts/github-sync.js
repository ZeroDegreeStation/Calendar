/**
 * GitHub Sync - Triggers workflow and manages read token
 * UPDATED: Added embedded token fallback for all devices
 * UPDATED: Better success verification
 */
class GitHubSync {
    constructor() {
        this.config = {
            owner: 'ZeroDegreeStation',
            repo: 'Calendar',
            dataRepo: 'Calendar-Data'
        };
        
        // Try localStorage first (admin override), fall back to embedded token
        this.readToken = this.loadReadToken() || this.getEmbeddedToken();
        
        console.log('✅ GitHubSync initialized');
        console.log('🔑 Token source:', this.loadReadToken() ? 'localStorage' : 'embedded');
    }

    // Embedded token for all users
    getEmbeddedToken() {
        // REPLACE WITH YOUR ACTUAL LIMITED PAT
        // This token should have ONLY:
        // - Access to public ZeroDegreeStation/Calendar repo
        // - Permissions: contents:write, metadata:read
        return 'github_pat_YOUR_LIMITED_TOKEN_HERE';
    }

    loadReadToken() {
        try {
            const token = localStorage.getItem('github_read_token');
            if (token) {
                console.log('🔑 Read token loaded from storage');
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
            console.error('Invalid token provided');
            return false;
        }
        
        try {
            localStorage.setItem('github_read_token', token);
            this.readToken = token;
            console.log('✅ Read token saved');
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
        return !!this.readToken && this.readToken.length > 0;
    }

    async pushBookings(bookings) {
        try {
            console.log('📤 Triggering GitHub Actions workflow...');
            
            if (!bookings || bookings.length === 0) {
                console.log('⚠️ No bookings to sync');
                return false;
            }
            
            const latestBooking = bookings[bookings.length - 1];
            console.log('Latest booking:', latestBooking['Booking ID']);
            
            // Prepare the payload
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
            
            console.log('Sending payload to GitHub API...');
            
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
                
                if (response.status === 401) {
                    throw new Error('Authentication failed. Token needs repo scope.');
                } else if (response.status === 404) {
                    throw new Error('Repository or workflow not found');
                } else {
                    throw new Error(`GitHub API error: ${response.status}`);
                }
            }
            
            console.log('✅ Workflow triggered successfully');
            console.log('🔗 Check: https://github.com/ZeroDegreeStation/Calendar/actions');
            
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