#!/bin/bash
set -e

if [ -z "$GITHUB_TOKEN" ]; then
  echo "ERROR: GITHUB_TOKEN secret is not set"
  exit 1
fi

echo "Token found (length: ${#GITHUB_TOKEN})"

# Remove any stale git locks
rm -f .git/config.lock .git/index.lock

echo "Pushing to github.com/natethegreat78/transciber ..."

git -c user.email="journal@replit.com" -c user.name="Journal App" \
  push "https://oauth2:${GITHUB_TOKEN}@github.com/natethegreat78/journal.git" HEAD:main --force

echo "Done! Code is now on GitHub."
