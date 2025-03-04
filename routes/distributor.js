const  express = require("express");
const  router = express.Router();
const asyncHandler = require("express-async-handler");
const db = require("../config/db");
const bcrypt = require("bcryptjs");
const protect = require("../config/authMiddleware");
const generateToken = require("../config/generateToken");
const fs=require('fs')
const path = require('path')
const {uploadDir} =require('../config/uploads')
const {s3,S3_BUCKET} = require('../config/aws3');
const { ifError } = require("assert");
const {PutObjectCommand} = require('@aws-sdk/client-s3');
 
// @desc Get user profile
// @route POST /api/users/auth
// @access Public

const createDistributor = asyncHandler(async (req, res) => {
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
    ditributorMargin,
  } = req.body;
  console.log(req.body);

  let files = req.files || {}

  // let aadhar

  const saveFileLocally = (file)=>{
    const filePath = path.join(uploadDir,`${Date.now()}_${file.name}`)
    file.mv(filePath)
    return `/uploads/${path.basename(filePath)}`
  }
  
  const uploadToS3 = async (file) => {
    try {
      
      const uploadParams = {
        Bucket:S3_BUCKET,
        Key:`uploads/${Date.now()}_${file.name}`,
        Body:file.data,
        ContentType:file.miemtype,
        // ACL:'public-read'
      }
  
      const command = new PutObjectCommand(uploadParams)
  
      const result = await s3.send(command)
      
      return `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${uploadParams.Key}`
    } catch (err) {
      console.log('Error uploading to s3',err);
      throw err
      
    }
  }

  if(files.aadharUrl) aadharUrl= await uploadToS3(files.aadharUrl);
  if(files.panUrl) panUrl= await uploadToS3(files.panUrl);
  if(files.profileUrl) profileUrl= await uploadToS3(files.profileUrl);
  if(files.businessUrl) businessUrl= await uploadToS3(files.businessUrl);
  if(files.shopImageUrl) shopImageUrl= await uploadToS3(files.shopImageUrl);
  if(files.cancelledCheckUrl) cancelledCheckUrl= await uploadToS3(files.cancelledCheckUrl);
  const findCustomerSql =
    "select user_mobile,aadhar_number from distributor where user_mobile=? and aadhar_number=?";
  const customerExist = await new Promise((resolve, reject) => {
    db.query(findCustomerSql, [mobile, aadharNumber], (err, result) => {
      if (err) reject(err);
      resolve(result.length>0);
      console.log(result);
      
    });
  });
  console.log(customerExist);
  
  if (customerExist) {
    res.status(400);
    throw new Error("Dealer or Retailer already exists");
  }
  const createUserSql =
    "INSERT INTO distributor ( distributor_id,role_id,user_type,name_as_per_aadhaar,aadhar_number,dob,gender,address,state,district,pincode,user_mobile,user_email,user_password,aadhar_url,pan_number,name_as_per_pan,pan_url,business_name,business_category,business_address,business_state,business_district,business_pincode,business_labour_license_Number,business_proprietor_Name,shop_photo_url,business_ll_url,profile_photo_url,bank_name,account_number,ifsc_code,account_holder_name,cancelled_check_url,doj,kyc_status,comments,distributor_margin,created_timestamp,updated_timestamp) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);";

   function generateUserId(userType,mobile) {
    return new Promise((resolve, reject) => {
      const lastFiveDigits = mobile.slice(-5)
      let userCode=""

      if (userType === 'distributor') {
        userCode = `QPD${lastFiveDigits}`
      } else if (userType === 'retailer') {
        userCode = `QPR${lastFiveDigits}`
      } else{
        reject(new Error('Invalid user type.Must be distributor or retailer'))
      }
      resolve(userCode)
    })
  }
const distributorId = await generateUserId(userType,mobile)

const findDistributorSql = 'select distributor_id from distributor where distributor_id=?'

const distributorExist = await new Promise((resolve, reject) => {
  db.query(findDistributorSql,[distributorId],(err,result)=>{
    if (err) reject(err)
    resolve(result.length>0)
  })
})

if (distributorExist) {
  res.status(400)
  throw new Error("Distributor exists with the given Mobile");
  
}
  await new Promise((resolve, reject) => {
    db.query(
      createUserSql,
      [
        distributorId,
        roleid,
        userType,
        aadharName,
        aadharNumber,
        dob,
        gender,
        address,
        state,
        district,
        pincode,
        mobile,
        email,
        password,
        aadharUrl,
        panNumber,
        panName,
        panUrl,
        businessName,
        businessCategory,
        businessAddress,
        businessState,
        businessDistrict,
        businessPincode,
        businessLabourLicenseNumber,
        businessProprietorName,
        shopImageUrl,
        businessUrl,
        profileUrl,
        bankName,
        accountNumber,
        IFSC,
        accountName,
        cancelledCheckUrl,
        doj,
        status,
        comments,
        ditributorMargin,
        create,
        update,
      ],
      (err, result) => {
        if (err) {
          console.log('step 3',err);
          
          res.status(400);
          
          throw new Error(err);
        }
        console.log(result);
        
        res
          .status(201)
          .json({
            message: "User registered Successfully",
            userId: distributorId,
          });
      }
    );
  });
});
// @desc Get user profile
// @route POST /api/users/auth
// @access Public

const getDistributor = asyncHandler(async (req, res) => {
  const findCustomerSql = "select * from distributor";
  const user = await new Promise((resolve, reject) => {
    db.query(findCustomerSql, (err, result) => {
      if (err) reject(err);
      resolve(result);
    });
  });

  if (user) {
    res.status(201).json(user);
  }
});
// @desc Get user profile
// @route POST /api/users/auth
// @access Public

const updateDistributor = asyncHandler(async (req, res) => {
  res.status(201).json({ message: "Customer updated successfully" });
});
// @desc Get user profile
// @route POST /api/users/auth
// @access Public

const approveDistributor = asyncHandler(async (req, res) => {
  const {distributor,status,create,update} = req.body 
  const password = process.env.DISTRIBUTOR_PSWD
  const distributorExistSql = 'select role_id,distributor_id,user_mobile,user_email,kyc_status from distributor where distributor_id=?'
  try {
    
    const distributorExist = await new Promise((resolve, reject) => {
      db.query(distributorExistSql,[distributor],(err,result)=>{
        if(err) reject(err)
          resolve(result)
      })
    })
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password,salt)
    let updateSql
    let updateParams
  
    if (distributorExist.length===0) {
      return res.status(404).json({message:"Distributor not found"})
    }
    
    const {role_id,distributor_id,user_mobile,user_email} = distributorExist[0]

    if (status==='Approved') {
      // update distributor status
      updateSql ='update distributor set kyc_status=? , user_password=? where distributor_id=?'
      updateParams=[status,hashedPassword,distributor]
      await new Promise((resolve, reject) => {
        db.query(updateSql,updateParams,(err,result)=>{
          if(err) reject(err)
            resolve(result)
        })
      })
      console.log("distributor details",distributorExist.role_id,distributor_id,user_mobile,user_email);

      // create distributor login
      insertSql = 'INSERT INTO login (role_id, user_id,user_password,user_mobile,user_email,created_timestamp,updated_timestamp)VALUES(?,?,?,?,?,?,?)'
      insertParams=[role_id,distributor_id,hashedPassword,user_mobile,user_email,create,update]

      await new Promise((resolve, reject) => {
        db.query(insertSql,insertParams,(err,result)=>{
          if(err) reject(err)
            resolve(result)
        })
      })
      res.status(201).json({ message: "Distributor approved successfully" });
    } else if (status='Rejected') {
      updateSql ='update distributor set kyc_status=? where distributor_id=?'
      updateParams=[status,distributor]
      
      await new Promise((resolve, reject) => {
        db.query(updateSql,updateParams,(err,result)=>{
          if(err) reject(err)
            resolve(result)
        })
      })
      res.status(200).json({message:'Distributor Rejected'})
    } else{
      return res.status(400).json({message:'Inavalid status provided'})
    }    
  } catch (err) {
    res.status(500).json({message:'Internal server error',err})
  }
});

// @desc Get user profile
// @route POST /api/users/auth
// @access Public

const getDistributorDetails = asyncHandler(async (req, res) => {
  const {ditributorId} = req.body
  console.log(req.body);
  
  const getDistributorDetailsSql ='select * from distributor where distributor_id=?'
  const distributor = await new Promise((resolve,reject)=>{
    db.query(getDistributorDetailsSql,[ditributorId],(err,result)=>{
      if(err) reject(err)
        resolve(result)
    })
  })
  if (distributor) {
    res.status(201).json(distributor)
  }
});

router.get("/profile", protect, getDistributor);
router.post("/profile/id", protect, getDistributorDetails);
router.post("/register", protect, createDistributor);
router.put("/profile", protect, updateDistributor);
router.post("/approve", protect, approveDistributor);


module.exports = router;
