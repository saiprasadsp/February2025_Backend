const {S3Client,PutObjectCommand} = require('@aws-sdk/client-s3');
const dotenv = require('dotenv')
dotenv.config()


const s3 = new S3Client({
    region:process.env.AWS_REGION,
    credentials:{
            accessKeyId:process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY,

    }
})
const S3_BUCKET = process.env.AWS_BUCKET_NAME

module.exports={s3,S3_BUCKET}