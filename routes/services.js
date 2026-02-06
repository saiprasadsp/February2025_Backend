const express = require("express");
const router = express.Router();
const asyncHandler = require("express-async-handler");
const protect = require("../config/authMiddleware");
const db = require("../config/db");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const { where } = require("sequelize");
const { User, ApiPermit } = require("../models");

const formattedDate = (value) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASS,
  },
  tls: {
    rejectUnauthorized: false, // ⛔ not recommended for production
  },
});

transporter.verify((err, success) => {
  if (err) {
    console.error("SMTP Error:", err);
  } else {
    console.log("✅ Gmail server is ready to send messages");
  }
});

const forgotPassword = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findOne({ where: { user_id: userId } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    user.otp = otp;
    user.otp_expiry = otpExpiry;
    await user.save();

    await transporter.sendMail({
      from: process.env.EMAIL,
      to: user.user_email,
      subject: "Password Reset OTP",
      text: `Your OTP for password reset is: ${otp}`,
    });

    res.status(200).json({ message: "OTP sent to your email" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

const verify = asyncHandler(async (req, res) => {
  try {
    const { userId, otp } = req.body;
    const user = await User.findOne({ where: { user_id: userId } });

    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.otp !== otp)
      return res.status(400).json({ message: "Invalid OTP" });
    if (user.otp_expiry < new Date())
      return res.status(400).json({ message: "OTP expired" });

    res.json({ message: "OTP verified successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

const resetPassword = asyncHandler(async (req, res) => {
  try {
    const { userId, password } = req.body;
    const user = await User.findOne({ where: { user_id: userId } });
    console.log(user);

    if (!user) return res.status(404).json({ message: "User not found" });
    // if (user.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });
    // if (user.otp_expiry < new Date()) return res.status(400).json({ message: "OTP expired" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user.user_password = hashedPassword;
    // user.otp = null;
    // user.otp_expiry = null;
    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
const apiLock = asyncHandler(async (req, res, next) => {
  const { userId, status } = req.body;
  console.log(req.body);

  let locked = status != "true" ? "Un-Locked" : "Locked";

  try {
    const [permit, created] = await ApiPermit.findOrCreate({
      where: {
        user_id: userId,
      },
      defaults: {
        status: status,
        created_at: formattedDate(new Date().toISOString()),
        updated_at: formattedDate(new Date().toISOString()),
      },
    });
    if (!created) {
      await permit.update({
        status:status,
        updated_at: formattedDate(new Date().toISOString()),

      })
    }

    return res.status(201).json({ message: `User Api ${locked} successfully` });
  } catch (err) {
    console.log(err);
  }
});
router.post("/forgot-password", forgotPassword);
router.post("/verify", verify);
router.post("/reset-password", resetPassword);
router.post("/api-lock", apiLock);
module.exports = router;
