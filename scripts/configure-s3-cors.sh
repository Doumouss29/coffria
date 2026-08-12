#!/usr/bin/env bash
set -euo pipefail
: "${S3_BUCKET:?S3_BUCKET manquant}"
: "${S3_ENDPOINT:?S3_ENDPOINT manquant}"
: "${APP_URL:?APP_URL manquant}"
cat > /tmp/coffria-cors.json <<JSON
{
  "CORSRules": [
    {
      "AllowedOrigins": ["${APP_URL}"],
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "HEAD", "PUT", "POST", "DELETE"],
      "ExposeHeaders": ["ETag", "x-amz-request-id"],
      "MaxAgeSeconds": 3600
    }
  ]
}
JSON
aws --endpoint-url "$S3_ENDPOINT" s3api put-bucket-cors --bucket "$S3_BUCKET" --cors-configuration file:///tmp/coffria-cors.json
aws --endpoint-url "$S3_ENDPOINT" s3api get-bucket-cors --bucket "$S3_BUCKET"
