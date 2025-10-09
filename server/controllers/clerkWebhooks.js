import Member from "../models/Member.js";
import { Webhook } from "svix";

const clerkWebhooks = async (req, res) => {
  try {
    const whook = new Webhook(process.env.CLERK_WEBHOOK_SECRET);
    const headers = {
      "svix-id": req.headers["svix-id"],
      "svix-timestamp": req.headers["svix-timestamp"],
      "svix-signature": req.headers["svix-signature"],
    };

    // Verify webhook
    await whook.verify(JSON.stringify(req.body), headers);
    console.log("Webhook verification successful");

    const { data, type } = req.body;
    console.log(`Received webhook event: ${type}`, JSON.stringify(data, null, 2));

    switch (type) {
      case "user.updated": {
        const memberData = {
          email: data.email_addresses[0].email_address,
          name: data.first_name + " " + data.last_name,
        };
        const updatedMember = await Member.findOneAndUpdate(
          { clerkUserId: data.id },
          memberData,
          { new: true }
        );
        console.log(
          `Updated member for clerkUserId: ${data.id}, Result: ${
            updatedMember ? "Success" : "Not found"
          }`
        );
        break;
      }

      case "user.deleted": {
        const deletedMember = await Member.findOneAndDelete({ clerkUserId: data.id });
        if (deletedMember) {
          console.log(`Deleted member for clerkUserId: ${data.id}`);
        } else {
          console.log(`No member found for clerkUserId: ${data.id}`);
        }
        break;
      }

      default:
        console.log(`Unhandled webhook event: ${type}`);
        break;
    }

    res.json({ success: true, message: "Webhook Received" });
  } catch (error) {
    console.error(`Webhook error: ${error.message}`);
    res.status(400).json({ success: false, message: error.message });
  }
};

export default clerkWebhooks;