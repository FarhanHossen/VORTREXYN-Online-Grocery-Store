const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_SENDER,
    pass: process.env.EMAIL_PASS
  }
});

const sendConfirmationEmail = (to, subject, htmlContent) => {
  const mailOptions = {
    from: process.env.EMAIL_SENDER,
    to,
    subject,
    html: htmlContent
  };

  return transporter.sendMail(mailOptions);
};

module.exports = sendConfirmationEmail;
