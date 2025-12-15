const express = require("express");
const router = express.Router();
const asyncHandler = require("express-async-handler");
const protect = require("../config/authMiddleware");
const {randomUUID} = require('crypto')
const {StandardCheckoutClient,Env, MetaInfo, StandardCheckoutPayRequest } = require('pg-sdk-node')
const {Payments,Wallet} = require('../models')

const clientId =  "M23VBTNCQXKMK_2511151628" //process.env.P_Client_ID;
const clientSecret = "ZjkwNTUwOTMtOTc1Ni00OWUzLWE0MWItNzM3MzFlNTRiMjM2" //process.env.P_Client_Secret;
const clientVersion = 1 //process.env.P_Client_Version;
const env = Env.SANDBOX;

const client = StandardCheckoutClient.getInstance(clientId, clientSecret, clientVersion, env);


const createPayment = asyncHandler(async (req,res,next) => {
  const {paisa,CustomerName,Invoice,phone,customerID,charges} = req.body
  const amount = paisa*100;
    const chargesAmount = Number(((paisa * charges) / 100).toFixed(2));
    const creditedAmount = Number((amount - chargesAmount).toFixed(2));
    const merchantOrderId = randomUUID();
    const redirectUrl = `${process.env.CORS_ORIGIN}/dashboard/payment-status?order_id=${merchantOrderId}&provider=phonepe`;
    const metaInfo = MetaInfo.builder()
                        .udf1("udf1")
                        .udf2("udf2")
                        .build();

    const request = StandardCheckoutPayRequest.builder()
            .merchantOrderId(merchantOrderId)
            .amount(amount)
            .redirectUrl(redirectUrl)
            .metaInfo(metaInfo)
            .build();
    try {
      const checkoutPageUrl = await client.pay(request).then((response)=> {return response.redirectUrl;})

      await Payments.create({
        user_id:customerID,
        order_id:merchantOrderId,
        amount:paisa,
        customer_name:CustomerName,
        mobile_number:phone,
        charges:chargesAmount,
        currency:process.env.CURRENCY,
        invoice_id:Invoice,
        payment_date:new Date()
      })
      res.status(201).json({url:checkoutPageUrl,orderId:merchantOrderId})

    } catch (err) {
      console.error(err)
      res.status(500).json({error:err.message})
    }

})




const orderStatus = asyncHandler(async (req,res,next) => {
    const {orderID, customerID, charges} = req.body
    try {
      const merchantOrderId = orderID;                    //Order Id used for creating new order
      const response = await client.getOrderStatus(merchantOrderId).then((response) => {
        return response;
      });

      console.log(response);

      const {state,amount} = response
      const order_amount = parseInt(amount / 100);
      console.log(order_amount);
      const payment_status = state === "COMPLETED" ? "SUCCESS" : "FAILED";
      console.log(payment_status);

      const creditedAmount = order_amount - (order_amount * charges) / 100;
      console.log("step 2",creditedAmount);
      const payment = await Payments.findOne({ where: { order_id: orderID } });
      if (!payment) {
        return res.status(404).json({message:"Payment record not found"})
      }
      if (payment_status==="SUCCESS" && payment_status !== "SUCCESS") {
        await payment.update({ status: "SUCCESS" });

        const wallet = await Wallet.findOne({ where: { wallet_user_id: customerID } });
        console.log("step 3",wallet);

        console.log('step 4',JSON.parse(wallet.wallet_balance) + creditedAmount);



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
        message:"Payment not completed or already processed",
        orderStatus:payment_status
      })
    } catch (err) {
      console.error("Razorpay fetch error:", err.response?.data?.message || err.message);
      res.status(400).json({ message: "Unable to fetch order status" });
    }

})

router.post("/", protect,createPayment);
router.post("/status",protect,orderStatus)
module.exports = router;