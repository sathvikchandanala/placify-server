const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

const sendJobNotification = async (student, company) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: student.email,
    subject: `New Job Opportunity from ${company.companyname}`,
    html: `
      <h2>Congratulations! You've been shortlisted!</h2>
      <p>Dear ${student.name},</p>
      <p>You have been shortlisted for a new job opportunity at ${company.companyname}.</p>
      <h3>Job Details:</h3>
      <ul>
        <li>CTC: ${company.ctc} LPA</li>
        <li>Interview Date: ${company.doi}</li>
        <li>Job Description: ${company.jobdescription}</li>
      </ul>
      <p>Please log in to your dashboard to apply for this position.</p>
      <p>Best regards,<br>Campus Recruitment Team</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

module.exports = { sendJobNotification };