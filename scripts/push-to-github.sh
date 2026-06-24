#!/bin/bash
set -e

if [ -z "$GITHUB_TOKEN" ]; then
  echo "ERROR: GITHUB_TOKEN secret is not set"
  exit 1
fi

echo "Token found (length: ${#GITHUB_TOKEN})"
echo "Pushing to github.com/natethegreat78/transciber ..."

git config user.email "journal@replit.com"
git config user.name "Journal App"

git push "https://oauth2:${GITHUB_TOKEN}@github.com/natethegreat78/transciber.git" HEAD:main --force

echo "Done! Code is now on GitHub."
