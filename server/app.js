const express = require("express");
const cors = require("cors");
const clerk = require("@clerk/clerk-sdk-node");
const mongoose = require("mongoose");

const app = express();

app.use(cors());
app.use(express.json());
app.use(clerk.expressWithAuth());

const requireAdmin = async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const user = await clerk.users.getUser(userId);
    if (user.publicMetadata.role === "admin") {
      next();
    } else {
      res.status(403).json({ message: "Admin access required" });
    }
  } catch (err) {
    res.status(401).json({ message: "Unauthorized" });
  }
};

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.use("/api/members", require("./routes/members"));
app.use("/api/notices", requireAdmin, require("./routes/notices"));
app.use("/api/faqs", require("./routes/faqs"));
app.use("/api/clerk", require("./routes/clerk"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));