// server/utils/sendNoticeEmail.js
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendNoticeEmail = async (to, notice) => {
  try {
    const { title, date, summary, content, image } = notice;

    await resend.emails.send({
      from: `GOHS Notices <${process.env.FROM_EMAIL}>`,
      to: [to],
      subject: `New Notice: ${title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <h2 style="color: #047857; text-align: center;">Government Officer's Housing Society</h2>
          <hr style="border: 1px solid #e0e0e0;" />
          
          <h3 style="color: #1f2937;">New Notice Published</h3>
          
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h2 style="margin: 0 0 8px 0; color: #1f2937;">${title}</h2>
            <p style="margin: 0; color: #6b7280; font-size: 14px;">Date: ${new Date(date).toLocaleDateString('en-GB')}</p>
          </div>

          ${image ? `<img src="${image}" alt="${title}" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; margin: 16px 0;" />` : ''}

          <p style="color: #374151; line-height: 1.6;"><strong>Summary:</strong> ${summary}</p>
          
          <div style="background: #ecfdf5; padding: 16px; border-left: 4px solid #10b981; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #065f46;">${content.replace(/\n/g, '<br/>')}</p>
          </div>

          <hr style="border: 1px solid #e0e0e0; margin: 30px 0;" />
          
          <p style="text-align: center; color: #6b7280; font-size: 12px;">
            © ${new Date().getFullYear()} GOHS • All rights reserved<br/>
            <a href="https://yourdomain.com/notices" style="color: #10b981;">View all notices →</a>
          </p>
        </div>
      `,
    });

    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error.message);
    // Don't throw – one failed email shouldn't stop notice creation
  }
};