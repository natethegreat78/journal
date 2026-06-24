#!/bin/bash
set -e
rm -f .git/config.lock .git/index.lock
git -c user.email="journal@replit.com" -c user.name="Journal App" \
  push "https://oauth2:${GH_PUSH_TOKEN}@github.com/natethegreat78/journal.git" HEAD:main --force
echo "Pushed!"

# Trigger workflow_dispatch
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: token ${GH_PUSH_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  -d '{"ref":"main"}' \
  "https://api.github.com/repos/natethegreat78/journal/actions/workflows/build-mac.yml/dispatches")
echo "Trigger HTTP status: $STATUS"
