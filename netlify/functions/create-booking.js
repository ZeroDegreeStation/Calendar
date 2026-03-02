const fetch = require('node-fetch');

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Parse booking data
    const bookingData = JSON.parse(event.body);
    
    // Validate required fields
    if (!bookingData.bookingId || !bookingData.date || !bookingData.name || !bookingData.email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    console.log('📦 Processing booking:', bookingData.bookingId);

    // Trigger GitHub Action using token from environment variables
    const response = await fetch(
      `https://api.github.com/repos/${process.env.GITHUB_OWNER || 'ZeroDegreeStation'}/${process.env.GITHUB_REPO || 'Calendar'}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        },
        body: JSON.stringify({
          event_type: 'new-booking',
          client_payload: bookingData
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('GitHub API error:', response.status, error);
      throw new Error(`GitHub API error: ${response.status}`);
    }

    console.log('✅ GitHub Action triggered successfully');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        success: true, 
        bookingId: bookingData.bookingId 
      })
    };

  } catch (error) {
    console.error('❌ Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Booking failed' })
    };
  }
};