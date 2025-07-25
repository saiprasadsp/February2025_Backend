const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler')
const protect = require('../config/authMiddleware')
const db = require('../config/db')
const Razorpay = require('razorpay')

const instance = new Razorpay({
    key_id:process.env.RAZ_ID,
    key_secret:process.env.RAZ_KEY
})

const createOrder = asyncHandler(async (req,res) => {
    const {amount,phone,customerID,charges} = req.body
    const creditedAmount = amount-(amount*charges/100)

    const request = {
        amount : parseInt(amount *100),
        currency:process.env.CURRENCY,
        receipt:`receipt_order_${Date.now()}`,
        payment_capture:1
    }
    try {
        const order = await instance.orders.create(request)
        const createOrderSQL = 'insert into orders (order_user_id,order_id,order_amount,order_charges,order_credited_amount,order_phone,created_timestamp) values (?,?,?,?,?,?,?)'
            db.query(createOrderSQL,[customerID,order.id,amount,charges,creditedAmount,phone,new Date()],(err,result)=>{
                if (err) {
                    res.status(400)
                    console.log(err);
                    throw new Error("Database insert Failed");

                }
                console.log(result);

                return res.status(201).json({orderid:order.id,amount:order.amount,currency:order.currency})
            })
    } catch (err) {
        console.log(err);
        res.status(500).json({error:err.message})
    }

})

router.post("/",protect,createOrder)
module.exports=router