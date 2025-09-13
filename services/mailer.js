const nodemailer = require('nodemailer');

exports.sendResetEmail = async (to, link) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: "kartikscorner@gmail.com", // your email
      pass: "cmvu dgxn dxro kyjq " // app password
    }
  });

  const mailOptions = {
    from: "kartikscorner@gmail.com",
    to,
    subject: 'Password Reset - Student Management System',
    html: `<p>Click the following link to reset your password:</p>
           <a href="${link}">${link}</a>
           <p>This link expires in 1 hour.</p>`
  };

  await transporter.sendMail(mailOptions);
};
