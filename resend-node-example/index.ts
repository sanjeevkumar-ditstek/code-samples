import { Resend } from 'resend';
import { config } from 'dotenv';
import { getOtpTemplate, getAccountVerifiedTemplate, getLoginSuccessfulTemplate } from './templates/templates';
// Load environment variables from .env file
config();
const resend = new Resend(process.env.API_KEY as string);

(async function() {
  try {
    // Replace with actual values
    const user = 'John Doe';
    const otpCode = '123456';
    const email = 'JohnDoe@example.com';

    const otpHtml = getOtpTemplate(user, otpCode);
    const accountVerifiedHtml = getAccountVerifiedTemplate(user);
    const loginSuccessfulHtml = getLoginSuccessfulTemplate(user);

    // Send OTP email
    const otpEmailData = await resend.emails.send({
      from: 'Acme <onboarding@resend.dev>',
      to: [email],
      subject: 'Your OTP Code',
      html: otpHtml
    });
    console.log('OTP Email Sent:', otpEmailData);

    // Send Account Verified email
    const accountVerifiedEmailData = await resend.emails.send({
      from: 'Acme <onboarding@resend.dev>',
      to: [email],
      subject: 'Account Verified',
      html: accountVerifiedHtml
    });
    console.log('Account Verified Email Sent:', accountVerifiedEmailData);

    // Send Login Successful email
    const loginSuccessfulEmailData = await resend.emails.send({
      from: 'Acme <onboarding@resend.dev>',
      to: [email],
      subject: 'Login Successful',
      html: loginSuccessfulHtml
    });
    console.log('Login Successful Email Sent:', loginSuccessfulEmailData);

  } catch (error) {
    console.error(error);
  }
})();
