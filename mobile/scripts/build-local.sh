#!/bin/bash
set -e

if [ ! -f "google-services.json" ]; then
  echo "Error: google-services.json not found in mobile/"
  echo "Download it from Firebase Console → Project Settings → General → Your Apps"
  exit 1
fi

# Set absolute path so prebuild can find it regardless of working directory
export GOOGLE_SERVICES_JSON="$(pwd)/google-services.json"

eas build --platform android --profile "${1:-preview}" --local
