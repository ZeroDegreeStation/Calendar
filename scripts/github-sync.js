/**
 * GitHub Sync - Handles GitHub API integration with write support and MERGE strategy
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
     * Get file content and SHA from GitHub
     */
    async getFileContent(path) {
        try {
            if (!this.hasToken()) {
                return { content: null, sha: null };
            }
            
            const url = `${this.apiBase}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;
            const response = await fetch(url, {
                headers: this.getHeaders()
            });
            
            if (response.status === 404) {
                return { content: null, sha: null, exists: false };
            }
            
            if (!response.ok) {
                const error = await response.json();
                console.error('Failed to get file:', error);
                return { content: null, sha: null, exists: false };
            }
            
            const data = await response.json();
            return {
                content: atob(data.content.replace(/\n/g, '')),
                sha: data.sha,
                exists: true
            };
            
        } catch (error) {
            console.error('Error fetching file:', error);
            return { content: null, sha: null, exists: false };
        }
    }

    /**
     * FIXED: Push bookings to GitHub with MERGE strategy
     */
    async pushBookings(newBookings) {
        return this.pushFileWithMerge(
            'data/calendar-bookings.xlsx',
            newBookings,
            'Bookings',
            'Booking ID' // Unique identifier for deduplication
        );
    }

    /**
     * FIXED: Push availability to GitHub with MERGE strategy
     */
    async pushAvailability(newAvailability) {
        return this.pushFileWithMerge(
            'data/calendar-availability.xlsx',
            newAvailability,
            'Availability',
            'Date' // Unique identifier for deduplication
        );
    }

    /**
     * NEW: Push file with merge strategy - preserves existing data
     */
    async pushFileWithMerge(path, newData, sheetName, idField) {
        if (!this.hasToken()) {
            console.warn('⚠️ GitHub token not configured');
            return false;
        }
        
        try {
            console.log(`📤 Syncing ${sheetName} to GitHub with MERGE strategy...`);
            
            // STEP 1: Get existing file from GitHub
            const { content: existingContent, sha, exists } = await this.getFileContent(path);
            
            let mergedData = [];
            
            if (exists && existingContent) {
                // STEP 2: Parse existing Excel file
                const existingWorkbook = XLSX.read(existingContent, { type: 'binary' });
                const existingSheet = existingWorkbook.Sheets[existingWorkbook.SheetNames[0]];
                const existingData = XLSX.utils.sheet_to_json(existingSheet);
                
                console.log(`📊 Found existing ${sheetName}: ${existingData.length} records`);
                
                // STEP 3: MERGE strategy - combine existing and new data
                // Create a Map for deduplication
                const dataMap = new Map();
                
                // Add existing data first
                existingData.forEach(item => {
                    const key = item[idField];
                    if (key) {
                        dataMap.set(key, item);
                    }
                });
                
                // Add/update with new data
                newData.forEach(item => {
                    const key = item[idField];
                    if (key) {
                        dataMap.set(key, item);
                    } else {
                        // If no ID field, just add it
                        dataMap.set(`new-${Date.now()}-${Math.random()}`, item);
                    }
                });
                
                // Convert back to array
                mergedData = Array.from(dataMap.values());
                
                console.log(`📊 After merge: ${mergedData.length} records (${existingData.length} existing + ${newData.length} new)`);
                
            } else {
                // No existing file, just use new data
                console.log(`📊 No existing file, creating new with ${newData.length} records`);
                mergedData = newData;
            }
            
            // STEP 4: Convert merged data to Excel
            const worksheet = XLSX.utils.json_to_sheet(mergedData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
            
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
            
            // STEP 5: Push merged file to GitHub
            const url = `${this.apiBase}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;
            const message = `Update ${sheetName}: ${newData.length} new records (merged with ${exists ? 'existing' : 'new'} data)`;
            
            const body = {
                message: message,
                content: excelBuffer,
                branch: this.config.branch
            };
            
            if (sha) {
                body.sha = sha;
                console.log('Updating existing file with SHA:', sha);
            }
            
            const response = await fetch(url, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(body)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `HTTP ${response.status}`);
            }
            
            const result = await response.json();
            console.log(`✅ Successfully synced ${sheetName} to GitHub: ${mergedData.length} total records`);
            return true;
            
        } catch (error) {
            console.error(`❌ Error syncing ${sheetName} to GitHub:`, error);
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