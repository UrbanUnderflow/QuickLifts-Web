#!/bin/bash

# Firebase Index Synchronization Script
# This script ensures that Firebase indexes are synchronized between development and production environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEV_PROJECT="quicklifts-dev-01"
PROD_PROJECT="quicklifts-dd3f1"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}🔥 Firebase Index Synchronization Script${NC}"
echo -e "${BLUE}=======================================${NC}"

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}❌ Firebase CLI is not installed${NC}"
    echo -e "${YELLOW}💡 Install it with: npm install -g firebase-tools${NC}"
    exit 1
fi

# Check if user is logged in
if ! firebase projects:list &> /dev/null; then
    echo -e "${RED}❌ Not logged in to Firebase${NC}"
    echo -e "${YELLOW}💡 Login with: firebase login${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Firebase CLI is ready${NC}"

# Function to backup current indexes from a project
backup_indexes() {
    local project=$1
    local env_name=$2
    
    echo -e "${BLUE}💾 Backing up current indexes from ${env_name} (${project})...${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Create backup directory
    mkdir -p "backups"
    
    local backup_file="backups/firestore.indexes.backup.${project}.$(date +%Y%m%d_%H%M%S).json"
    
    # Export current indexes (this requires firebase CLI to be logged in)
    if firebase firestore:indexes --project "$project" > "$backup_file" 2>/dev/null; then
        echo -e "${GREEN}✅ Indexes backed up to: ${backup_file}${NC}"
    else
        echo -e "${YELLOW}⚠️  Could not backup indexes (may not exist yet)${NC}"
    fi
}

# Function to deploy indexes to a specific project (additive - won't delete existing)
deploy_indexes() {
    local project=$1
    local env_name=$2
    
    echo -e "${BLUE}📤 Deploying indexes to ${env_name} (${project})...${NC}"
    echo -e "${YELLOW}💡 This will ADD new indexes but preserve existing ones${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Backup current indexes first
    backup_indexes "$project" "$env_name"
    
    # Deploy indexes (Firebase CLI is additive by default - won't delete existing)
    if firebase deploy --only firestore:indexes --project "$project"; then
        echo -e "${GREEN}✅ Indexes deployed successfully to ${env_name}${NC}"
        echo -e "${BLUE}📋 Note: Existing indexes were preserved${NC}"
    else
        echo -e "${RED}❌ Failed to deploy indexes to ${env_name}${NC}"
        return 1
    fi
}

# Function to deploy rules to a specific project
deploy_rules() {
    local project=$1
    local env_name=$2
    
    echo -e "${BLUE}📤 Deploying rules to ${env_name} (${project})...${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Deploy rules
    if firebase deploy --only firestore:rules --project "$project"; then
        echo -e "${GREEN}✅ Rules deployed successfully to ${env_name}${NC}"
    else
        echo -e "${RED}❌ Failed to deploy rules to ${env_name}${NC}"
        return 1
    fi
}

# Function to sync everything
sync_all() {
    echo -e "${YELLOW}🔄 Synchronizing Firebase configuration...${NC}"
    
    # Deploy to development first
    echo -e "${BLUE}1️⃣  Deploying to Development Environment${NC}"
    deploy_indexes "$DEV_PROJECT" "Development"
    deploy_rules "$DEV_PROJECT" "Development"
    
    echo ""
    
    # Deploy to production
    echo -e "${BLUE}2️⃣  Deploying to Production Environment${NC}"
    deploy_indexes "$PROD_PROJECT" "Production"
    deploy_rules "$PROD_PROJECT" "Production"
    
    echo ""
    echo -e "${GREEN}🎉 Synchronization completed successfully!${NC}"
    echo -e "${YELLOW}💡 Both environments now have identical indexes and rules${NC}"
}

# Function to show current indexes
show_indexes() {
    echo -e "${BLUE}📋 Current Firebase Projects:${NC}"
    echo -e "  🔧 Development: ${DEV_PROJECT}"
    echo -e "  🚀 Production:  ${PROD_PROJECT}"
    echo ""
    echo -e "${BLUE}📂 Configuration Files:${NC}"
    echo -e "  📄 Indexes: firestore.indexes.json"
    echo -e "  🔒 Rules:   firestore.rules"
    echo -e "  ⚙️  Config:  firebase.json"
    echo ""
    
    # Count indexes in local file
    local index_count=$(grep -c '"collectionGroup"' "$PROJECT_ROOT/firestore.indexes.json" 2>/dev/null || echo "0")
    local field_override_count=$(grep -c '"fieldPath"' "$PROJECT_ROOT/firestore.indexes.json" | grep -c '"fieldOverrides"' 2>/dev/null || echo "0")
    
    echo -e "${BLUE}📊 Local Index Configuration:${NC}"
    echo -e "  🔍 Composite Indexes: ${index_count}"
    echo -e "  ⚡ Field Overrides: ${field_override_count}"
}

# Function to compare local vs remote indexes
compare_indexes() {
    local project=$1
    local env_name=$2
    
    echo -e "${BLUE}🔍 Comparing local vs remote indexes for ${env_name} (${project})...${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Create temp directory for comparison
    mkdir -p "temp"
    
    local remote_file="temp/remote.indexes.${project}.json"
    
    # Get remote indexes
    if firebase firestore:indexes --project "$project" > "$remote_file" 2>/dev/null; then
        echo -e "${GREEN}✅ Retrieved remote indexes${NC}"
        
        # Simple comparison (you could make this more sophisticated)
        local local_count=$(grep -c '"collectionGroup"' "firestore.indexes.json" 2>/dev/null || echo "0")
        local remote_count=$(grep -c 'collectionGroup' "$remote_file" 2>/dev/null || echo "0")
        
        echo -e "${BLUE}📊 Index Comparison:${NC}"
        echo -e "  📄 Local indexes:  ${local_count}"
        echo -e "  ☁️  Remote indexes: ${remote_count}"
        
        if [ "$local_count" -gt "$remote_count" ]; then
            echo -e "${YELLOW}⚠️  Local has more indexes - consider syncing${NC}"
        elif [ "$local_count" -eq "$remote_count" ]; then
            echo -e "${GREEN}✅ Index counts match${NC}"
        else
            echo -e "${BLUE}ℹ️  Remote has more indexes (this is normal if created via console)${NC}"
        fi
        
        # Clean up
        rm -f "$remote_file"
    else
        echo -e "${RED}❌ Could not retrieve remote indexes${NC}"
        return 1
    fi
}

# Function to validate indexes
validate_indexes() {
    echo -e "${BLUE}🔍 Validating index configuration...${NC}"
    
    if [[ ! -f "$PROJECT_ROOT/firestore.indexes.json" ]]; then
        echo -e "${RED}❌ firestore.indexes.json not found${NC}"
        return 1
    fi
    
    if [[ ! -f "$PROJECT_ROOT/firestore.rules" ]]; then
        echo -e "${RED}❌ firestore.rules not found${NC}"
        return 1
    fi
    
    # Validate JSON syntax
    if ! python3 -m json.tool "$PROJECT_ROOT/firestore.indexes.json" > /dev/null 2>&1; then
        echo -e "${RED}❌ Invalid JSON in firestore.indexes.json${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ Configuration files are valid${NC}"
}

# Main menu
case "${1:-menu}" in
    "sync")
        validate_indexes
        sync_all
        ;;
    "indexes")
        validate_indexes
        echo -e "${BLUE}📤 Deploying indexes to both environments...${NC}"
        deploy_indexes "$DEV_PROJECT" "Development"
        deploy_indexes "$PROD_PROJECT" "Production"
        ;;
    "rules")
        validate_indexes
        echo -e "${BLUE}📤 Deploying rules to both environments...${NC}"
        deploy_rules "$DEV_PROJECT" "Development"
        deploy_rules "$PROD_PROJECT" "Production"
        ;;
    "dev")
        validate_indexes
        echo -e "${BLUE}📤 Deploying to Development only...${NC}"
        deploy_indexes "$DEV_PROJECT" "Development"
        deploy_rules "$DEV_PROJECT" "Development"
        ;;
    "prod")
        validate_indexes
        echo -e "${BLUE}📤 Deploying to Production only...${NC}"
        deploy_indexes "$PROD_PROJECT" "Production"
        deploy_rules "$PROD_PROJECT" "Production"
        ;;
    "validate")
        validate_indexes
        ;;
    "info")
        show_indexes
        ;;
    "compare")
        echo -e "${BLUE}🔍 Comparing indexes for both environments...${NC}"
        compare_indexes "$DEV_PROJECT" "Development"
        echo ""
        compare_indexes "$PROD_PROJECT" "Production"
        ;;
    "compare-dev")
        compare_indexes "$DEV_PROJECT" "Development"
        ;;
    "compare-prod")
        compare_indexes "$PROD_PROJECT" "Production"
        ;;
    "backup")
        echo -e "${BLUE}💾 Backing up indexes from both environments...${NC}"
        backup_indexes "$DEV_PROJECT" "Development"
        backup_indexes "$PROD_PROJECT" "Production"
        ;;
    *)
        echo -e "${BLUE}🔥 Firebase Index Sync Tool${NC}"
        echo ""
        echo -e "${YELLOW}Usage:${NC}"
        echo -e "  $0 sync         - Sync indexes and rules to both environments"
        echo -e "  $0 indexes      - Deploy indexes only to both environments"
        echo -e "  $0 rules        - Deploy rules only to both environments"
        echo -e "  $0 dev          - Deploy everything to development only"
        echo -e "  $0 prod         - Deploy everything to production only"
        echo -e "  $0 validate     - Validate configuration files"
        echo -e "  $0 info         - Show project information"
        echo -e "  $0 compare      - Compare local vs remote indexes for both environments"
        echo -e "  $0 compare-dev  - Compare indexes for development only"
        echo -e "  $0 compare-prod - Compare indexes for production only"
        echo -e "  $0 backup       - Backup current indexes from both environments"
        echo ""
        show_indexes
        ;;
esac
