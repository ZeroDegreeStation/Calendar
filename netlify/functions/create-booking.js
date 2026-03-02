const nodemailer = require('nodemailer');
const fetch = require('node-fetch');

// Function to check current availability from public JSON
async function checkAvailability(date, nights = 1) {
  try {
    const response = await fetch(
      `https://raw.githubusercontent.com/ZeroDegreeStation/Calendar/main/public-data/availability.json?t=${Date.now()}`
    );
    
    if (!response.ok) {
      console.log('⚠️ Could not fetch availability data, proceeding anyway');
      return true;
    }
    
    const availability = await response.json();
    
    // Parse dates to check
    const [month, day, year] = date.split('/').map(Number);
    const startDate = new Date(year, month - 1, day);
    
    for (let i = 0; i < nights; i++) {
      const checkDate = new Date(startDate);
      checkDate.setDate(startDate.getDate() + i);
      
      const checkMonth = checkDate.getMonth() + 1;
      const checkDay = checkDate.getDate();
      const checkYear = checkDate.getFullYear();
      const dateStr = `${checkMonth}/${checkDay}/${checkYear}`;
      
      const dayData = availability.find(a => a.date === dateStr);
      if (dayData && dayData.available <= 0) {
        console.log(`❌ Date ${dateStr} is full`);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error checking availability:', error);
    return true; // If error, proceed (GitHub Action will catch)
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const bookingData = JSON.parse(event.body);
    
    console.log('📦 Processing booking:', bookingData.bookingId);
    console.log('Date:', bookingData.date);
    console.log('Nights:', bookingData.nights || 1);

    // ============= CHECK AVAILABILITY FIRST =============
    const isAvailable = await checkAvailability(bookingData.date, bookingData.nights || 1);
    
    if (!isAvailable) {
      console.log('❌ Booking rejected - no availability');
      return {
        statusCode: 409, // Conflict
        body: JSON.stringify({ 
          success: false,
          error: 'Sorry, these dates are no longer available. Please select different dates.',
          code: 'NO_AVAILABILITY'
        })
      };
    }
    // ============= END AVAILABILITY CHECK =============

    // 1. Trigger GitHub Action
    const githubResponse = await fetch(
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

    if (!githubResponse.ok) {
      const errorText = await githubResponse.text();
      console.error('GitHub API error:', githubResponse.status, errorText);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          success: false,
          error: 'Booking system temporarily unavailable. Please try again.',
          code: 'GITHUB_ERROR'
        })
      };
    }

    console.log('✅ GitHub Action triggered successfully');

    // 2. SEND EMAIL VIA GMAIL (only if availability check passed)
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    // Calculate checkout date
    const checkout = bookingData.checkout || (() => {
      const date = new Date(bookingData.date);
      date.setDate(date.getDate() + (bookingData.nights || 1));
      return date.toISOString().split('T')[0];
    })();

    // Format price
    const formattedPrice = bookingData.totalPrice ? 
      `¥${bookingData.totalPrice.toLocaleString()}` : 
      '¥0';

    const mailOptions = {
      from: `"Snow Station Guest House" <${process.env.GMAIL_USER}>`,
      to: bookingData.email,
      subject: `Booking Confirmation: ${bookingData.bookingId}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #2c3e50, #3498db); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">Booking Confirmed!</h1>
            <p style="margin: 10px 0 0; opacity: 0.9;">Snow Station Guest House</p>
          </div>
          
          <div style="padding: 30px; background: #f9f9f9;">
            <p style="font-size: 16px;">Dear <strong>${bookingData.name}</strong>,</p>
            <p>Thank you for choosing Snow Station. Your booking has been confirmed.</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3498db;">
              <h3 style="margin-top: 0; color: #2c3e50;">Booking Details</h3>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Booking ID:</strong></td>
                  <td style="padding: 8px 0; color: #3498db;">${bookingData.bookingId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Check-in:</strong></td>
                  <td style="padding: 8px 0;">${bookingData.date}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Check-out:</strong></td>
                  <td style="padding: 8px 0;">${checkout}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Nights:</strong></td>
                  <td style="padding: 8px 0;">${bookingData.nights || 1}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Guests:</strong></td>
                  <td style="padding: 8px 0;">${bookingData.guests || 1}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Plan:</strong></td>
                  <td style="padding: 8px 0;">${bookingData.plan || 'Standard'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Total:</strong></td>
                  <td style="padding: 8px 0; font-weight: bold; color: #27ae60;">${formattedPrice}</td>
                </tr>
              </table>
            </div>
            
            <h3 style="color: #2c3e50;">Guest House Information</h3>
            <p style="margin: 5px 0;">
              <strong>Address:</strong> 123 Ski Hill Road, Meiho, Japan<br>
              <strong>Check-in:</strong> 15:00 - 22:00<br>
              <strong>Check-out:</strong> 10:00<br>
              <strong>Phone:</strong> +81 123-456-7890
            </p>
            
            <p style="margin-top: 25px;">If you have any questions, please contact us.</p>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="https://snowstation.netlify.app" style="background: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Visit Our Website</a>
            </div>
          </div>
          
          <div style="background: #2c3e50; color: white; padding: 20px; text-align: center; font-size: 14px;">
            <p style="margin: 0;">Snow Station Guest House - Near Meiho Ski Resort</p>
            <p style="margin: 5px 0 0; opacity: 0.8;">Serve Your Convenience</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Confirmation email sent to:', bookingData.email);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        bookingId: bookingData.bookingId,
        message: 'Booking confirmed! Check your email.'
      })
    };

  } catch (error) {
    console.error('❌ Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false,
        error: 'Booking failed. Please try again.',
        code: 'SERVER_ERROR'
      })
    };
  }
};