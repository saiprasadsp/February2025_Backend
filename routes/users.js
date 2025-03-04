var express = require('express');
var router = express.Router();
const asyncHandler = require('express-async-handler')
const db = require('../config/db')
const bcrypt = require('bcryptjs')
const protect = require('../config/authMiddleware')
const generateToken = require('../config/generateToken')
/* GET users listing. */

// @desc Register a new user  
// @route POST /api/users/auth
// @access Public
const registerUser = asyncHandler(async(req,res)=>{  
  
  const {id,email,password,userid,role,mobile,create,update} = req.body;

  const findUserSql = "select user_email from login where user_email=?";

  const userExists = await new Promise((resolve,reject)=>{
    db.query(findUserSql, [email], (err, results) => {
      if (err) reject(err);
      resolve(results.length > 0);
    });

  })
  if (userExists) {
    res.status(400)
    throw new Error("User already Exists");  
  }
  const salt = await bcrypt.genSalt(10)
  const hashedPassword = await bcrypt.hash(password,salt)
  const createUserSql = "INSERT INTO login (ID,role_id, user_id,user_password,user_mobile,user_email,created_timestamp,updated_timestamp)VALUES(?,?,?,?,?,?,?,?)"
  await new Promise((resolve,reject)=>{
    db.query(createUserSql,[id,role,userid,hashedPassword,mobile,email,create,update],(err,result)=>{
      if (err) {
        res.status(400)
        
        throw new Error("Inavlid User Data");
      }
      res.status(201).json({message:'User registered Successfully',userId:result.insertId})
    })
  })


})

// @desc Auth user & get token 
// @route POST /api/users/auth
// @access Public
const authUser = asyncHandler(async(req,res)=>{  
  const {userid,password} = req.body
  console.log(req.cookies);
  
    const authSql = 'select user_id,user_password,user_email,Role from login l join user_roles ur on l.role_id=ur.ID where user_id=? '
    try {
      const user = await new Promise((resolve,reject)=>{
        db.query(authSql,[userid],(err,result)=>{
          if (err) reject (err)
            resolve(result[0])
        })
      })
      
      const matchPassword = await bcrypt.compare(password,user.user_password)

      if (!user | !matchPassword) {
        res.status(401)
        throw new Error("Invalid credentials");
        
      }
       generateToken(res,user.user_id)
       console.log(user);
       
      res.json({
        message:'Authentication Successfull',
        id:user.user_id,
        email:user.user_email,
        role:user.Role,
      })
    } catch (error) {
      res.status(500).json({message:'Authentication Failed'})
    }
    

})

// @desc Logout user / clear cookie   
// @route POST /api/users/auth
// @access Public
const logoutUser = ((req,res)=>{  

  res.cookie('jwt','',{
    httpOnly:true,
    expires:new Date(0)
  })
  res.status(200).json({message:"Logged out successfully "})
})

// @desc Get user profile   
// @route POST /api/users/auth
// @access Public
const getUser = asyncHandler(async(req,res)=>{
  console.log('step 5',req.cookies);
  
    
  if (req.user) {
    res.json({
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role:req.user.role
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }

})
// @desc Get user profile   
// @route POST /api/users/auth
// @access Public
const updateUser = asyncHandler(async(req,res)=>{    
  const {email,password,userid} =req.body  
  const userId=req.user.id
  try {
    const getSql = "select user_id,user_email,user_password from login where user_id=?"
    const result = await new Promise((resolve, reject) => {
      db.query(getSql,[userId],(err,result)=>{
        if (err) reject(err);
        resolve(result)
      })
    })
    if (result.length ===0) {
      return res.status(404).json({message:'User not found'})
    }
    const user=result[0]
    const updatedUserId = userid || user.user_id;
    const updatedEmail = email || user.user_email;
    const updatedPassword = password || user.user_password
    const updatedDate = new Date().toISOString().replace('T', ' ').split('.')[0];
    let updatedUserPassword = updatedPassword;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updatedUserPassword = await bcrypt.hash(updatedPassword, salt);
    }

    const updateSql = "UPDATE login SET user_email = ?, user_id = ?, user_password = ?,updated_timestamp= ? WHERE user_id = ?";
  
    await new Promise ((resolve,reject)=>{
      db.query(updateSql,[updatedEmail,updatedUserId,updatedUserPassword,updatedDate,userId],(err,result)=>{
        if (err) reject(err)
        resolve(result)
      })

    })
    res.status(200).json({message:'User updated Successfully'})
  } catch (err) {
    res.status(500).json({message:'Error updating user data'})
  }
  
  
})


router.post('/',registerUser)
router.post('/auth',authUser)
router.post('/logout',logoutUser)
router.get('/profile',protect,getUser)
router.put('/profile',protect,updateUser)

module.exports = router;
