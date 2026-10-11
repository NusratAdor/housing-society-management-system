import Member from "../models/Member.js";
import { verifyWebhook } from "@clerk/express/webhooks";
import { deactivateMember } from "../services/memberService.js";

const clerkWebhooks = async (req, res) => {
  let evt;

  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    console.error("[Webhook] Signature verification failed:", err.message);
    return res.status(400).json({ success: false, message: "Invalid signature" });
  }

  const { data, type } = evt;

  try {
    switch (type) {
      case "user.created": {
        console.info(`[Webhook] user.created — clerkUserId: ${data.id}. Awaiting /create-profile.`);
        break;
      }

      case "user.updated": {
        const primaryEmail = data.email_addresses?.find(
          (email) => email.id === data.primary_email_address_id,
        )?.email_address;

        const update = {};

        // Clerk is the source of truth for the profile IMAGE and EMAIL only.
        // Name is NOT synced: members and admins edit it in this system.
        //
        // A generated default avatar also has an image_url; has_image tells
        // them apart. null => the frontend shows the member's initials.
        if (Object.prototype.hasOwnProperty.call(data, "image_url")) {
          update.profileImageUrl = data.has_image ? data.image_url || null : null;
        }

        if (primaryEmail) update.email = primaryEmail.toLowerCase();

        if (Object.keys(update).length === 0) break;

        const updated = await Member.findOneAndUpdate(
          { clerkUserId: data.id },
          { $set: update },
          { new: true },
        );

        console.info(
          updated
            ? `[Webhook] user.updated — synced Clerk image/email for ${data.id}`
            : `[Webhook] user.updated — no Member for ${data.id}. Skipped.`,
        );
        break;
      }

      case "user.deleted": {
        const member = await Member.findOne({ clerkUserId: data.id });

        if (!member) {
          console.info(`[Webhook] user.deleted — no Member found for ${data.id}. Skipped.`);
          break;
        }

        if (member.status === "removed") {
          console.info(`[Webhook] user.deleted — member ${data.id} already removed. Skipped.`);
          break;
        }

        try {
          // deactivateMember() owns removal, seat retirement and the required
          // MEMBER_REMOVED audit. Do NOT write another audit here.
          await deactivateMember(member._id, member.membershipNo, "SYSTEM_CLERK_WEBHOOK");
          console.info(`[Webhook] user.deleted — deactivated member + retired seat for ${data.id}`);
        } catch (error) {
          if (error.statusCode === 409) {
            // Last active admin: the removal is correctly refused. The Clerk
            // account is already gone, so retrying cannot help; answer 200 and
            // alert a human. (Hook Sentry here if you use it.)
            console.error(
              `[ALERT] Clerk user ${data.id} (member ${member.membershipNo}) was deleted but ` +
                `cannot be removed: ${error.message} Promote another admin, then remove ` +
                `this member from the admin screen.`,
            );
            break;
          }
          throw error;
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