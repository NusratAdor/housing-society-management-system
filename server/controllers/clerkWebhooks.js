// server/controllers/clerkWebhooks.js
// user.deleted delegates to the shared cascadeDeleteMember service
// function (memberService.js) — the same one used by the
// admin-initiated delete path in adminController.js. One shared
// function backs both delete paths, so a future fix to cascade
// behavior only needs to happen once.

import Member          from "../models/Member.js";
import { Webhook }     from "svix";
import { writeAuditLog }     from "../services/auditService.js";
import { deactivateMember } from "../services/memberService.js";

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
        // Find, do NOT delete — the Member record is preserved (soft
        // delete), matching the same policy as the admin-initiated
        // removal path.
        const member = await Member.findOne({ clerkUserId: data.id });

        if (member && member.status !== "removed") {
          await deactivateMember(member._id, data.id, member.membershipNo, "SYSTEM_CLERK_WEBHOOK");

          writeAuditLog({
            action:      "MEMBER_DELETED",
            performedBy: "SYSTEM_CLERK_WEBHOOK",
            targetId:    member._id,
            description:
              `Clerk user.deleted webhook — removed member ${member.name} ` +
              `(${member.membershipNo}), membership number retired, records preserved`,
            before: { status: "active" },
            after:  { status: "removed" },
            metadata: { source: "clerk_webhook", dataPreserved: true, seatRetired: true },
          });

          console.info(
            `[Webhook] user.deleted — deactivated member + retired seat for ${data.id}`
          );
        } else {
          console.info(
            `[Webhook] user.deleted — no active Member for ${data.id}. Skipped.`
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