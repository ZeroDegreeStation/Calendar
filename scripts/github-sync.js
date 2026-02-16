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
        
        // Load token from localStorage if exists
        this.loadToken();
        
        console.log('✅ GitHubSync initialized');
    }

    /**
     * Load token from localStorage
     */
    loadToken() {
        const savedToken = localStorage.getItem('github_token');
        if (savedToken) {
            this.config.token = savedToken;
            console.log('🔑 GitHub token loaded from storage');
        }
    }

    /**
     * Set GitHub personal access token
     */
    setToken(token) {
        this.config.token = token;
        localStorage.setItem('github_token', token);
        console.log('🔑 GitHub token saved');
        return true;
    }

    /**
     * Clear token
     */
    clearToken() {
        this.config.token = null;
        localStorage.removeItem('github_token');
        console.log('🔑 GitHub token cleared');
    }

    /**
     * Get token from config
     */
    getToken() {
        return this.config.token;
    }

    /**
     * Check if token is set
     */
    hasToken() {
        return !!this.config.token;
    }

    /**
     * Check connection to GitHub
     */
    async checkConnection() {
        try {
            if (!this.hasToken()) {
                return false;
            }
            
            const response = await fetch(`${this.apiBase}/repos/${this.config.owner}/${this.config.repo}`, {
                headers: this.getHeaders()
            });
            
            return response.ok;
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
                return { content: null, sha: null };
            }
            
            const url = `${this.apiBase}/repos/${this.config.owner}/${this.config.repo}/contents/${path}?ref=${this.config.branch}`;
            const response = await fetch(url, {
                headers: this.getHeaders()
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    return { content: null, sha: null }; // File doesn't exist yet
                }
                throw new Error(`Failed to get file: ${response.statusText}`);
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
        if (!this.hasToken()) {
            console.warn('⚠️ GitHub token not configured. Please add token in admin panel.');
            return false;
        }
        
        try {
            console.log('📤 Pushing bookings to GitHub...', bookings.length);
            
            // Convert bookings to Excel buffer
            const worksheet = XLSX.utils.json_to_sheet(bookings);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Bookings');
            
            // Write to buffer
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
            
            // Get current file to get SHA
            const filePath = 'data/calendar-bookings.xlsx';
            const { sha } = await this.getFileContent(filePath);
            
            // Prepare commit
            const url = `${this.apiBase}/repos/${this.config.owner}/${this.config.repo}/contents/${filePath}`;
            const commitMessage = `Update bookings: ${new Date().toLocaleString()} - ${bookings.length} total bookings`;
            
            const body = {
                message: commitMessage,
                content: excelBuffer,
                branch: this.config.branch
            };
            
            // Add SHA if file exists (for update)
            if (sha) {
                body.sha = sha;
            }
            
            // Push to GitHub
            const response = await fetch(url, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(body)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to push to GitHub');
            }
            
            const result = await response.json();
            console.log('✅ Successfully pushed bookings to GitHub:', result.content.sha);
            return true;
            
        } catch (error) {
            console.error('❌ Error pushing bookings to GitHub:', error);
            return false;
        }
    }

    /**
     * Push availability to GitHub
     */
    async pushAvailability(availability) {
        if (!this.hasToken()) {
            console.warn('⚠️ GitHub token not configured. Please add token in admin panel.');
            return false;
        }
        
        try {
            console.log('📤 Pushing availability to GitHub...', availability.length);
            
            // Convert availability to Excel buffer
            const worksheet = XLSX.utils.json_to_sheet(availability);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Availability');
            
            // Write to buffer
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
            
            // Get current file to get SHA
            const filePath = 'data/calendar-availability.xlsx';
            const { sha } = await this.getFileContent(filePath);
            
            // Prepare commit
            const url = `${this.apiBase}/repos/${this.config.owner}/${this.config.repo}/contents/${filePath}`;
            const commitMessage = `Update availability: ${new Date().toLocaleString()} - ${availability.length} overrides`;
            
            const body = {
                message: commitMessage,
                content: excelBuffer,
                branch: this.config.branch
            };
            
            // Add SHA if file exists
            if (sha) {
                body.sha = sha;
            }
            
            // Push to GitHub
            const response = await fetch(url, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(body)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to push to GitHub');
            }
            
            const result = await response.json();
            console.log('✅ Successfully pushed availability to GitHub:', result.content.sha);
            return true;
            
        } catch (error) {
            console.error('❌ Error pushing availability to GitHub:', error);
            return false;
        }
    }

    /**
     * Push both files in a batch
     */
    async pushAll(bookings, availability) {
        if (!this.hasToken()) {
            return false;
        }
        
        try {
            const bookingsResult = await this.pushBookings(bookings);
            const availabilityResult = await this.pushAvailability(availability);
            
            return bookingsResult && availabilityResult;
        } catch (error) {
            console.error('❌ Error pushing all files:', error);
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
     * Get URL to create a new token
     */
    getTokenUrl() {
        return 'https://github.com/settings/tokens/new?scopes=repo&description=Calendar%20Booking%20System';
    }
}

if (typeof window !== 'undefined') {
    window.GitHubSync = GitHubSync;
}