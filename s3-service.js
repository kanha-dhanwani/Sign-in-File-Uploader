const AWS = require('aws-sdk');
const fs = require('fs');
// const secrets = require('./config');

function createS3Instance() {
    const s3 = new AWS.S3({
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID, //secrets.awsCreds.accessKey,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY //secrets.awsCreds.secretKey
        },
        region: 'ap-south-1'
    });
    return s3;
}

async function uploadFileToS3(req, fileObj, bucketName) {
    console.log({fileObj});
    const s3 = createS3Instance();
    const filePath = req.fileObj.filepath;
    const fileStream = fs.createReadStream(filePath);
    const params = {
        Body: fs.createReadStream(fileStream),
        Bucket: bucketName,
        Key: fileObj.originalFilename
    }
    const uploadData = await s3.upload(params).promise();
    return uploadData;
}

async function getBucketListFromS3(bucketName) {
    const s3 = createS3Instance();
    const params = {
        Bucket: bucketName,
        MaxKeys: 10
    }

    const bucketData = s3.listObjects(params).promise();
    return bucketData || {};
}

async function getPresignedURL(bucketName, key) {
    const s3 = createS3Instance();
    const params = {
        Bucket: bucketName,
        Key: key,
        Expires: 60
    }

    const preSignedURL = await s3.getSignedUrl('getObject', params);
    return preSignedURL;
}

module.exports = {
    uploadFileToS3,
    getBucketListFromS3,
    getPresignedURL
}