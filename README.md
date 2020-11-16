# nodejs-sqs-ocr
NodeJS application / Docker image to OCR images. Jobs pulled from AWS SQS, files stored in S3

## Environment Variables
* AWS_REGION - default is eu-west-1
* AWS_ACCESS_KEY_ID - access key ID to AWS account
* AWS_SECRET_ACCESS_KEY - secret access key to AWS account
* AWS_SQS_QUEUE_URL - URL to the SQS queue
* AWS_S3_OCR_INPUT - input bucket name
* AWS_S3_OCR_INPUT - output bucket name
* OCR_TEMP_DIR - temporary directory for storing input images and output text
* AWS_SQS_VISIBILITY_TIMEOUT - see https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html
* AWS_SQS_WAIT_TIME_SECONDS - see https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-short-and-long-polling.html

## Example SQS Message Body for S3 bucket notifications
```
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
```
Records[].s3.object.key should contain the key to the input file in AWS_S3_OCR_INPUT input bucket