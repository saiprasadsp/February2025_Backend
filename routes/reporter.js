const  express = require("express");
const  router = express.Router();
const asyncHandler = require("express-async-handler");
const db = require("../config/db");
const bcrypt = require("bcryptjs");
const protect = require("../config/authMiddleware");
const path = require('path')
const {uploadDir} =require('../config/uploads')
const {s3,S3_BUCKET} = require('../config/aws3');
const {PutObjectCommand} = require('@aws-sdk/client-s3');
const {encrypt,decrypt} = require('../middleware/encryption');
const {Reports, User } = require("../models");
const { Op, where } = require("sequelize");

const formattedDate =(value)=>{
  const date = new Date(value)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
const uploadToS3 = async (file,userType,mobile) => {
  try {
    if (!file || !file.data) {
      throw new Error('Invalid file provided for upload')
    }

    const distributorFolder = await generateUserId(userType,mobile);
    console.log("step 1",distributorFolder);

    const filePath = `${distributorFolder}/${Date.now()}_${file.name}`
    console.log('step 2',filePath);


    const uploadParams = {
      Bucket:S3_BUCKET,
      Key:`TheQuickPayMe/${filePath}`,
      Body:file.data,
      ContentType:file.mimetype,
      ACL:'public-read'
    }

    const command = new PutObjectCommand(uploadParams)

    const result = await s3.send(command)

    return `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/TheQuickPayMe/${filePath}`
  } catch (err) {
    console.log('Error uploading to s3',err);
    throw err

  }
}
function generateUserId(userType,mobile) {
  return new Promise((resolve, reject) => {
    const lastFiveDigits = mobile.slice(-5)
    let userCode=""

    if (userType === 'reports') {
      userCode = `QPRS${lastFiveDigits}`
    } else{
      reject(new Error('Invalid user type. Must be distributor'))
    }
    resolve(userCode)
  })
}

function isEncrypted(value) {
  return (
    typeof value === "string" &&
    value.includes(":") &&
    value.split(":").length === 2 &&
    /^[0-9a-fA-F]+$/.test(value.split(":")[0])
  );
}


// @desc create distributor profile
// @route POST /api/users/auth
// @access Private

const createReporter = asyncHandler(async (req, res) => {

  try {
    const {
      roleid,
      empId,
      name,
      userType,
      mobile,
      email
    } = req.body;
    const password = process.env.DISTRIBUTOR_PSWD;

    // 🔎 Check if mobile or Aadhaar already exists
    const existingCustomer = await Reports.findOne({
      where: {
        [Op.or]: [
          { reporter_email: email },
          { reporter_mobile: mobile }
        ]
      }
    });

    if (existingCustomer) {
      return res.status(400).json({
        message: "Email already exists"
      });
    }

    // 🔑 Generate distributor ID
    const reporterId = await generateUserId(userType, mobile);

    // Double-check uniqueness
    const reporterExist = await Reports.findOne({
      where: { reporter_id: reporterId },
    });
    if (reporterExist) {
      return res.status(400).json({
        message: "Reporter exists with the given Mobile"
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // ✅ Create distributor
    await Reports.create({
      reporter_id: reporterId,
      reporter_name:name,
      role_id: roleid,
      reporter_emp_id:empId,
      user_type: userType,
      reporter_email: email,
      reporter_password: hashedPassword,
      reporter_mobile:mobile,
      status:'pending'
    });

    await User.create({
            role_id: roleid,
            user_id: reporterId,
            user_password: hashedPassword,
            user_mobile: mobile,
            user_email: email,
            created_at: formattedDate(new Date().toISOString()),
            updated_at: formattedDate(new Date().toISOString()),
          });

    return res.status(201).json({
      message: "Reporter registered successfully",
      userId: reporterId,
    });
  } catch (err) {
    console.error("Error creating reporter:", err);
    res.status(500).json({ message: "Database error", error: err.message });
  }
});

// @desc Get user profile
// @route POST /api/users/auth
// @access Public

const getReporter = asyncHandler(async (req, res) => {
  try {
    // Fetch all distributors using Sequelize
    const reporter = await Reports.findAll();

    if (!reporter || reporter.length === 0) {
      return res.status(404).json({ message: "No reporter found" });
    }

    // Convert Sequelize objects → plain JSON + decrypt if needed
    const decryptedData = reporter.map((item) => {
      const reporter = item.toJSON(); // get plain object

      for (const key in reporter) {
        if (isEncrypted(reporter[key])) {
          try {
            reporter[key] = decrypt(reporter[key]);
          } catch (err) {
            console.warn(`Decryption failed for key ${key}`);
          }
        }
      }
      return reporter;
    });

    return res.status(200).json(decryptedData);
  } catch (err) {
    console.error("Error fetching reporter:", err);
    return res.status(500).json({ message: "Failed to fetch reporter" });
  }
});

// @desc Get user profile
// @route POST /api/users/auth
// @access Public

const updateDistributor = asyncHandler(async (req, res) => {
  try {
    const {
      ID,
      roleid,
      aadharName,
      mobile,
      email,
      password,
      aadharNumber,
      panNumber,
      userType,
      status,
      comments,
      update,
      dob,
      gender,
      address,
      state,
      district,
      pincode,
      panName,
      businessName,
      businessCategory,
      businessAddress,
      businessState,
      businessDistrict,
      businessPincode,
      businessLabourLicenseNumber,
      businessProprietorName,
      bankName,
      accountNumber,
      IFSC,
      accountName,
      doj,
      ditributorMargin,
    } = req.body;

    // 🔎 Check if distributor exists
    const distributor = await Distributor.findByPk(ID);
    if (!distributor) {
      return res.status(404).json({ message: "Distributor not found" });
    }

    // 📂 File uploads
    let files = req.files || {};
    const uploadPromises = [
      "aadharUrl",
      "panUrl",
      "labourLicenseUrl",
      "shopImageUrl",
      "cancelledCheckUrl",
    ].map(async (key) => {
      if (files[key]) {
        return { [key]: await uploadToS3(files[key], userType, mobile) };
      }
      return {};
    });
    const uploadFiles = Object.assign({}, ...(await Promise.all(uploadPromises)));

    // 🔑 Generate new distributor ID if needed
    const newDistributorId = await generateUserId(userType, mobile);

    // 🔐 Handle password hashing (only if updated)
    let hashedPassword = distributor.user_password;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password, salt);
    }

    // ✏️ Update fields (only provided ones)
    await distributor.update({
      distributor_id: newDistributorId || distributor.distributor_id,
      role_id: roleid ?? distributor.role_id,
      user_type: userType ?? distributor.user_type,
      name_as_per_aadhaar: aadharName ?? distributor.name_as_per_aadhaar,
      aadhar_number: aadharNumber ?? distributor.aadhar_number,
      dob: dob ? formattedDate(dob) : distributor.dob,
      gender: gender ?? distributor.gender,
      address: address ?? distributor.address,
      state: state ?? distributor.state,
      district: district ?? distributor.district,
      pincode: pincode ?? distributor.pincode,
      user_mobile: mobile ?? distributor.user_mobile,
      user_email: email ?? distributor.user_email,
      user_password: hashedPassword,
      aadhar_url: uploadFiles.aadharUrl || distributor.aadhar_url,
      pan_number: panNumber ?? distributor.pan_number,
      pan_url: uploadFiles.panUrl || distributor.pan_url,
      name_as_per_pan: panName ?? distributor.name_as_per_pan,
      business_name: businessName ?? distributor.business_name,
      business_category: businessCategory ?? distributor.business_category,
      business_address: businessAddress ?? distributor.business_address,
      business_state: businessState ?? distributor.business_state,
      business_district: businessDistrict ?? distributor.business_district,
      business_pincode: businessPincode ?? distributor.business_pincode,
      business_labour_license_number:
        businessLabourLicenseNumber ?? distributor.business_labour_license_number,
      business_proprietor_name:
        businessProprietorName ?? distributor.business_proprietor_name,
      shop_photo_url: uploadFiles.shopImageUrl || distributor.shop_photo_url,
      business_ll_url: uploadFiles.labourLicenseUrl || distributor.business_ll_url,
      bank_name: bankName ?? distributor.bank_name,
      account_number: accountNumber ?? distributor.account_number,
      cancelled_check_url:
        uploadFiles.cancelledCheckUrl || distributor.cancelled_check_url,
      ifsc_code: IFSC ?? distributor.ifsc_code,
      account_holder_name: accountName ?? distributor.account_holder_name,
      doj: doj ? formattedDate(doj) : distributor.doj,
      kyc_status: status ?? distributor.kyc_status,
      comments: comments ?? distributor.comments,
      distributor_margin: ditributorMargin ?? distributor.distributor_margin,
      updated_at: formattedDate(update) || new Date(),
    });

    return res.status(200).json({
      message: "Distributor updated successfully",
      newDistributorId,
    });
  } catch (err) {
    console.error("Error updating distributor:", err);
    res.status(500).json({ message: "Internal server error", error: err.message });
  }
});

// @desc Get user profile
// @route POST /api/users/auth
// @access Public

const approveDistributor = asyncHandler(async (req, res) => {
  const { distributor, status, create, update } = req.body;
  const password = process.env.DISTRIBUTOR_PSWD;

  try {
    // 🔎 Find distributor
    const distributorExist = await Distributor.findOne({
      where: { distributor_id: distributor },
      attributes: ["id","role_id", "distributor_id", "user_mobile", "user_email", "kyc_status"],
    });

    console.log(distributorExist);

    if (!distributorExist) {
      return res.status(404).json({ message: "Distributor not found" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    if (status === "Approve") {
      await distributorExist.update({
        kyc_status: "Approve",
        user_password: hashedPassword,
      },{where:{id:distributorExist.id}});

      await User.create({
        role_id: distributorExist.role_id,
        user_id: distributorExist.distributor_id,
        user_password: hashedPassword,
        user_mobile: distributorExist.user_mobile,
        user_email: distributorExist.user_email,
        created_at: formattedDate(create),
        updated_at: formattedDate(update),
      });

      return res.status(201).json({ message: "Distributor approved successfully" });
    }

    else if (status === "Reject") {
      await distributorExist.update({ kyc_status: "Reject" });
      return res.status(200).json({ message: "Distributor rejected" });
    }

    else {
      return res.status(400).json({ message: "Invalid status provided" });
    }
  } catch (err) {
    console.error("Error approving distributor:", err);
    res.status(500).json({ message: "Internal server error", error: err.message });
  }
});


// @desc Get user profile
// @route POST /api/users/auth
// @access Public

const getDistributorDetails = asyncHandler(async (req, res) => {
  try {
    const { distributorId } = req.body;

    if (!distributorId) {
      return res.status(400).json({ message: "Distributor ID is required" });
    }

    // Fetch distributor by ID
    const distributor = await Distributor.findOne({
      where: { distributor_id: distributorId },
    });

    if (!distributor) {
      return res.status(404).json({ message: "Distributor not found" });
    }

    // Convert Sequelize instance → plain object
    const decryptedUser = distributor.toJSON();

    // Decrypt fields if encrypted
    for (const key in decryptedUser) {
      if (isEncrypted(decryptedUser[key])) {
        try {
          decryptedUser[key] = decrypt(decryptedUser[key]);
        } catch (err) {
          console.warn(`Decryption failed for key ${key}`);
        }
      }
    }

    return res.status(200).json([decryptedUser]);
  } catch (err) {
    console.error("Error fetching distributor details:", err);
    return res.status(500).json({ message: "Failed to fetch distributor details" });
  }
});


const updateDistributorMargin = asyncHandler(async (req, res) => {
  const { id, margin } = req.body;

  try {
    if (margin === undefined) {
      return res.status(400).json({ error: "Margin is required" });
    }

    // Build where condition dynamically
    const whereCondition = id ? { distributor_id: id } : {};

    // Update using Sequelize
    const [rowsUpdated] = await Distributor.update(
      { distributor_margin: margin },
      { where: whereCondition }
    );

    if (rowsUpdated === 0) {
      return res.status(404).json({ message: "Distributor not found or no changes made" });
    }

    res.status(200).json({ message: "Margin updated successfully" });
  } catch (err) {
    console.error("Error updating margin:", err);
    res.status(500).json({ message: "Internal server error", error: err.message });
  }
});

const distributorStatus = asyncHandler(async (req, res) => {
  const { id, status } = req.body;

  try {
    if (status === undefined) {
      return res.status(400).json({ error: "Status is undefined" });
    }

    const [rowsUpdated] = await Distributor.update(
      { distributor_status: status },
      { where: { distributor_id: id } }
    );

    if (rowsUpdated === 0) {
      return res.status(404).json({ message: "Distributor not found or no changes made" });
    }

    res.status(200).json({ message: "Status updated successfully" });
  } catch (err) {
    console.error("Error updating distributor status:", err);
    res.status(500).json({ message: "Internal server error", error: err.message });
  }
});


router.get("/profile", protect, getReporter);
router.post("/profile/id", protect, getDistributorDetails);
router.post("/register", protect, createReporter);
router.put("/profile", protect, updateDistributor);
router.post("/approve", protect, approveDistributor);
router.put("/update", protect, updateDistributorMargin);
router.put("/status", protect, distributorStatus);


module.exports = router;
