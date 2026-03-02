const nodemailer = require('nodemailer');
const fetch = require('node-fetch');  // ← ADDED THIS LINE

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const bookingData = JSON.parse(event.body);
    
    console.log('📦 Processing booking:', bookingData.bookingId);

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
      console.error('GitHub API error:', await githubResponse.text());
    } else {
      console.log('✅ GitHub Action triggered');
    }

    // 2. SEND EMAIL VIA GMAIL
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    // Calculate checkout date if not provided
    const checkout = bookingData.checkout || (() => {
      const date = new Date(bookingData.date);
      date.setDate(date.getDate() + (bookingData.nights || 1));
      return date.toISOString().split('T')[0];
    })();

    const mailOptions = {
      from: `"Snow Station" <${process.env.GMAIL_USER}>`,
      to: bookingData.email,
      subject: `Booking Confirmation: ${bookingData.bookingId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3498db;">Booking Confirmed!</h2>
          <p>Dear <strong>${bookingData.name}</strong>,</p>
          <p>Your booking at Snow Station Guest House has been confirmed.</p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Booking Details</h3>
            <p><strong>Booking ID:</strong> ${bookingData.bookingId}</p>
            <p><strong>Check-in:</strong> ${bookingData.date}</p>
            <p><strong>Check-out:</strong> ${checkout}</p>
            <p><strong>Nights:</strong> ${bookingData.nights || 1}</p>
            <p><strong>Guests:</strong> ${bookingData.guests || 1}</p>
            <p><strong>Plan:</strong> ${bookingData.plan || 'Standard'}</p>
            <p><strong>Total:</strong> ¥${bookingData.totalPrice?.toLocaleString() || 0}</p>
          </div>
          
          <p><strong>Address:</strong> 123 Ski Hill Road, Meiho, Japan</p>
          <p><strong>Phone:</strong> +81 123-456-7890</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 0.9em;">Thank you for choosing Snow Station!</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Email sent to:', bookingData.email);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        bookingId: bookingData.bookingId 
      })
    };

  } catch (error) {
    console.error('❌ Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Booking failed: ' + error.message })
    };
  }
};