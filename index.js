const fs = require('fs');
const path = require('path');
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
var S3output = process.env.AWS_S3_OCR_INPUT;

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
          } else {
            deleteMessage(data.Messages[0], (err, data) => {
              if (err) {
                console.log("Delete Error", err);
              } else {
                console.log("Message Deleted", data);
                receiveAndProcess();
              }
            })
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
const processMessage = (message, callback) => {
  try {
    var payload = JSON.parse(message.Body);
  } catch (e) {
    callback("Invalid JSON format for message body. " + e)
  }
  if (payload.ocr_input_file) {
    downloadFileToTemp(payload.ocr_input_file, () => {
      console.log("Downloaded", payload.ocr_input_file, "to", tmpDir);
      doOCR(payload.ocr_input_file, () => {
        uploadFileToResultBucket(payload.ocr_input_file + '.txt', () => {
          callback(null);
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

// OCR Function calling Tesseract.js
const doOCR = (file, callback) => {
  console.log("Starting OCR work... this might take some time")
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