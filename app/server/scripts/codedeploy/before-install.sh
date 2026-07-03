#!/bin/bash
set -e

echo "=== BeforeInstall: Preparing for deployment ==="

APP_ROOT="/home/ec2-user/app"

# Read which environment to deploy
if [ -f "${APP_ROOT}/DEPLOY_ENV" ]; then
    DEPLOY_ENV=$(cat "${APP_ROOT}/DEPLOY_ENV")
else
    DEPLOY_ENV="all"
fi
export DEPLOY_ENV
echo "Deploy environment: $DEPLOY_ENV"

# Preserve per-environment files before cleanup
echo "Preserving environment files..."
# Clean up any existing backup directory first (ignore permission errors)
rm -rf /tmp/videoai-backup 2>/dev/null || sudo rm -rf /tmp/videoai-backup 2>/dev/null || true
mkdir -p /tmp/videoai-backup
for env in uat prod; do
    mkdir -p "/tmp/videoai-backup/${env}"
    if [ -f "${APP_ROOT}/${env}/.env.${env}" ]; then
        cp "${APP_ROOT}/${env}/.env.${env}" "/tmp/videoai-backup/${env}/" 2>/dev/null || true
    fi
    if [ -f "${APP_ROOT}/${env}/.vertex-key.json" ]; then
        cp "${APP_ROOT}/${env}/.vertex-key.json" "/tmp/videoai-backup/${env}/" 2>/dev/null || true
    fi
done

# Clean only transient root artifacts produced by CodeDeploy extraction.
# Keep per-environment runtime folders intact so deploying one env never deletes the other.
if [ -d "${APP_ROOT}" ]; then
    echo "Cleaning transient deployment artifacts..."
    rm -rf \
      "${APP_ROOT}/dist" \
      "${APP_ROOT}/scripts" \
      "${APP_ROOT}/images" \
      "${APP_ROOT}/package.json" \
      "${APP_ROOT}/package-lock.json" \
      "${APP_ROOT}/yarn.lock" \
      "${APP_ROOT}/ecosystem.config.js" \
      "${APP_ROOT}/appspec.yml" \
      "${APP_ROOT}/DEPLOY_ENV" \
      "${APP_ROOT}/.env.uat" \
      "${APP_ROOT}/.env.prod" \
      "${APP_ROOT}/.vertex-key.json" 2>/dev/null || true
fi

echo "=== BeforeInstall: Complete ==="
