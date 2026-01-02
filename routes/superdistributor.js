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
const { Superdistributor, User } = require("../models");
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

    const superdistributorFolder = await generateUserId(userType,mobile);
    console.log("step 1",superdistributorFolder);

    const filePath = `${superdistributorFolder}/${Date.now()}_${file.name}`
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

    if (userType === 'Superdistributor') {
      userCode = `QPSD${lastFiveDigits}`
    } else{
      reject(new Error('Invalid user type. Must be Superdistributor'))
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

const createDistributor = asyncHandler(async (req, res) => {
  try {
    const {
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
      create,
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
      superditributorMargin,
    } = req.body;

    let files = req.files || {};

    let aadharUrl, panUrl, labourLicenseUrl, shopImageUrl, cancelledCheckUrl;

    if (files.aadharUrl)
      aadharUrl = await uploadToS3(files.aadharUrl, userType, mobile);
    if (files.panUrl)
      panUrl = await uploadToS3(files.panUrl, userType, mobile);
    if (files.labourLicenseUrl)
      labourLicenseUrl = await uploadToS3(files.labourLicenseUrl, userType, mobile);
    if (files.shopImageUrl)
      shopImageUrl = await uploadToS3(files.shopImageUrl, userType, mobile);
    if (files.cancelledCheckUrl)
      cancelledCheckUrl = await uploadToS3(files.cancelledCheckUrl, userType, mobile);

    // 🔎 Check if mobile or Aadhaar already exists
    const existingCustomer = await Superdistributor.findOne({
      where: {
        [Op.or]: [
          { user_mobile: mobile },
          { aadhar_number: aadharNumber }
        ]
      }
    });

    if (existingCustomer) {
      return res.status(400).json({
        message: "Aadhar or Mobile number already exists"
      });
    }

    // 🔑 Generate distributor ID
    const superdistributorId = await generateUserId(userType, mobile);

    // Double-check uniqueness
    const superdistributorExist = await Superdistributor.findOne({
      where: { superdistributor_id: superdistributorId }
    });
    if (superdistributorExist) {
      return res.status(400).json({
        message: "Superdistributor exists with the given Mobile"
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // ✅ Create distributor
    await Superdistributor.create({
      superdistributor_id: superdistributorId,
      role_id: roleid,
      user_type: userType,
      name_as_per_aadhaar: encrypt(aadharName),
      aadhar_number: aadharNumber,
      dob: formattedDate(dob),
      gender,
      address,
      state,
      district,
      pincode,
      user_mobile: mobile,
      user_email: email,
      user_password: hashedPassword,
      aadhar_url: aadharUrl,
      pan_number: panNumber,
      name_as_per_pan: panName,
      pan_url: panUrl,
      business_name: businessName,
      business_category: businessCategory,
      business_address: businessAddress,
      business_state: businessState,
      business_district: businessDistrict,
      business_pincode: businessPincode,
      business_labour_license_number: businessLabourLicenseNumber,
      business_proprietor_name: businessProprietorName,
      shop_photo_url: shopImageUrl,
      business_ll_url: labourLicenseUrl,
      bank_name: bankName,
      account_number: accountNumber,
      ifsc_code: IFSC,
      account_holder_name: accountName,
      cancelled_check_url: cancelledCheckUrl,
      doj: formattedDate(doj),
      kyc_status: status,
      comments,
      superdistributor_margin: superditributorMargin,
      created_at: formattedDate(create),
      updated_at: formattedDate(update),
    });

    return res.status(201).json({
      message: "Superdistributor registered successfully",
      userId: superdistributorId,
    });
  } catch (err) {
    console.error("Error creating super distributor:", err);
    res.status(500).json({ message: "Database error", error: err.message });
  }
});

// @desc Get user profile
// @route POST /api/users/auth
// @access Public

const getDistributor = asyncHandler(async (req, res) => {
  try {
    // Fetch all distributors using Sequelize
    const superdistributors = await Superdistributor.findAll();

    if (!superdistributors || superdistributors.length === 0) {
      return res.status(404).json({ message: "No super distributors found" });
    }

    // Convert Sequelize objects → plain JSON + decrypt if needed
    const decryptedData = superdistributors.map((item) => {
      const superdistributor = item.toJSON(); // get plain object

      for (const key in superdistributor) {
        if (isEncrypted(superdistributor[key])) {
          try {
            superdistributor[key] = decrypt(superdistributor[key]);
          } catch (err) {
            console.warn(`Decryption failed for key ${key}`);
          }
        }
      }
      return superdistributor;
    });

    return res.status(200).json(decryptedData);
  } catch (err) {
    console.error("Error fetching super distributors:", err);
    return res.status(500).json({ message: "Failed to fetch super distributors" });
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
      superditributorMargin,
    } = req.body;

    // 🔎 Check if distributor exists
    const superdistributor = await Superdistributor.findByPk(ID);
    if (!superdistributor) {
      return res.status(404).json({ message: "Super distributor not found" });
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
    const newSuperDistributorId = await generateUserId(userType, mobile);

    // 🔐 Handle password hashing (only if updated)
    let hashedPassword = superdistributor.user_password;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password, salt);
    }

    // ✏️ Update fields (only provided ones)
    await Superdistributor.update({
      superdistributor_id: newSuperDistributorId || superdistributor.superdistributor_id,
      role_id: roleid ?? superdistributor.role_id,
      user_type: userType ?? superdistributor.user_type,
      name_as_per_aadhaar: aadharName ?? superdistributor.name_as_per_aadhaar,
      aadhar_number: aadharNumber ?? superdistributor.aadhar_number,
      dob: dob ? formattedDate(dob) : superdistributor.dob,
      gender: gender ?? superdistributor.gender,
      address: address ?? superdistributor.address,
      state: state ?? superdistributor.state,
      district: district ?? superdistributor.district,
      pincode: pincode ?? superdistributor.pincode,
      user_mobile: mobile ?? superdistributor.user_mobile,
      user_email: email ?? superdistributor.user_email,
      user_password: hashedPassword,
      aadhar_url: uploadFiles.aadharUrl || superdistributor.aadhar_url,
      pan_number: panNumber ?? superdistributor.pan_number,
      pan_url: uploadFiles.panUrl || superdistributor.pan_url,
      name_as_per_pan: panName ?? superdistributor.name_as_per_pan,
      business_name: businessName ?? superdistributor.business_name,
      business_category: businessCategory ?? superdistributor.business_category,
      business_address: businessAddress ?? superdistributor.business_address,
      business_state: businessState ?? superdistributor.business_state,
      business_district: businessDistrict ?? superdistributor.business_district,
      business_pincode: businessPincode ?? superdistributor.business_pincode,
      business_labour_license_number:
        businessLabourLicenseNumber ?? superdistributor.business_labour_license_number,
      business_proprietor_name:
        businessProprietorName ?? superdistributor.business_proprietor_name,
      shop_photo_url: uploadFiles.shopImageUrl || superdistributor.shop_photo_url,
      business_ll_url: uploadFiles.labourLicenseUrl || superdistributor.business_ll_url,
      bank_name: bankName ?? superdistributor.bank_name,
      account_number: accountNumber ?? superdistributor.account_number,
      cancelled_check_url:
        uploadFiles.cancelledCheckUrl || superdistributor.cancelled_check_url,
      ifsc_code: IFSC ?? superdistributor.ifsc_code,
      account_holder_name: accountName ?? superdistributor.account_holder_name,
      doj: doj ? formattedDate(doj) : superdistributor.doj,
      kyc_status: status ?? superdistributor.kyc_status,
      comments: comments ?? superdistributor.comments,
      distributor_margin: ditributorMargin ?? superdistributor.distributor_margin,
      updated_at: formattedDate(update) || new Date(),
    });

    return res.status(200).json({
      message: "Superdistributor updated successfully",
      newSuperDistributorId,
    });
  } catch (err) {
    console.error("Error updating super distributor:", err);
    res.status(500).json({ message: "Internal server error", error: err.message });
  }
});

// @desc Get user profile
// @route POST /api/users/auth
// @access Public

const approveDistributor = asyncHandler(async (req, res) => {
  const { superdistributor, status, create, update } = req.body;
  const password = process.env.DISTRIBUTOR_PSWD;

  try {
    // 🔎 Find distributor
    const superdistributorExist = await Superdistributor.findOne({
      where: { superdistributor_id: superdistributor },
      attributes: ["id","role_id", "superdistributor_id", "user_mobile", "user_email", "kyc_status"],
    });

    console.log(superdistributorExist);

    if (!superdistributorExist) {
      return res.status(404).json({ message: "Superdistributor not found" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    if (status === "Approve") {
      await superdistributorExist.update({
        kyc_status: "Approve",
        user_password: hashedPassword,
      },{where:{id:superdistributorExist.id}});

      await User.create({
        role_id: superdistributorExist.role_id,
        user_id: superdistributorExist.superdistributor_id,
        user_password: hashedPassword,
        user_mobile: superdistributorExist.user_mobile,
        user_email: superdistributorExist.user_email,
        created_at: formattedDate(create),
        updated_at: formattedDate(update),
      });

      return res.status(201).json({ message: "Superdistributor approved successfully" });
    }

    else if (status === "Reject") {
      await superdistributorExist.update({ kyc_status: "Reject" });
      return res.status(200).json({ message: "Superdistributor rejected" });
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
    const { superdistributorId } = req.body;

    if (!superdistributorId) {
      return res.status(400).json({ message: "Superdistributor ID is required" });
    }

    // Fetch distributor by ID
    const superdistributor = await Superdistributor.findOne({
      where: { superdistributor_id: superdistributorId },
    });
    console.log(superdistributor);


    if (!superdistributor) {
      return res.status(404).json({ message: "Superdistributor not found" });
    }

    // Convert Sequelize instance → plain object
    const decryptedUser = superdistributor.toJSON();

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
    console.error("Error fetching super distributor details:", err);
    return res.status(500).json({ message: "Failed to fetch super distributor details" });
  }
});


const updateDistributorMargin = asyncHandler(async (req, res) => {
  const { id, margin } = req.body;

  try {
    if (margin === undefined) {
      return res.status(400).json({ error: "Margin is required" });
    }

    // Build where condition dynamically
    const whereCondition = id ? { superdistributor_id: id } : {};

    // Update using Sequelize
    const [rowsUpdated] = await Superdistributor.update(
      { superdistributor_margin: margin },
      { where: whereCondition }
    );

    if (rowsUpdated === 0) {
      return res.status(404).json({ message: "Superdistributor not found or no changes made" });
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

    const [rowsUpdated] = await Superdistributor.update(
      { superdistributor_status: status },
      { where: { superdistributor_id: id } }
    );

    if (rowsUpdated === 0) {
      return res.status(404).json({ message: "Superdistributor not found or no changes made" });
    }

    res.status(200).json({ message: "Status updated successfully" });
  } catch (err) {
    console.error("Error updating distributor status:", err);
    res.status(500).json({ message: "Internal server error", error: err.message });
  }
});


router.get("/profile", protect, getDistributor);
router.post("/profile/id", protect, getDistributorDetails);
router.post("/register", protect, createDistributor);
router.put("/profile", protect, updateDistributor);
router.post("/approve", protect, approveDistributor);
router.put("/update", protect, updateDistributorMargin);
router.put("/status", protect, distributorStatus);


module.exports = router;
