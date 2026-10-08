import Member from "../models/Member.js";
import { verifyWebhook } from "@clerk/express/webhooks";
import { deactivateMember } from "../services/memberService.js";

const clerkWebhooks = async (req, res) => {
  let evt;

  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    console.error("[Webhook] Signature verification failed:", err.message);

    return res.status(400).json({
      success: false,
      message: "Invalid signature",
    });
  }

  const { data, type } = evt;

  try {
    switch (type) {
      case "user.created": {
        console.info(
          `[Webhook] user.created — clerkUserId: ${data.id}. ` +
            `Awaiting /create-profile.`,
        );

        break;
      }

      case "user.updated": {
        const primaryEmail = data.email_addresses?.find(
          (email) => email.id === data.primary_email_address_id,
        )?.email_address;

        const update = {};

        const name = `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim();

        if (name) {
          update.name = name;
        }
        /*
         * Clerk image_url is the current profile image URL.
         * Keep it synchronized with the Member document so admin
         * screens can display it without one Clerk request per row.
         */
        if (Object.prototype.hasOwnProperty.call(data, "image_url")) {
          update.profileImageUrl = data.image_url || null;
        }

        /*
         * Email is only updated when Clerk provides a primary email.
         *
         * We intentionally do NOT reject the entire webhook when
         * primary email is temporarily unavailable.
         */
        if (primaryEmail) {
          update.email = primaryEmail;
        }

        const updated = await Member.findOneAndUpdate(
          {
            clerkUserId: data.id,
          },
          {
            $set: update,
          },
          {
            new: true,
          },
        );

        if (updated) {
          console.info(
            `[Webhook] user.updated — synced Clerk identity data for ${data.id}`,
          );
        } else {
          console.info(
            `[Webhook] user.updated — no Member found for ${data.id}. ` +
              `Skipped (profile not yet created).`,
          );
        }

        break;
      }

      case "user.deleted": {
        const member = await Member.findOne({
          clerkUserId: data.id,
        });

        if (!member) {
          console.info(
            `[Webhook] user.deleted — no Member found for ${data.id}. Skipped.`,
          );

          break;
        }

        if (member.status === "removed") {
          console.info(
            `[Webhook] user.deleted — member ${data.id} already removed. Skipped.`,
          );

          break;
        }

        await deactivateMember(
          member._id,
          member.membershipNo,
          "SYSTEM_CLERK_WEBHOOK",
        );

        /*
         * deactivateMember() owns:
         *   - member removal
         *   - MemberSeat retirement
         *   - required MEMBER_REMOVED audit
         *
         * Do NOT write another audit here.
         */
        console.info(
          `[Webhook] user.deleted — deactivated member + retired seat for ${data.id}`,
        );

        break;
      }

      default:
        console.info(`[Webhook] unhandled event: "${type}"`);

        break;
    }

    return res.json({
      success: true,
      message: "Webhook received",
    });
  } catch (error) {
    console.error(`[Webhook] handler error for "${type}":`, error.message);

    return res.status(500).json({
      success: false,
      message: "Webhook error",
    });
  }
};

export default clerkWebhooks;
