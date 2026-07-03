#!/bin/bash
set -e

echo "=== ApplicationStart: Starting the application ==="

APP_ROOT="/home/ec2-user/app"
cd "${APP_ROOT}"

# Source environment variables
source /etc/profile.d/app-env.sh 2>/dev/null || true

# Determine which environment to start/restart
# Read from DEPLOY_ENV file created by deployment script
if [ -f "DEPLOY_ENV" ]; then
    DEPLOY_ENV=$(cat DEPLOY_ENV)
else
    DEPLOY_ENV="all"
fi

echo "Deploy environment: $DEPLOY_ENV"

# Function to start or reload a PM2 process
start_or_reload() {
    local process_name=$1
    
    # Check if process exists
    if ! pm2 describe "$process_name" > /dev/null 2>&1; then
        echo "Process $process_name does not exist, starting it..."
        pm2 start "${APP_ROOT}/ecosystem.config.js" --only "$process_name"
    else
        echo "Reloading $process_name..."
        pm2 reload "$process_name" --update-env
    fi
}

if [ "$DEPLOY_ENV" = "all" ] || [ "$DEPLOY_ENV" = "uat" ]; then
    echo "Deploying UAT server (port 3010)..."
    start_or_reload "videoai-server-uat"
fi

if [ "$DEPLOY_ENV" = "all" ] || [ "$DEPLOY_ENV" = "prod" ]; then
    echo "Deploying PROD server (port 3011)..."
    start_or_reload "videoai-server-prod"
fi

# Save PM2 process list for auto-restart on reboot
pm2 save

echo "=== ApplicationStart: Complete ==="
echo "Running processes:"
pm2 list
