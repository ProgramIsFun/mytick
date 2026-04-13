#!/bin/bash
set -e

if [ ! -f "google-services.json" ]; then
  echo "Error: google-services.json not found in mobile/"
  echo "Download it from Firebase Console → Project Settings → General → Your Apps"
  exit 1
fi

# Temporarily commit the file for the build archive
git add -f google-services.json
git commit -m "temp: add google-services.json for build" --no-verify

# Build
eas build --platform android --profile "${1:-preview}" --local

# Undo the temp commit (keeps the file locally, removes from git history)
git reset --soft HEAD~1
git rm --cached google-services.json 2>/dev/null || true
