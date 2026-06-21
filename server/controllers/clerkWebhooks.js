// server/controllers/clerkWebhooks.js
// user.deleted now writes an audit log after cascade deleting the member.
// user.created and user.updated unchanged from previous step.

import Member          from "../models/Member.js";
import Payment         from "../models/Payment.js";
import ExtraCharge     from "../models/ExtraCharge.js";
import Notification    from "../models/Notification.js";
import { Webhook }     from "svix";
import { writeAuditLog } from "../services/auditService.js";

const clerkWebhooks = async (req, res) => {
  // ── Verify signature ──────────────────────────────────────────────────────
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET);
  try {
    await wh.verify(JSON.stringify(req.body), {
      "svix-id":        req.headers["svix-id"],
      "svix-timestamp": req.headers["svix-timestamp"],
      "svix-signature": req.headers["svix-signature"],
    });
  } catch (err) {
    console.error("[Webhook] Signature verification failed:", err.message);
    return res.status(400).json({ success: false, message: "Invalid signature" });
  }

  const { data, type } = req.body;

  try {
    switch (type) {

      case "user.created": {
        // Do not auto-create Member — user must complete /create-profile
        console.info(
          `[Webhook] user.created — clerkUserId: ${data.id}. ` +
          `Awaiting /create-profile.`
        );
        break;
      }

      case "user.updated": {
        const primaryEmail = data.email_addresses?.find(
          e => e.id === data.primary_email_address_id
        )?.email_address;

        if (!primaryEmail) {
          console.warn(
            `[Webhook] user.updated — no primary email for ${data.id}`
          );
          break;
        }

        const updated = await Member.findOneAndUpdate(
          { clerkUserId: data.id },
          {
            $set: {
              email: primaryEmail,
              name:  `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim(),
            },
          },
          { new: true }
        );

        if (updated) {
          console.info(
            `[Webhook] user.updated — synced name+email for ${data.id}`
          );
        } else {
          console.info(
            `[Webhook] user.updated — no Member found for ${data.id}. ` +
            `Skipped (profile not yet created).`
          );
        }
        break;
      }

      case "user.deleted": {
        const member = await Member.findOneAndDelete({ clerkUserId: data.id });

        if (member) {
          // Cascade delete
          await Promise.all([
            Payment.deleteMany({ member: member._id }),
            ExtraCharge.deleteMany({ member: member._id }),
            Notification.deleteMany({ clerkUserId: data.id }),
          ]);

          // Audit log — fire-and-forget
          writeAuditLog({
            action:      "MEMBER_DELETED",
            performedBy: "SYSTEM_CLERK_WEBHOOK",
            targetId:    member._id,
            description:
              `Clerk user.deleted webhook — removed member ${member.name} ` +
              `(${member.membershipNo}) and all related records`,
            before: {
              name:         member.name,
              email:        member.email,
              membershipNo: member.membershipNo,
              clerkUserId:  data.id,
            },
            metadata: { source: "clerk_webhook", cascadeDeleted: true },
          });

          console.info(
            `[Webhook] user.deleted — removed member + data for ${data.id}`
          );
        } else {
          console.info(
            `[Webhook] user.deleted — no Member for ${data.id}. Skipped.`
          );
        }
        break;
      }

      default:
        console.info(`[Webhook] unhandled event: "${type}"`);
        break;
    }

    return res.json({ success: true, message: "Webhook received" });
  } catch (error) {
    console.error(`[Webhook] handler error for "${type}":`, error.message);
    return res.status(500).json({ success: false, message: "Webhook error" });
  }
};

export default clerkWebhooks;