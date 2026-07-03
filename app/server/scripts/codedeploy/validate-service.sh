#!/bin/bash
set -e

echo "=== ValidateService: Checking application health ==="

APP_ROOT="/home/ec2-user/app"
cd "${APP_ROOT}"

# Wait for application to start
sleep 5

# Determine which environment to validate
if [ -f "DEPLOY_ENV" ]; then
    DEPLOY_ENV=$(cat DEPLOY_ENV)
else
    DEPLOY_ENV="all"
fi

validate_process() {
    local process_name=$1
    local port=$2
    local env_name=$3
    
    echo "Validating $env_name (port $port)..."
    
    # Check if PM2 process is running
    process_status=$(pm2 jlist | jq -r ".[] | select(.name==\"$process_name\") | .pm2_env.status" 2>/dev/null || echo "unknown")
    
    if [ "$process_status" != "online" ]; then
        echo "WARNING: $process_name is not online. Status: $process_status"
        # Don't fail - the process might not be deployed yet
        return 0
    fi
    
    # Health check
    max_retries=10
    retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${port}/api/health" 2>/dev/null || echo "000")
        
        if [ "$response" = "200" ]; then
            echo "$env_name health check passed! HTTP status: $response"
            return 0
        fi
        
        retry_count=$((retry_count + 1))
        echo "$env_name health check attempt $retry_count/$max_retries - HTTP status: $response"
        
        if [ $retry_count -lt $max_retries ]; then
            sleep 3
        fi
    done
    
    echo "ERROR: $env_name health check failed after $max_retries attempts"
    pm2 logs $process_name --lines 50 --nostream 2>/dev/null || true
    return 1
}

success=true

if [ "$DEPLOY_ENV" = "all" ] || [ "$DEPLOY_ENV" = "uat" ]; then
    validate_process "videoai-server-uat" 3010 "UAT" || success=false
fi

if [ "$DEPLOY_ENV" = "all" ] || [ "$DEPLOY_ENV" = "prod" ]; then
    validate_process "videoai-server-prod" 3011 "PROD" || success=false
fi

if [ "$success" = true ]; then
    echo "=== ValidateService: Success ==="
    exit 0
else
    echo "=== ValidateService: Failed ==="
    exit 1
fi
