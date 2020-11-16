const fs = require('fs');
const path = require('path');
// Rimraf to clean up temp dir
const rimraf = require('rimraf');
// Load tesseract.js for OCR
const Tesseract = require('tesseract.js');
// Load the AWS SDK for Node.js
const AWS = require('aws-sdk');
// Set the region
AWS.config.update({ region: process.env.AWS_REGION || 'eu-west-1' });

// Create an SQS service object
var sqs = new AWS.SQS({ apiVersion: '2012-11-05' });

// Create an S3 object
var s3 = new AWS.S3();

// URL to SQS Queue - Environment Variable
var queueURL = process.env.AWS_SQS_QUEUE_URL;

// ARN to OCR Input Bucket
var S3input = process.env.AWS_S3_OCR_INPUT;

// ARN to OCR Output Bucket
var S3output = process.env.AWS_S3_OCR_OUTPUT;

// Temp Dir
var tmpDir = process.env.OCR_TEMP_DIR || './tmp';

var params = {
  AttributeNames: [
    "SentTimestamp"
  ],
  MaxNumberOfMessages: 1,
  MessageAttributeNames: [
    "All"
  ],
  QueueUrl: queueURL,
  VisibilityTimeout: process.env.AWS_SQS_VISIBILITY_TIMEOUT || 300, // Setting a very high value here as OCR takes time
  WaitTimeSeconds: process.env.AWS_SQS_WAIT_TIME_SECONDS || 10
};

// Receive messages from queue
const receiveAndProcess = () => {
  try {
    sqs.receiveMessage(params, function (err, data) {
      if (err) {
        console.log("Receive Error", err);
      } else if (data.Messages) {
        console.log("Message received. Processing...");
        processMessage(data.Messages[0], (err) => {
          if (err) {
            console.log("Error processing message", err)
            deleteMessage(data.Messages[0], (err, data) => {
              if (err) {
                console.log("Delete Error", err);
              } else {
                console.log("Message Deleted", data);
              }
            });
          } else {
            deleteMessage(data.Messages[0], (err, data) => {
              if (err) {
                console.log("Delete Error", err);
              } else {
                console.log("Message Deleted", data);
                receiveAndProcess();
              }
            });
          }
        });
      } else {
        console.log(new Date(), "No new messages to process...");
        receiveAndProcess();
      }
    });
  } catch (e) {
    console.log("An error occured receiving message from SQS: " + e)
  }
}

// Process a received message
/* Example Message:
{
  "Records": [
    {
      "eventVersion": "2.1",
      "eventSource": "aws:s3",
      "awsRegion": "eu-west-1",
      "eventTime": "2020-11-16T19:10:20.178Z",
      "eventName": "ObjectCreated:Put",
      "userIdentity": {
        "principalId": "example"
      },
      "requestParameters": {
        "sourceIPAddress": "10.20.30.40"
      },
      "responseElements": {
        "x-amz-request-id": "...",
        "x-amz-id-2": "..."
      },
      "s3": {
        "s3SchemaVersion": "1.0",
        "configurationId": "09c216f5-caa0-4b93-9853-a86dbbf9a8b5",
        "bucket": {
          "name": "inputbucket",
          "ownerIdentity": {
            "principalId": "..."
          },
          "arn": "arn:aws:s3:::inputbucket"
        },
        "object": {
          "key": "demo.png",
          "size": 70668,
          "eTag": "f5e86c36a7874ba2492b0143ec56360d",
          "sequencer": "005FB2CE9EA7BE0F74"
        }
      }
    }
  ]
}
*/
const processMessage = (message, callback) => {
  try {
    var payload = JSON.parse(message.Body).Records[0];
  } catch (e) {
    callback("Invalid JSON format for message body. " + e)
  }
  if (payload&&payload.eventName&&payload.eventName=="ObjectCreated:Put") {
    downloadFileToTemp(payload.s3.object.key, () => {
      console.log("Downloaded", payload.s3.object.key, "to", tmpDir);
      doOCR(payload.s3.object.key, () => {
        uploadFileToResultBucket(payload.s3.object.key + '.txt', () => {
          cleanUpTemp(()=>{
            callback(null);
          })
        });
      });
    })
  } else {
    callback("Message does not contain an OCR Input File");
  }
}

// Delete message from queue once OCR is completed
const deleteMessage = (message, callback) => {
  var deleteParams = {
    QueueUrl: queueURL,
    ReceiptHandle: message.ReceiptHandle
  };
  sqs.deleteMessage(deleteParams, callback);
}

// Download file referenced in message from input bucket
const downloadFileToTemp = (key, callback) => {
  var s3Params = {
    Bucket: S3input,
    Key: key
  };
  let readStream = s3.getObject(s3Params).createReadStream();
  let writeStream = fs.createWriteStream(path.join(tmpDir, key));
  readStream.pipe(writeStream);
  readStream.on('finish', () => {
    callback();
  });
}

// Upload OCR text to output bucket
const uploadFileToResultBucket = (file, callback) => {
  var s3Params = {
    Bucket: S3output,
    Key: file,
    Body: fs.createReadStream(path.join(tmpDir, file))
  };
  // call S3 to retrieve upload file to specified bucket
  s3.upload(s3Params, function (err, data) {
    if (err) {
      console.log("Error uploading result file", err);
      callback();
    } if (data) {
      console.log("Upload Success", data.Location);
      callback();
    }
  });
}

// Cleanup temp dir
const cleanUpTemp = (callback) => {
  console.log("Cleaning up temp directory")
  rimraf(path.join(tmpDir,"*"), callback);
}

// OCR Function calling Tesseract.js
const doOCR = (file, callback) => {
  console.log("Starting OCR work... this might take some time");
  Tesseract.recognize(
    path.join(tmpDir, file),
    'eng',
    { logger: m => { } }
  ).then(({ data: { text } }) => {
    console.log("Done. Writing results to file.")
    fs.writeFile(path.join(tmpDir, file + ".txt"), text, () => {
      callback();
    });
  });
}

receiveAndProcess();