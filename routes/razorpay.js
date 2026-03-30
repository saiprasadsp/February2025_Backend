const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler')
const protect = require('../config/authMiddleware')
const db = require('../config/db')
const Razorpay = require('razorpay');
const { Payments, Wallet, GateWays } = require('../models');
const { where } = require('sequelize');

const instance = new Razorpay({
    key_id:process.env.RAZ_ID,
    key_secret:process.env.RAZ_KEY
})

const createOrder = asyncHandler(async (req,res) => {
    const {amount,CustomerName,Invoice,phone,customerID,userInfo,gateway_id} = req.body
    console.log("step 10",req.body);

    const chargeConfig = await GateWays.findOne({
      where:{
        id:gateway_id
      }
    })

    const chargesAmount = Number(((amount * chargeConfig.retailer) / 100).toFixed(2));
    const creditedAmount = Number((amount - chargesAmount).toFixed(2));

    const request = {
        amount : parseInt(amount *100),
        currency:process.env.CURRENCY,
        receipt:`receipt_order_${Date.now()}`,
        payment_capture:1
    }
    try {
        const order = await instance.orders.create(request)

        await Payments.create({
        user_id:customerID,
        gateway_id:gateway_id,
        order_id:order.id,
        amount:amount,
        customer_name:CustomerName,
        mobile_number:phone,
        charges:chargesAmount,
        currency:process.env.CURRENCY,
        invoice_id:Invoice,
        payment_date:new Date()
        })
        return res.status(201).json({orderid:order.id,amount:order.amount,currency:order.currency})
    } catch (err) {
        console.log(err);
        res.status(500).json({error:err.message})
    }

})

const paymentStatus = asyncHandler(async (req, res) => {
    const { orderID, customerID, charges } = req.body;
    console.log("step 1",req.body);


  try {
    const response = await instance.orders.fetch(orderID);
    console.log("Razorpay Response:", response);

    const { status, amount_paid } = response;
    const order_amount = parseInt(amount_paid / 100);
    const payment_status = status === "paid" ? "SUCCESS" : "FAILED";
    console.log("payment_status_check",payment_status);


    const creditedAmount = order_amount - (order_amount * charges) / 100;
    console.log("step 2",creditedAmount);


    const payment = await Payments.findOne({ where: { order_id: orderID } });
    console.log("payment check",payment);


    if (!payment) {
      return res.status(404).json({ message: "Payment record not found" });
    }

    if (payment_status === "SUCCESS" && payment.status !== "SUCCESS") {
      await payment.update({ status: "SUCCESS" });

      const wallet = await Wallet.findOne({ where: { wallet_user_id: customerID } });
      console.log("step 3",wallet);

      // console.log('step 4',JSON.parse(wallet.wallet_balance) + creditedAmount);



      if (wallet) {
        console.log("step 5 wallet found");

        await wallet.update({
          wallet_balance: JSON.parse(wallet.wallet_balance) + creditedAmount,
          wallet_updated_at: new Date(),
        });
      } else {
        await Wallet.create({
          wallet_user_id: customerID,
          wallet_balance: creditedAmount,
          wallet_updated_at: new Date(),
        });
      }

      return res.status(200).json({
        message: "Wallet credited successfully",
        order_status: payment_status,
      });
    }

    return res.status(200).json({
      message: "Payment not completed or already processed",
      order_status: payment_status,
    });
  } catch (err) {
    console.error("Razorpay fetch error:", err.response?.data?.message || err.message);
    res.status(400).json({ message: "Unable to fetch order status" });
  }

});

router.post("/",protect,createOrder)
router.post("/payment-status",protect,paymentStatus)

module.exports=router