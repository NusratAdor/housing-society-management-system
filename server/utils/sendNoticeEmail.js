// server/utils/sendNoticeEmail.js
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendNoticeEmail = async (to, notice) => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY missing");
  }

  const { title, date, summary, content, image } = notice;

  // FORCE HTTPS + OPTIMIZE IMAGE FOR EMAIL
  const optimizedImageUrl = image
    ? image
        .replace('http://', 'https://')  // Force HTTPS
        .replace('/upload/', '/upload/q_auto,f_auto,w_800,c_limit/') // Optimize + limit width
    : null;

  const data = await resend.emails.send({
    from: `GOHS Notices <${process.env.FROM_EMAIL}>`,
    to: [to],
    subject: `New Notice: ${title}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>New Notice from GOHS</title>
      </head>
      <body style="margin:0; padding:0; background:#f9fafb; font-family:'Segoe UI', Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb; padding:20px 0;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.05);">
                <tr>
                  <td bgcolor="#065f46" style="padding:24px 32px; text-align:center;">
                    <h1 style="margin:0; color:#ffffff; font-size:24px; font-weight:600;">
                      Government Officer's Housing Society
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px;">
                    <h2 style="margin:0 0 8px; color:#1f2937; font-size:20px; font-weight:600;">
                      New Notice Published
                    </h2>
                    <p style="margin:0 0 24px; color:#6b7280; font-size:15px;">
                      A new official notice has been posted for all members.
                    </p>

                    <div style="background:#f0fdf4; border-left:4px solid #10b981; padding:20px; border-radius:0 8px 8px 0;">
                      <h3 style="margin:0 0 8px; color:#166534; font-size:18px; font-weight:600;">
                        ${title}
                      </h3>
                      <p style="margin:0; color:#15803d; font-size:14px; font-weight:500;">
                        ${new Date(date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>

                    ${optimizedImageUrl ? `
                      <div style="text-align:center; margin:28px 0;">
                        <img 
                          src="${optimizedImageUrl}"
                          alt="${title}"
                          style="
                            max-width:100%; 
                            height:auto; 
                            border-radius:8px; 
                            display:block; 
                            margin:0 auto;
                            width:100%;
                            max-height:400px;
                            object-fit:cover;
                          "
                          width="600"
                          loading="eager"
                        />
                      </div>
                    ` : ""}

                    ${summary ? `<p style="margin:20px 0 0; color:#374151; line-height:1.6; font-size:15px;"><strong>Summary:</strong> ${summary}</p>` : ""}

                    <div style="margin:28px 0 0; padding:20px; background:#f9fafb; border-radius:8px; color:#374151; line-height:1.7; font-size:15px;">
                      ${content.replace(/\n/g, "<br/>")}
                    </div>

                    <div style="text-align:center; margin:32px 0 20px;">
                      <a href="https://yourdomain.com/notices" 
                         style="background:#10b981; color:#ffffff; padding:14px 32px; text-decoration:none; border-radius:8px; font-weight:600; font-size:15px; display:inline-block;">
                        View All Notices
                      </a>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td bgcolor="#f3f4f6" style="padding:24px; text-align:center;">
                    <p style="margin:0; color:#6b7280; font-size:13px;">
                      © ${new Date().getFullYear()} Government Officer's Housing Society (GOHS)<br>
                      All rights reserved • Official Communication
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  });

  if (data.error) {
    throw new Error(data.error.message);
  }

  return data;
};