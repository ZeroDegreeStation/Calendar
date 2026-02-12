/**
 * GitHub Sync - Handles pushing/pulling data from GitHub
 */
class GitHubSync {
    constructor() {
        this.config = {
            owner: 'ZeroDegreeStation',
            repo: 'Calendar',
            branch: 'main',
            token: null // Add GitHub personal access token in production
        };
        
        this.apiBase = 'https://api.github.com';
    }

    /**
     * Check connection to GitHub
     */
    async checkConnection() {
        try {
            const response = await fetch(`${this.apiBase}/repos/${this.config.owner}/${this.config.repo}`);
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Get file content from GitHub
     */
    async getFileContent(path) {
        try {
            const url = `${this.apiBase}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;
            const headers = this.getHeaders();
            
            const response = await fetch(url, { headers });
            
            if (!response.ok) {
                throw new Error(`Failed to get file: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Decode base64 content
            if (data.content) {
                return atob(data.content);
            }
            
            return null;
        } catch (error) {
            console.error('Error fetching file:', error);
            throw error;
        }
    }

    /**
     * Push booking data to GitHub
     */
    async pushBookings(bookings) {
        if (!this.config.token) {
            console.warn('GitHub token not configured. Changes saved locally only.');
            return false;
        }
        
        try {
            // Convert bookings to Excel buffer
            const worksheet = XLSX.utils.json_to_sheet(bookings);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Bookings');
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
            
            // Get current file SHA
            const filePath = 'data/calendar-bookings.xlsx';
            const currentFile = await this.getFileContent(filePath);
            const sha = currentFile?.sha;
            
            // Update file on GitHub
            const url = `${this.apiBase}/repos/${this.config.owner}/${this.config.repo}/contents/${filePath}`;
            const body = {
                message: 'Update bookings via web app',
                content: excelBuffer,
                branch: this.config.branch
            };
            
            if (sha) {
                body.sha = sha;
            }
            
            const response = await fetch(url, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(body)
            });
            
            if (!response.ok) {
                throw new Error(`Failed to push to GitHub: ${response.statusText}`);
            }
            
            console.log('Successfully pushed to GitHub');
            return true;
            
        } catch (error) {
            console.error('Error pushing to GitHub:', error);
            throw error;
        }
    }

    /**
     * Push availability data to GitHub
     */
    async pushAvailability(availability) {
        if (!this.config.token) return false;
        
        try {
            const worksheet = XLSX.utils.json_to_sheet(availability);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Availability');
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
            
            const filePath = 'data/calendar-availability.xlsx';
            const currentFile = await this.getFileContent(filePath);
            
            const url = `${this.apiBase}/repos/${this.config.owner}/${this.config.repo}/contents/${filePath}`;
            const body = {
                message: 'Update availability via web app',
                content: excelBuffer,
                branch: this.config.branch
            };
            
            if (currentFile?.sha) {
                body.sha = currentFile.sha;
            }
            
            const response = await fetch(url, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(body)
            });
            
            return response.ok;
            
        } catch (error) {
            console.error('Error pushing availability:', error);
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
        
        if (this.config.token) {
            headers['Authorization'] = `token ${this.config.token}`;
        }
        
        return headers;
    }

    /**
     * Set GitHub token
     */
    setToken(token) {
        this.config.token = token;
    }

    /**
     * Get repository info
     */
    async getRepoInfo() {
        try {
            const url = `${this.apiBase}/repos/${this.config.owner}/${this.config.repo}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('Repository not found');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error getting repo info:', error);
            throw error;
        }
    }

    /**
     * Get commit history
     */
    async getCommitHistory(path, limit = 10) {
        try {
            const url = `${this.apiBase}/repos/${this.config.owner}/${this.config.repo}/commits?path=${path}&per_page=${limit}`;
            const response = await fetch(url, {
                headers: this.getHeaders()
            });
            
            if (!response.ok) {
                throw new Error('Failed to get commit history');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error getting commit history:', error);
            return [];
        }
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GitHubSync;
}