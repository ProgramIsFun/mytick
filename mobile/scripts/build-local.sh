#!/bin/bash
set -e

if [ ! -f "google-services.json" ]; then
  echo "Error: google-services.json not found in mobile/"
  echo "Download it from Firebase Console → Project Settings → General → Your Apps"
  exit 1
fi

# Temporarily track the file for the build archive
git add -f google-services.json

# Build
eas build --platform android --profile "${1:-preview}" --local

# Untrack after build (keep local file, remove from git)
git rm --cached google-services.json 2>/dev/null || true
