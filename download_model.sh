#!/bin/bash

# Create a model directory if it doesn't exist
mkdir -p model

# Download the model file from Google Drive
# Replace DRIVE_FILE_ID with your Google Drive file ID
FILE_ID="1I0hQuiodQSooFAiHk0sqOPIC1Pj5O3c4"
FILE_NAME="Medicinal_plant8_Not.h5"

wget --load-cookies /tmp/cookies.txt "https://docs.google.com/uc?export=download&confirm=$(wget --quiet --save-cookies /tmp/cookies.txt --keep-session-cookies --no-check-certificate 'https://docs.google.com/uc?export=download&id='$FILE_ID -O- | sed -rn 's/.*confirm=([0-9A-Za-z_]+).*/\1\n/p')&id=$FILE_ID" -O $FILE_NAME && rm -rf /tmp/cookies.txt