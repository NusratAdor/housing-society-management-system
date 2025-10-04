import Member from "../models/Member.js";
import { Webhook } from "svix";

const clerkWebhooks = async (req, res) => {
  try {
    // Create a svix instance with clerk webhook secret
    const whook = new Webhook(process.env.CLERK_WEBHOOK_SECRET);

    // Getting Headers
    const headers = {
      "svix-id": req.headers["svix-id"],
      "svix-timestamp": req.headers["svix-timestamp"],
      "svix-signature": req.headers["svix-signature"],
    };

    // Verifying Headers
    await whook.verify(JSON.stringify(req.body), headers);

    // Getting Data from request body
    const { data, type } = req.body;

    // Switch Cases for different Users
    switch (type) {
      case "user.created": {
        const memberData = {
          clerkUserId: data.id,
          email: data.email_addresses[0].email_address,
          name: data.first_name + " " + data.last_name,
        };
        await Member.create(memberData);
        break;
      }

      case "user.updated": {
        const memberData = {
          clerkUserId: data.id,
          email: data.email_addresses[0].email_address,
          name: data.first_name + " " + data.last_name,
        };
        await Member.findOneAndUpdate({ clerkUserId: data.id }, memberData);
        break;
      }

      case "user.deleted": {
        await Member.findOneAndDelete({ clerkUserId: data.id });
        break;
      }
      default:
        break;
    }

    res.json({ success: true, message: "Webhook Received" });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

export default clerkWebhooks;