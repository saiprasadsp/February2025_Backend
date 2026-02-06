const { default: axios } = require("axios");
const express = require("express");
const router = express.Router();
const asyncHandler = require("express-async-handler");
const protect = require("../config/authMiddleware");
const apiPermit = require("../config/apilocks")
function generateRandomAlphanumeric(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    result += chars.charAt(randomIndex);
  }
  return result;
}


const headers = {
  Accept: "application/json",
  "X-Ipay-Auth-Code": "1",
  "X-Ipay-Client-Id": process.env.CLIENT_ID,
  "X-Ipay-Client-Secret": process.env.CLIENT_SECRET,
  "X-Ipay-Endpoint-Ip": process.env.CLIENT_IP,
  "Content-Type": " application/json",
  "X-Ipay-Outlet-Id": process.env.CLIENT_OUTLET_ID,
};

const categories = asyncHandler(async (req, res, next) => {
  try {
    let data = "";
    let config = {
      method: "get",
      maxBodyLength: Infinity,
      url: "https://api.instantpay.in/marketplace/utilityPayments/category",
      headers: headers,
      data: data,
    };

    const response = await axios.request(config);
    res.status(200).json(response.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error", error: err });
  }
});

const biller = asyncHandler(async (req, res, next) => {
  const { categoryKey,pageNumber,recordPerPage } = req.body;
  try {
      let data = JSON.stringify({
        "pagination": {
            "pageNumber": pageNumber,
            "recordsPerPage": recordPerPage
        },
        "filters": {
            "categoryKey": categoryKey,
            "updatedAfterDate": "C04"
        }
        })
        console.log("step 1",data);

        let config = {
            method: "post",
            maxBodyLength: Infinity,
            url: "https://api.instantpay.in/marketplace/utilityPayments/billers",
            headers: headers,
            data: data,
        };

        const response = await axios.request(config)
        res.status(200).json(response.data)
    } catch (err) {
        console.error(err);
        res.status(500).json({message:'Internal Server Error',error:err})
    }
});

const billerDetails = asyncHandler(async (req,res,next) => {
    const {billerId} = req.body
    try {
    let data = JSON.stringify({
        "billerId": billerId
    });

    let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://api.instantpay.in/marketplace/utilityPayments/billerDetails',
    headers: headers,
    data : data
    };
    const response = await axios.request(config)
    res.status(200).json(response.data)
   } catch (err) {
        console.error(err);
        res.status(500).json({message:"Internal Server Error",error:err})
    }
})

const billerEnquiry = asyncHandler(async (req,res,next) => {
    const {billerId,param1,param2,amount} = req.body;
    try {
        let data = JSON.stringify({
            "billerId": billerId,
            "initChannel": "AGT",
            "externalRef": generateRandomAlphanumeric(6),
            "inputParameters": {
                "param1": param1,
                "param2": param2
            },
            "deviceInfo": {
                "mac": "BC-BE-33-65-E6-AC",
                "ip": "103.254.205.164"
            },
            "remarks": {
                "param1": param2
            },
            "transactionAmount": amount
        });

        let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://api.instantpay.in/marketplace/utilityPayments/prePaymentEnquiry',
        headers: headers,
        data : data
        };
        const response = await axios.request(config)
        res.status(200).json(response.data)

    } catch (err) {
        console.error(err);
        res.status(500).json({message:'Internal Server Error',error:err})

    }
})

const billPayment = asyncHandler(async (req,res,next) => {
    const {billerId,enquiryReferenceId,latitude,longitude,amount,param1,param2} = req.body
    console.log("step 20",req.body);

    try {
        let data = ({
            "billerId": billerId,
            "externalRef": generateRandomAlphanumeric(10),
            "enquiryReferenceId": enquiryReferenceId,
            "telecomCircle": "AP",
            "inputParameters": {
                "param1": param1,"param2":param2
            },
            "initChannel": "AGT",
            "deviceInfo": {
                "terminalId": "128139238",
                "mobile": param2,
                "postalCode": "500040",
                "geoCode": `${latitude},${longitude}`
            },
            "paymentMode": "UPI",
            "paymentInfo": {
                "Remarks": "VPA",
                "WalletName": null,
                "MobileNo": param2,
                "VPA": "9051755536@paytm"
            },
            "remarks": {
                "param1": param2
            },
            "transactionAmount": amount,
            "customerPan": ""
        })

        console.log("step 1",data);


        let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://api.instantpay.in/marketplace/utilityPayments/payment',
        headers: headers,
        data : data
        };

        const response = await axios.request(config)
        console.log("step 20",response.data);

        res.status(200).json(response.data)

    } catch (err) {
        console.error(err);
        res.status(500).json({message:"Internal Server Error",error:err})
    }
})

const txn_status = asyncHandler(async (req,res,next) => {
    const {date,refId} = req.body
   try {
    let data = JSON.stringify({
            "transactionDate": "2025-10-07",
            "externalRef": "123TEST"
        })
        let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://api.instantpay.in/reports/txnStatus',
        headers: headers,
        data : data
        };
        const response = await axios.request(config)
        res.status(200).json(response.data)
   } catch (err) {
     console.error(err);
    res.status(500).json({message:'Internal Server Error',error:err})
   }

})
router.get("/", protect,apiPermit ,categories);
router.post("/biller", protect, biller);
router.post("/billerDetails", protect, billerDetails);
router.post("/billerEnquiry", protect, billerEnquiry);
router.post("/billPayment", protect, billPayment);
router.post("/txnstatus", protect, txn_status);

module.exports = router;
