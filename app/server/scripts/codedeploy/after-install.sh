#!/bin/bash
set -e

echo "=== AfterInstall: Setting up application ==="

APP_ROOT="/home/ec2-user/app"
cd "${APP_ROOT}"

# Read which environment to deploy
if [ -f "DEPLOY_ENV" ]; then
    DEPLOY_ENV=$(cat DEPLOY_ENV)
    export DEPLOY_ENV
else
    DEPLOY_ENV="all"
    export DEPLOY_ENV
fi
echo "Deploy environment: $DEPLOY_ENV"

# Decide which runtime folders to update
TARGET_ENVS=()
if [ "$DEPLOY_ENV" = "all" ]; then
    TARGET_ENVS=("uat" "prod")
else
    TARGET_ENVS=("$DEPLOY_ENV")
fi

for env in "${TARGET_ENVS[@]}"; do
    TARGET_DIR="${APP_ROOT}/${env}"
    echo "Preparing runtime directory: ${TARGET_DIR}"
    mkdir -p "${TARGET_DIR}"
    mkdir -p "${APP_ROOT}/logs"

    # Replace code for the target environment only.
    rm -rf "${TARGET_DIR}/dist" "${TARGET_DIR}/scripts"
    cp -r "${APP_ROOT}/dist" "${TARGET_DIR}/"
    cp -r "${APP_ROOT}/scripts" "${TARGET_DIR}/"
    cp "${APP_ROOT}/package.json" "${TARGET_DIR}/package.json"

    if [ -f "${APP_ROOT}/ecosystem.config.js" ]; then
        cp "${APP_ROOT}/ecosystem.config.js" "${TARGET_DIR}/ecosystem.config.js"
    fi
    if [ -d "${APP_ROOT}/images" ]; then
        rm -rf "${TARGET_DIR}/images"
        cp -r "${APP_ROOT}/images" "${TARGET_DIR}/"
    fi

    ENV_FILE="${APP_ROOT}/.env.${env}"
    BACKUP_ENV_FILE="/tmp/videoai-backup/${env}/.env.${env}"
    if [ -f "${ENV_FILE}" ]; then
        cp "${ENV_FILE}" "${TARGET_DIR}/.env.${env}"
        chmod 600 "${TARGET_DIR}/.env.${env}" 2>/dev/null || true
    elif [ -f "${BACKUP_ENV_FILE}" ]; then
        echo "  Restoring .env.${env} from backup"
        cp "${BACKUP_ENV_FILE}" "${TARGET_DIR}/.env.${env}"
        chmod 600 "${TARGET_DIR}/.env.${env}" 2>/dev/null || true
    else
        echo "  WARNING: Missing ${TARGET_DIR}/.env.${env}"
    fi

    if [ -f "${APP_ROOT}/.vertex-key.json" ]; then
        cp "${APP_ROOT}/.vertex-key.json" "${TARGET_DIR}/.vertex-key.json"
        chmod 600 "${TARGET_DIR}/.vertex-key.json" 2>/dev/null || true
    elif [ -f "/tmp/videoai-backup/${env}/.vertex-key.json" ]; then
        cp "/tmp/videoai-backup/${env}/.vertex-key.json" "${TARGET_DIR}/.vertex-key.json"
        chmod 600 "${TARGET_DIR}/.vertex-key.json" 2>/dev/null || true
    fi

    echo "Installing runtime dependencies in ${TARGET_DIR}..."
    rm -rf "${TARGET_DIR}/node_modules"
    (cd "${TARGET_DIR}" && npm install --omit=dev --no-audit --no-fund)
done

# Clean up backup (ignore errors in case of permission issues)
rm -rf /tmp/videoai-backup 2>/dev/null || sudo rm -rf /tmp/videoai-backup 2>/dev/null || true

# Source environment variables
source /etc/profile.d/app-env.sh 2>/dev/null || true

# Set correct permissions
echo "Setting permissions..."
chown -R ec2-user:ec2-user "${APP_ROOT}"

# Create logs directory if it doesn't exist
mkdir -p "${APP_ROOT}/logs"
chown -R ec2-user:ec2-user "${APP_ROOT}/logs"

# Make scripts executable
for env in "${TARGET_ENVS[@]}"; do
    chmod +x "${APP_ROOT}/${env}/scripts/codedeploy/"*.sh 2>/dev/null || true
done

echo "=== AfterInstall: Complete ==="
