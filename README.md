# docker-sqs-ocr
Docker image to OCR images. Jobs pulled from AWS SQS, files stored in S3

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

## SQS Message Body
```
{
"ocr_input_file":"test.png"
}
´´´
ocr_input_file should contain the key to the input file in AWS_S3_OCR_INPUT input bucket