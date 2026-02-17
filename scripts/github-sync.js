/**
 * GitHub Sync - Handles GitHub API integration with write support
 */
class GitHubSync {
    constructor() {
        this.config = {
            owner: 'ZeroDegreeStation',
            repo: 'Calendar',
            branch: 'main',
            token: null
        };
        
        this.apiBase = 'https://api.github.com';
        this.rateLimit = {
            limit: 5000,
            remaining: 5000,
            reset: null
        };
        
        this.loadToken();
        console.log('✅ GitHubSync initialized');
    }

    loadToken() {
        try {
            const savedToken = localStorage.getItem('github_token');
            if (savedToken) {
                this.config.token = savedToken;
                console.log('🔑 GitHub token loaded from storage');
            }
        } catch (error) {
            console.error('Failed to load token:', error);
        }
    }

    setToken(token) {
        if (!token || token.trim() === '') {
            console.error('Invalid token provided');
            return false;
        }
        
        this.config.token = token.trim();
        
        try {
            localStorage.setItem('github_token', this.config.token);
            console.log('🔑 GitHub token saved');
            return true;
        } catch (error) {
            console.error('Failed to save token:', error);
            return false;
        }
    }

    clearToken() {
        this.config.token = null;
        try {
            localStorage.removeItem('github_token');
            console.log('🔑 GitHub token cleared');
        } catch (error) {
            console.error('Failed to clear token:', error);
        }
    }

    getToken() {
        return this.config.token;
    }

    hasToken() {
        return !!this.config.token && this.config.token.length > 0;
    }

    /**
     * Update rate limit from response headers
     */
    updateRateLimit(response) {
        const limit = response.headers.get('x-ratelimit-limit');
        const remaining = response.headers.get('x-ratelimit-remaining');
        const reset = response.headers.get('x-ratelimit-reset');
        
        if (limit) this.rateLimit.limit = parseInt(limit);
        if (remaining) this.rateLimit.remaining = parseInt(remaining);
        if (reset) this.rateLimit.reset = parseInt(reset);
        
        // Warn if running low
        if (this.rateLimit.remaining < 100) {
            const resetDate = this.rateLimit.reset ? new Date(this.rateLimit.reset * 1000) : 'unknown';
            console.warn(`⚠️ Low GitHub API quota: ${this.rateLimit.remaining}/${this.rateLimit.limit} remaining. Resets at ${resetDate}`);
        }
        
        return this.rateLimit;
    }

    /**
     * Check connection to GitHub
     */
    async checkConnection() {
        try {
            if (!this.hasToken()) {
                console.log('No token available');
                return false;
            }
            
            console.log('Checking GitHub connection...');
            
            const response = await fetch(`${this.apiBase}/user`, {
                headers: this.getHeaders()
            });
            
            this.updateRateLimit(response);
            
            if (!response.ok) {
                const error = await response.json();
                console.error('GitHub connection failed:', error);
                return false;
            }
            
            const user = await response.json();
            console.log('✅ Connected to GitHub as:', user.login);
            return true;
            
        } catch (error) {
            console.error('GitHub connection check failed:', error);
            return false;
        }
    }

    /**
     * Get user info from token
     */
    async getUserInfo() {
        try {
            if (!this.hasToken()) return null;
            
            const response = await fetch(`${this.apiBase}/user`, {
                headers: this.getHeaders()
            });
            
            this.updateRateLimit(response);
            
            if (!response.ok) return null;
            
            return await response.json();
        } catch (error) {
            console.error('Failed to get user info:', error);
            return null;
        }
    }

    /**
     * Get file content and SHA from GitHub
     */
    async getFileContent(path) {
        try {
            if (!this.hasToken()) {
                console.log('No token for getFileContent');
                return { content: null, sha: null };
            }
            
            const url = `${this.apiBase}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;
            console.log('Fetching file:', url);
            
            const response = await fetch(url, {
                headers: this.getHeaders()
            });
            
            this.updateRateLimit(response);
            
            if (response.status === 404) {
                console.log('File does not exist yet:', path);
                return { content: null, sha: null };
            }
            
            if (!response.ok) {
                const error = await response.json();
                console.error('Failed to get file:', error);
                return { content: null, sha: null };
            }
            
            const data = await response.json();
            return {
                content: atob(data.content.replace(/\n/g, '')),
                sha: data.sha
            };
            
        } catch (error) {
            console.error('Error fetching file:', error);
            return { content: null, sha: null };
        }
    }

    /**
     * Push bookings to GitHub
     */
    async pushBookings(bookings) {
        return this.pushFile(
            'data/calendar-bookings.xlsx',
            bookings,
            'Bookings',
            `Update bookings: ${bookings.length} total bookings`
        );
    }

    /**
     * Push availability to GitHub
     */
    async pushAvailability(availability) {
        return this.pushFile(
            'data/calendar-availability.xlsx',
            availability,
            'Availability',
            `Update availability: ${availability.length} overrides`
        );
    }

    /**
     * Generic file push method
     */
    async pushFile(path, data, sheetName, commitMessage) {
        if (!this.hasToken()) {
            console.warn('⚠️ GitHub token not configured. Please add token in admin panel.');
            return false;
        }
        
        try {
            console.log(`📤 Pushing ${sheetName} to GitHub...`, data.length);
            
            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
            
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
            
            const { sha } = await this.getFileContent(path);
            
            const url = `${this.apiBase}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;
            const message = `${commitMessage} - ${new Date().toLocaleString()}`;
            
            const body = {
                message: message,
                content: excelBuffer,
                branch: this.config.branch
            };
            
            if (sha) {
                body.sha = sha;
                console.log('Updating existing file with SHA:', sha);
            } else {
                console.log('Creating new file');
            }
            
            const response = await fetch(url, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(body)
            });
            
            this.updateRateLimit(response);
            
            if (!response.ok) {
                const error = await response.json();
                console.error('GitHub API error:', error);
                
                if (response.status === 401) {
                    throw new Error('Authentication failed. Token may be invalid or expired.');
                } else if (response.status === 403) {
                    throw new Error('Permission denied. Token needs "repo" scope.');
                } else if (response.status === 409) {
                    throw new Error('Conflict. The file may have been modified since last fetch.');
                } else {
                    throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
                }
            }
            
            const result = await response.json();
            console.log(`✅ Successfully pushed ${sheetName} to GitHub:`, result.content.sha);
            return true;
            
        } catch (error) {
            console.error(`❌ Error pushing ${sheetName} to GitHub:`, error);
            return false;
        }
    }

    /**
     * Get headers for GitHub API requests
     */
    getHeaders() {
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
        
        if (this.hasToken()) {
            headers['Authorization'] = `token ${this.config.token}`;
        }
        
        return headers;
    }

    /**
     * Get current rate limit status
     */
    getRateLimit() {
        return { ...this.rateLimit };
    }

    /**
     * Get URL to create a new token
     */
    getTokenUrl() {
        return 'https://github.com/settings/tokens/new?scopes=repo&description=Calendar%20Booking%20System';
    }
}

if (typeof window !== 'undefined') {
    window.GitHubSync = GitHubSync;
}