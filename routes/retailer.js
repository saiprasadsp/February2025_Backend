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
      throw new Error("Invalid file provided for upload");

    }
    const retailerId = await generateUserId(userType,mobile)
    const filePath = `${retailerId}/${Date.now()}_${file.name}`

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

    if (userType === 'retailer') {
      userCode = `QPR${lastFiveDigits}`
    } else{
      reject(new Error('Invalid user type. Must be retailer'))
    }
    resolve(userCode)
  })
}
const createRetailer = asyncHandler(async (req, res) => {
    const {
      distributorId,
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
      retailerPercentage,
    } = req.body;
    console.log(req.body);

    let files = req.files || {}


    if(files.aadharUrl) aadharUrl= await uploadToS3(files.aadharUrl,userType,mobile);
    if(files.panUrl) panUrl= await uploadToS3(files.panUrl,userType,mobile);
    // if(files.profileUrl) profileUrl= await uploadToS3(files.profileUrl);
    if(files.labourLicenseUrl) labourLicenseUrl= await uploadToS3(files.labourLicenseUrl,userType,mobile);
    if(files.shopImageUrl) shopImageUrl= await uploadToS3(files.shopImageUrl,userType,mobile);
    if(files.cancelledCheckUrl) cancelledCheckUrl= await uploadToS3(files.cancelledCheckUrl,userType,mobile);

    const findCustomerSql =
      "select user_mobile,aadhar_number from retailer where user_mobile=? or aadhar_number=?";
    const customerExist = await new Promise((resolve, reject) => {
      db.query(findCustomerSql, [mobile, aadharNumber], (err, result) => {
        if (err) reject(err);
        console.log("step 10",result);
        resolve(result.length>0);

      });
    });
    console.log("step 11",customerExist);

    if (customerExist) {
      res.status(400);
      throw new Error("Aadhar or Mobile number already exists");
    }
    const createUserSql =
      "INSERT INTO retailer ( distributor_id,retailer_id,role_id,user_type,name_as_per_aadhaar,aadhar_number,dob,gender,address,state,district,pincode,user_mobile,user_email,user_password,aadhar_url,pan_number,name_as_per_pan,pan_url,business_name,business_category,business_address,business_state,business_district,business_pincode,business_labour_license_Number,business_proprietor_Name,shop_photo_url,business_ll_url,bank_name,account_number,ifsc_code,account_holder_name,cancelled_check_url,doj,kyc_status,comments,retailer_percentage,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);";

  const retailerId = await generateUserId(userType,mobile)

  const findRetailerSql = 'select distributor_id from distributor where distributor_id=?'

  const distributorExist = await new Promise((resolve, reject) => {
    db.query(findRetailerSql,[retailerId],(err,result)=>{
      if (err) reject(err)
      resolve(result.length>0)
    })
  })

  if (distributorExist) {
    res.status(400)
    throw new Error("Retailer exists with the given Mobile");

  }
    await new Promise((resolve, reject) => {
      db.query(
        createUserSql,
        [
          distributorId,
          retailerId,
          roleid,
          userType,
          aadharName,
          aadharNumber,
          formattedDate(dob),
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
          labourLicenseUrl,
          bankName,
          accountNumber,
          IFSC,
          accountName,
          cancelledCheckUrl,
          formattedDate(doj),
          status,
          comments,
          retailerPercentage,
          formattedDate(create),
          formattedDate(update),
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
              message: "Retailer registered Successfully",
              userId: retailerId,
            });
        }
      );
    });
  });


const getRetailer = asyncHandler(async (req, res) => {
  const {distributor} = req.body
  console.log(distributor);

  let  findRetailerSql = "select * from retailer"
  let value=[]
  if (distributor) {
     findRetailerSql = "select * from retailer where distributor_id=?";
    value=[distributor]
  }
  try {
    const user = await new Promise((resolve, reject) => {
        db.query(findRetailerSql,value, (err, result) => {
        if (err) reject(err);
        resolve(result);
        });
    });

    if (user.length>0) {
        res.status(201).json(user);
    }else{
      return res.status(400).json({message:'No retailer found'})
    }

  } catch (err) {
    res.status(500).json({message:'Database error',err})
  }
});

const updateRetailer = asyncHandler(async(req,res)=>{
  try {
    const {
      ID,
      distributorId,
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
      retailerPercentage} = req.body

      console.log('Step 10',req.body);

      let files = req.files ||{}

      const uploadPromises =["aadharUrl","panUrl","labourLicenseUrl","shopImageUrl","cancelledCheckUrl"].map(async(key)=>{
        if (files[key]) {
          return {[key]:await uploadToS3(files[key],userType,mobile)}
        }
        return{[key]:null}
      })

      const uploadFiles =Object.assign({},...(await Promise.all(uploadPromises)))
    const updateRetailerSql = `UPDATE retailer
            SET
                distributor_id = COALESCE(?, distributor_id),
                retailer_id = COALESCE(?,retailer_id),
                role_id = COALESCE(?, role_id),
                user_type = COALESCE(?, user_type),
                name_as_per_aadhaar = COALESCE(?, name_as_per_aadhaar),
                aadhar_number = COALESCE(?, aadhar_number),
                dob = COALESCE(?, dob),
                gender = COALESCE(?, gender),
                address = COALESCE(?, address),
                state = COALESCE(?, state),
                district = COALESCE(?, district),
                pincode = COALESCE(?, pincode),
                user_mobile = COALESCE(?, user_mobile),
                user_email = COALESCE(?, user_email),
                user_password = COALESCE(?, user_password),
                aadhar_url=COALESCE(?, aadhar_url),
                pan_number = COALESCE(?, pan_number),
                pan_url = COALESCE(?, pan_url),
                name_as_per_pan = COALESCE(?, name_as_per_pan),
                business_name = COALESCE(?, business_name),
                business_category = COALESCE(?, business_category),
                business_address = COALESCE(?, business_address),
                business_state = COALESCE(?, business_state),
                business_district = COALESCE(?, business_district),
                business_pincode = COALESCE(?, business_pincode),
                business_labour_license_Number = COALESCE(?, business_labour_license_Number),
                business_proprietor_Name = COALESCE(?, business_proprietor_Name),
                shop_photo_url = COALESCE(?, shop_photo_url),
                business_ll_url = COALESCE(?, business_ll_url),
                bank_name = COALESCE(?, bank_name),
                account_number = COALESCE(?, account_number),
                cancelled_check_url = COALESCE(?, cancelled_check_url),
                ifsc_code = COALESCE(?, ifsc_code),
                account_holder_name = COALESCE(?, account_holder_name),
                doj = COALESCE(?, doj),
                kyc_status = COALESCE(?, kyc_status),
                comments = COALESCE(?, comments),
                retailer_percentage = COALESCE(?, retailer_percentage),
                updated_timestamp = COALESCE(?, updated_timestamp)
              WHERE ID = ?`;

    const newRetailerId  = await generateUserId(userType,mobile)

    await new Promise((resolve, reject) => {
      db.query(updateRetailerSql,[
        distributorId,
        newRetailerId,
        roleid,
        userType,
        aadharName,
        aadharNumber,
        formattedDate(dob),
        gender,
        address,
        state,
        district,
        pincode,
        mobile,
        email,
        password,
        uploadFiles.aadharUrl,
        panNumber,
        uploadFiles.panUrl,
        panName,
        businessName,
        businessCategory,
        businessAddress,
        businessState,
        businessDistrict,
        businessPincode,
        businessLabourLicenseNumber,
        businessProprietorName,
        uploadFiles.shopImageUrl,
        uploadFiles.labourLicenseUrl,
        bankName,
        accountNumber,
        uploadFiles.cancelledCheckUrl,
        IFSC,
        accountName,
        formattedDate(doj),
        status,
        comments,
        retailerPercentage,
        formattedDate(update),
        ID],(err,result)=>{
          if (err) {
            console.log('Error in updating retailer',err);
            res.status(500).json({message:'Database update failed'})
            reject(err)
          }
          else{
            res.status(201).json({message:"Retailer updated successfully",newRetailerId})
            resolve(result)
          }
        })
    })
  } catch (err) {
    console.log(err);
    res.status(500).json({message:'Internal server error',err})
  }
})

const approveRetailer = asyncHandler(async (req, res) => {
  console.log(req.body);

  const {retailer,status,create,update} = req.body
  const password = process.env.RETAILER_PSWD
  console.log("step 1",password);

  const retailerExistSql = 'select role_id,retailer_id,user_mobile,user_email,kyc_status from retailer where retailer_id=?'
  try {

    const retailerExist = await new Promise((resolve, reject) => {
      db.query(retailerExistSql,[retailer],(err,result)=>{
        if(err) reject(err)
          console.log("step 2",result);

          resolve(result)
      })
    })
    console.log('step 3',retailerExist);

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password,salt)
    let updateSql
    let updateParams

    if (retailerExist.length===0) {
      return res.status(404).json({message:"Retailer not found"})
    }

    const {role_id,retailer_id,user_mobile,user_email} = retailerExist[0]

    if (status==='Approve') {
      // update retailer status
      updateSql ='update retailer set kyc_status=? , user_password=? where retailer_id=?'
      updateParams=[status,hashedPassword,retailer]
      await new Promise((resolve, reject) => {
        db.query(updateSql,updateParams,(err,result)=>{
          if(err) reject(err)
            resolve(result)
        })
      })

      // create retailer login
      insertSql = 'INSERT INTO users (role_id, user_id,user_password,user_mobile,user_email,created_at,updated_at)VALUES(?,?,?,?,?,?,?)'
      insertParams=[role_id,retailer_id,hashedPassword,user_mobile,user_email,formattedDate(create),formattedDate(update)]

      await new Promise((resolve, reject) => {
        db.query(insertSql,insertParams,(err,result)=>{
          if(err) reject(err)
            resolve(result)
        })
      })
      res.status(201).json({ message: "Retailer approved successfully" });
    } else if (status==='Reject') {
      updateSql ='update retailer set kyc_status=? where retailer_id=?'
      updateParams=[status,retailer]

      await new Promise((resolve, reject) => {
        db.query(updateSql,updateParams,(err,result)=>{
          if(err) reject(err)
            resolve(result)
        })
      })
      res.status(200).json({message:'Retailer Rejected'})
    } else{
      return res.status(400).json({message:'Inavalid status provided'})
    }
  } catch (err) {
    res.status(500).json({message:'Internal server error',err})
  }
});

const getRetailerDetails = asyncHandler(async (req, res) => {
    const {retailerId} = req.body
    console.log(req.body);

    const getRetailerDetailsSql ='select * from retailer where retailer_id=?'
    const retailer = await new Promise((resolve,reject)=>{
      db.query(getRetailerDetailsSql,[retailerId],(err,result)=>{
        if(err) reject(err)
          resolve(result)
      })
    })

    if (retailer) {
      res.status(201).json(retailer)
    }
  });

const updateRetailerPencentage = asyncHandler(async(req,res)=>{
  const {id,margin}=req.body

  try {
    if (margin===undefined) {
      res.status(400).json({error:'Margin is required'})
    }

    let updateRetailerPercentageSql = 'update retailer set retailer_percentage=?'
    let param = [margin]

    if (id) {
      updateRetailerPercentageSql+=" where retailer_id=?"
    }


    await new Promise((resolve,reject)=>{
      db.query(updateRetailerPercentageSql,[param,id],(err,result)=>{
        if(err) reject(err)
          resolve(result)
      })
    })

    res.status(201).json({message:'Margin Updated successfully'})


  } catch (err) {
    res.status(500).json({message:'Internal server error',err})
  }

})

const retailerStatus= asyncHandler(async(req,res)=>{
  console.log(req.body);

  const {id,status} = req.body

  try {
    if (status===undefined) {
      res.status(400).json({error:"Status is undefined"})
    }

    let distributorStatusSql= 'update retailer set retailer_status = ? where retailer_id=?'

    await new Promise((resolve, reject) => {
      db.query(distributorStatusSql,[status,id],(err,result)=>{
        if(err) reject (err)
        resolve(result)
      })
    })
    res.status(201).json({message:"Status updated successfully"})
  } catch (err) {
    res.status(500).json({message:'Internal server error',err})
  }
})
router.post('/profile',protect,getRetailer)
router.post('/profile/id',protect,getRetailerDetails)
router.post('/register',protect,createRetailer)
router.put('/profile',protect,updateRetailer)
router.post('/approve',protect,approveRetailer)
router.put('/update',protect,updateRetailerPencentage)
router.put("/status", protect, retailerStatus);

module.exports=router