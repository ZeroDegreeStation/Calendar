/**
 * GitHub Sync - Triggers workflow
 * UPDATED: Token-free version - uses unauthenticated repository_dispatch
 */
class GitHubSync {
    constructor() {
        this.config = {
            owner: 'ZeroDegreeStation',
            repo: 'Calendar',
            dataRepo: 'Calendar-Data'
        };
        
        // No token loading needed - simplified constructor
        console.log('✅ GitHubSync initialized (token-free mode)');
    }

    // REMOVED: getEmbeddedToken() - no longer needed
    
    // REMOVED: loadReadToken() - no longer needed
    
    // REMOVED: setReadToken() - no longer needed

    // Keep for backward compatibility with admin.html
    getTokenForReading() {
        return null;
    }

    // Keep for backward compatibility
    hasReadToken() {
        return true; // Always return true so bookings proceed
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
            
            // ⚡ NO TOKEN NEEDED! GitHub allows unauthenticated repository_dispatch on public repos
            const response = await fetch(
                `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/dispatches`,
                {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                        // NO AUTHORIZATION HEADER!
                    },
                    body: JSON.stringify(payload)
                }
            );
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('GitHub API error:', response.status, errorText);
                
                if (response.status === 403) {
                    console.warn('⚠️ Rate limit may be exceeded or repo requires authentication');
                } else if (response.status === 404) {
                    throw new Error('Repository or workflow not found');
                } else {
                    throw new Error(`GitHub API error: ${response.status}`);
                }
                return false;
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