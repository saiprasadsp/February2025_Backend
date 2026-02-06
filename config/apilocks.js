const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");

const { ApiPermit, User } = require("../models");

const apiPermit = asyncHandler(async (req, res, next) => {
  console.log("step 1");

  try {
    let token = req.cookies.jwt;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const checkUserApiPermission = await ApiPermit.findOne({
      where: { user_id: decoded.userId },
    });
    const { status } = checkUserApiPermission;

    if (status != true) {
      res.status(401).json({ message: "You have been locked out" });
    }
    next();
  } catch (err) {
    console.log(err);

    res.status(401).json({ message: err || "Not Authorized,token failed" });
  }
});

module.exports = apiPermit;
