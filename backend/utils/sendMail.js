import nodemailer from 'nodemailer';

// Initialize Nodemailer transporter for Zoho
const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.in',
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER, // Your full Zoho email
    pass: process.env.EMAIL_PASSWORD, // Your Zoho app password
  },
  tls: {
    rejectUnauthorized: true
  }
});

// Verify transporter configuration
transporter.verify((error, success) => {
  if (error) {
    console.log('Email configuration error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

// OTP Email Template
const getOTPEmailTemplate = (otp, userName = 'User') => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f9f9f9;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
        }
        .content {
          background: white;
          padding: 30px;
          border-radius: 0 0 10px 10px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .content p {
          margin: 15px 0;
        }
        .otp-box {
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          border: 3px solid #667eea;
          padding: 25px;
          text-align: center;
          font-size: 36px;
          font-weight: bold;
          letter-spacing: 10px;
          color: #667eea;
          margin: 30px 0;
          border-radius: 10px;
          box-shadow: 0 4px 6px rgba(102, 126, 234, 0.2);
        }
        .warning {
          background: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .warning strong {
          color: #856404;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          color: #666;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Hi <strong>${userName}</strong>,</p>
          <p>We received a request to reset your password. Use the verification code below to proceed with resetting your password:</p>
          
          <div class="otp-box">
            ${otp}
          </div>
          
          <div class="warning">
            <strong>⚠️ Important:</strong> This verification code will expire in <strong>5 minutes</strong>. Do not share this code with anyone.
          </div>
          
          <p>If you didn't request a password reset, please ignore this email or contact our support team if you have concerns about your account security.</p>
          
          <p style="margin-top: 30px;">Best regards,<br><strong>Your App Team</strong></p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply to this message.</p>
          <p>&copy; ${new Date().getFullYear()} Unified Calendar View. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Plain text version
const getOTPEmailText = (otp, userName = 'User') => {
  return `
Hi ${userName},

We received a request to reset your password.

Your verification code is: ${otp}

This code will expire in 5 minutes. Do not share this code with anyone.

If you didn't request a password reset, please ignore this email.

Best regards,
Your App Team

---
This is an automated email. Please do not reply.
  `.trim();
};

// Send OTP Email Function
export const sendOTPEmail = async (email, otp, userName = 'User') => {
  try {
    const mailOptions = {
      from: `"Unified Calendar View" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔐 Password Reset Verification Code',
      text: getOTPEmailText(otp, userName),
      html: getOTPEmailTemplate(otp, userName),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ OTP email sent successfully to:', email);
    console.log('Message ID:', info.messageId);
    
    return { 
      success: true, 
      messageId: info.messageId 
    };
  } catch (error) {
    console.error('❌ Error sending OTP email:', error);
    throw new Error('Failed to send OTP email: ' + error.message);
  }
};

// Optional: Send Welcome Email Function
export const sendWelcomeEmail = async (email, userName) => {
  try {
    const mailOptions = {
      from: `"Unified Calendar View" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🎉 Welcome to Unified Calendar View!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Unified Calendar View!</h1>
            </div>
            <div class="content">
              <p>Hi <strong>${userName}</strong>,</p>
              <p>Thank you for signing up! We're excited to have you on board.</p>
              <p>Get started by exploring our features and make the most of your account.</p>
              <p>Best regards,<br><strong>Unified Calendar View Team</strong></p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Welcome email sent successfully');
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    throw new Error('Failed to send welcome email');
  }
};

export default transporter;