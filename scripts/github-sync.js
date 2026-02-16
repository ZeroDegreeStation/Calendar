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
<<<<<<< HEAD
=======
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
>>>>>>> parent of a39c6c3 (enabled calendar auto synch from excel)
     * Get file content and SHA from GitHub
     */
    async getFileContent(path) {
        try {
            if (!this.hasToken()) {
                return { content: null, sha: null };
            }
            
<<<<<<< HEAD
            const url = `${this.apiBase}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;
=======
            const url = `${this.apiBase}/repos/${this.config.owner}/${this.config.repo}/contents/${path}?ref=${this.config.branch}`;
>>>>>>> parent of a39c6c3 (enabled calendar auto synch from excel)
            const response = await fetch(url, {
                headers: this.getHeaders()
            });
            
<<<<<<< HEAD
            if (response.status === 404) {
                return { content: null, sha: null, exists: false };
            }
            
            if (!response.ok) {
                const error = await response.json();
                console.error('Failed to get file:', error);
                return { content: null, sha: null, exists: false };
=======
            if (!response.ok) {
                if (response.status === 404) {
                    return { content: null, sha: null }; // File doesn't exist yet
                }
                throw new Error(`Failed to get file: ${response.statusText}`);
>>>>>>> parent of a39c6c3 (enabled calendar auto synch from excel)
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
<<<<<<< HEAD
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
=======
    async pushBookings(bookings) {
>>>>>>> parent of a39c6c3 (enabled calendar auto synch from excel)
        if (!this.hasToken()) {
            console.warn('⚠️ GitHub token not configured');
            return false;
        }
        
        try {
<<<<<<< HEAD
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
=======
            console.log('📤 Pushing bookings to GitHub...', bookings.length);
            
            // Convert bookings to Excel buffer
            const worksheet = XLSX.utils.json_to_sheet(bookings);
>>>>>>> parent of a39c6c3 (enabled calendar auto synch from excel)
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Bookings');
            
            // Write to buffer
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
            
<<<<<<< HEAD
            // STEP 5: Push merged file to GitHub
            const url = `${this.apiBase}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;
            const message = `Update ${sheetName}: ${newData.length} new records (merged with ${exists ? 'existing' : 'new'} data)`;
=======
            // Get current file to get SHA
            const filePath = 'data/calendar-bookings.xlsx';
            const { sha } = await this.getFileContent(filePath);
            
            // Prepare commit
            const url = `${this.apiBase}/repos/${this.config.owner}/${this.config.repo}/contents/${filePath}`;
            const commitMessage = `Update bookings: ${new Date().toLocaleString()} - ${bookings.length} total bookings`;
>>>>>>> parent of a39c6c3 (enabled calendar auto synch from excel)
            
            const body = {
                message: commitMessage,
                content: excelBuffer,
                branch: this.config.branch
            };
            
            // Add SHA if file exists (for update)
            if (sha) {
                body.sha = sha;
<<<<<<< HEAD
                console.log('Updating existing file with SHA:', sha);
=======
>>>>>>> parent of a39c6c3 (enabled calendar auto synch from excel)
            }
            
            // Push to GitHub
            const response = await fetch(url, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(body)
            });
            
            if (!response.ok) {
                const error = await response.json();
<<<<<<< HEAD
                throw new Error(error.message || `HTTP ${response.status}`);
            }
            
            const result = await response.json();
            console.log(`✅ Successfully synced ${sheetName} to GitHub: ${mergedData.length} total records`);
            return true;
            
        } catch (error) {
            console.error(`❌ Error syncing ${sheetName} to GitHub:`, error);
=======
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
>>>>>>> parent of a39c6c3 (enabled calendar auto synch from excel)
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