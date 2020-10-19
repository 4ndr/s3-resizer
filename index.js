'use strict'

const AWS = require('aws-sdk');
const S3 = new AWS.S3({signatureVersion: 'v4'});
const Sharp = require('sharp');

// parameters
const {ALLOWED_BUCKETS, URL, DUMP_BUCKET} = process.env;

exports.handler = async (event) => {
    const bucket = event.queryStringParameters.bucket || '';
    const filename = event.queryStringParameters.fileId || '';
    const w = event.queryStringParameters.w;
    const h = event.queryStringParameters.h;
    const dump_url = `https://${DUMP_BUCKET}${URL}/`

    if (bucket === ''){
        return {
            statusCode: 400,
            body: `Bucket is not correctly informed, bucket: "${bucket}"`,
            headers: {"Content-Type": "text/plain"}
        }
    }

    if (filename === ''){
        return {
            statusCode: 400,
            body: `file-id is not correctly informed, file-id: "${filename}"`,
            headers: {"Content-Type": "text/plain"}
        }
    }

    if (!ALLOWED_BUCKETS.includes(bucket)){
        return {
            statusCode: 404,
            body: `Bucket not found: "${bucket}"`,
            headers: {"Content-Type": "text/plain"}
        }
    }

    try {

        const width = w === 'AUTO' ? null : parseInt(w);
        const height = h === 'AUTO' ? null : parseInt(h);

        if (!width && !height){
            return {
                statusCode: 301,
                headers: {"Location" : `https://${bucket}${URL}/${filename}`}
            }
        }

        const path = `${w}x${h}/${filename}`
        let found = false

        const fileExist = await S3
            .headObject({Bucket: bucket, Key: path})
            .promise()
            .then(() => {
                found = true
            })
            .catch(() => {})

        if (found === true){
            return {
                statusCode: 301,
                headers: {"Location" : `${dump_url}/${path}`}
            }
        }

        const data = await S3
            .getObject({Bucket: bucket, Key: filename})
            .promise();

        const result = await Sharp(data.Body, {failOnError: false})
            .resize(width, height)
            .rotate()
            .toBuffer();

        await S3.putObject({
            Body: result,
            Bucket: bucket,
            ContentType: data.ContentType,
            Key: path,
            CacheControl: 'public, max-age=86400'
        }).promise();
        
        return {
            statusCode: 301,
            headers: {"Location" : `${dump_url}/${path}`}
        };
    } catch (e) {
        return {
            statusCode: e.statusCode || 400,
            body: 'Exception: ' + e.message,
            headers: {"Content-Type": "text/plain"}
        };
    }
}
