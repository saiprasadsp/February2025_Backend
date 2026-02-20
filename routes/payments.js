const express = require("express");
const router = express.Router();
const asyncHandler = require("express-async-handler");
const protect = require("../config/authMiddleware");
const db = require("../config/db");
const { Cashfree, CFEnvironment } = require("cashfree-pg");
const { where, Op } = require("sequelize");
const { Transaction, Wallet, Payments } = require("../models");
const { User } = require("../models");
const cashfree = new Cashfree(
  CFEnvironment.SANDBOX,
  `${process.env.APP_ID}`,
  `${process.env.SECRET_KEY}`,
);

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

const createOrder = asyncHandler(async (req, res) => {
  const { amount, CustomerName, Invoice, phone, customerID, orderID, charges } =
    req.body;

  // Convert charge % to actual value (2 decimal precision)
  const chargesAmount = Number(((amount * charges) / 100).toFixed(2));
  const creditedAmount = Number((amount - chargesAmount).toFixed(2));

  const request = {
    order_amount: amount,
    order_currency: process.env.CURRENCY,
    order_id: orderID,
    customer_details: {
      customer_id: customerID,
      customer_phone: phone,
    },
    order_meta: {
      return_url: process.env.STATUS_PAGE,
    },
  };

  try {
    const response = await cashfree.PGCreateOrder(request);

    const createOrder = await Payments.create({
      user_id: customerID,
      order_id: orderID,
      amount: amount,
      customer_name: CustomerName,
      mobile_number: phone,
      charges: chargesAmount,
      currency: process.env.CURRENCY,
      invoice_id: Invoice,
      payment_date: new Date(),
    });

    return res.status(201).json({
      message: "Order Created Successfully",
      Session_ID: response.data.payment_session_id,
      order: createOrder,
    });
  } catch (error) {
    console.error("Cashfree Error:", error?.response?.data || error.message);
    res
      .status(400)
      .json({ message: error?.response?.data?.message || "Payment failed" });
  }
});

const paymentStatus = asyncHandler(async (req, res) => {
  const { orderID, customerID, charges } = req.body;

  try {
    const response = await cashfree.PGOrderFetchPayments(orderID);

    const { payment_status, order_amount } = response.data[0];
    const creditedAmount = order_amount - (order_amount * charges) / 100;

    // Check if order already marked SUCCESS
    const paymentCheckSQL = `SELECT status FROM payments WHERE order_id = ?`;

    db.query(paymentCheckSQL, [orderID], (err, rows) => {
      if (err) {
        console.error("DB check failed", err);
        return res.status(500).json({ message: "Internal error" });
      }

      const existingStatus = rows[0]?.status;

      if (payment_status === "SUCCESS" && existingStatus !== "SUCCESS") {
        // Update payment status
        const updateStatusSQL = `UPDATE payments SET status = ? WHERE order_id = ?`;
        db.query(updateStatusSQL, ["SUCCESS", orderID]);

        // Update or Insert wallet
        const checkWalletSQL = `SELECT * FROM wallet WHERE wallet_user_id = ? LIMIT 1`;
        db.query(checkWalletSQL, [customerID], (err, rows) => {
          if (err) return console.error("Wallet check error:", err);

          if (rows.length > 0) {
            const updateWalletSQL = `
                            UPDATE wallet
                            SET wallet_balance = wallet_balance + ?, wallet_updated_at= ?
                            WHERE wallet_user_id = ?`;
            db.query(
              updateWalletSQL,
              [creditedAmount, new Date(), customerID],
              (err, result) => {
                console.log(err);
                console.log(result);
              },
            );
          } else {
            const insertWalletSQL = `
                            INSERT INTO wallet (wallet_user_id, wallet_balance, wallet_updated_at)
                            VALUES (?, ?, ?)`;
            db.query(insertWalletSQL, [customerID, creditedAmount, new Date()]);
          }

          res.status(200).json({
            message: "Wallet credited successfully",
            order_status: response.data,
          });
        });
      } else {
        res
          .status(200)
          .json({ message: "Payment not completed or already processed" });
      }
    });
  } catch (err) {
    console.error(
      "Cashfree fetch error:",
      err.response?.data?.message || err.message,
    );
    res.status(400).json({ message: "Unable to fetch order status" });
  }
});

const orderHistory = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  try {
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }
    const order = await Payments.findAll({ where: { user_id: userId } });

    if (order.length === 0) {
      return res.status(404).json({ message: "No transactions found" });
    }
    res.status(200).json(order);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch transactions" });
  }
});

const logTransaction = asyncHandler(async (req, res) => {
  try {
    const { userId, type, amount } = req.body;
    const numericAmount = Number(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const wallet = await Wallet.findOne({ where: { wallet_user_id: userId } });

    if (!wallet) {
      return res.status(500).json({ message: "Wallet not found" });
    }
    const beforeBalance = Number(wallet.wallet_balance) || 0;
    let afterBalance = beforeBalance;

    let credit = 0.0;
    let debit = 0.0;

    if (type === "credit") {
      credit = numericAmount;
      afterBalance += numericAmount;
    } else if (type === "debit") {
      debit = numericAmount;
      afterBalance -= numericAmount;

      if (afterBalance < 0) {
        return res.status(400).json({ message: "Insufficient balance" });
      }
    } else {
      return res.status(400).json({ message: "Invalid transaction type" });
    }

    wallet.wallet_balance = afterBalance;
    await wallet.save();

    await Transaction.create({
      user_id: userId,
      txn_id: "TXN" + Date.now(),
      txn_type: type,
      before_balance: beforeBalance,
      credit,
      debit,
      after_balance: afterBalance,
      created_timestamp: new Date(),
    });
    return res.json({
      message: "Transaction logged successfully",
      beforeBalance,
      afterBalance,
    });
  } catch (err) {
    console.error("Error in log Transaction", err);
    return res.status(500).json({ message: "Internal Server error" });
  }
});

const getPayInReports = asyncHandler(async (req, res) => {
  try {
    const { fromDate, toDate, orderId, userId } = req.body;
    let whereClause = {};
    const hasAnyFilters = fromDate || toDate || userId || orderId;

    if (!hasAnyFilters) {
      const today = new Date();
      const last30Days = new Date();
      last30Days.setDate(today.getDate() - 30);

      whereClause.payment_date = {
        [Op.between]: [formattedDate(last30Days), formattedDate(today)],
      };
    }

    if (fromDate && toDate) {
      whereClause.payment_date = {
        [Op.between]: [formattedDate(fromDate), formattedDate(toDate)],
      };
    }
    if (userId) {
      whereClause.user_id = userId;
    }

    if (orderId) {
      whereClause.order_id = orderId;
    }
    console.log(whereClause);

    const reports = await Payments.findAll({
      where: whereClause,
      order: [["payment_date", "DESC"]],
    });

    if (!reports.length) {
      res.status(200).json({
        message: "No data found within the specified date range",
        count: reports.length,
        data: [],
      });
    } else {
      res.status(200).json({
        count: reports.length,
        data: reports,
      });
    }
  } catch (err) {
    // console.log(err);
    res.status(500).json({ message: "Server Error" });
  }
});

router.post("/", protect, createOrder);
router.post("/payment-status", protect, paymentStatus);
router.post("/orders", protect, orderHistory);
router.post("/passbook", protect, logTransaction);
router.post("/filter-order", protect, getPayInReports);

module.exports = router;
