# Firebase Index Management System

This document describes the centralized Firebase index management system for both QuickLifts and PulseCheck applications.

## Overview

All Firebase configurations (indexes, rules, and project settings) are now centrally managed from the `QuickLifts-Web` project. This ensures consistency across all platforms and simplifies maintenance.

## Project Structure

```
QuickLifts-Web/
├── firebase.json              # Firebase CLI configuration
├── firestore.indexes.json     # Consolidated indexes for all apps
├── firestore.rules           # Security rules
└── scripts/
    └── sync-firebase-indexes.sh  # Index synchronization script
```

## Index Organization

The `firestore.indexes.json` file contains indexes for:

### QuickLifts App Collections
- `daily-health-summaries` - User health data queries
- `exerciseVideos` - Exercise content queries
- `workout-summaries` - Workout completion tracking
- `plans` - Workout plan queries
- `payments` - Payment history
- `coaches` - Coach management
- `promoCodes` - Promotional code system
- And many more...

### PulseCheck App Collections
- `conversations` - Chat conversations
- `messages` - Chat messages
- `user-mental-notes` - Mental health notes
- `subscriptions` - Subscription management

### Shared Collections
- `users` - User profiles and data
- `notes` - General notes system

## Firebase Projects

- **Development**: `quicklifts-dev-01`
- **Production**: `quicklifts-dd3f1`

## Sync Script Usage

The `sync-firebase-indexes.sh` script provides several commands for managing Firebase indexes across development and production environments.

### 📋 Information & Validation Commands

#### Show Current Configuration
```bash
./scripts/sync-firebase-indexes.sh info
```
**Output Example:**
```
📋 Current Firebase Projects:
  🔧 Development: quicklifts-dev-01
  🚀 Production:  quicklifts-dd3f1

📂 Configuration Files:
  📄 Indexes: firestore.indexes.json
  🔒 Rules:   firestore.rules
  ⚙️  Config:  firebase.json

📊 Local Index Configuration:
  🔍 Composite Indexes: 44
  ⚡ Field Overrides: 5
```

#### Validate Configuration Files
```bash
./scripts/sync-firebase-indexes.sh validate
```
**What it checks:**
- JSON syntax in `firestore.indexes.json`
- Existence of required files
- Firebase CLI authentication
- Project access permissions

### 🔄 Deployment Commands

#### Sync Everything (Recommended)
```bash
./scripts/sync-firebase-indexes.sh sync
```
**What it does:**
1. Validates configuration files
2. Backs up current indexes from both environments
3. Deploys indexes to development
4. Deploys indexes to production
5. Deploys security rules to both environments

#### Deploy Indexes Only
```bash
./scripts/sync-firebase-indexes.sh indexes
```
**Use when:** You only want to update indexes, not security rules

#### Deploy Rules Only
```bash
./scripts/sync-firebase-indexes.sh rules
```
**Use when:** You only want to update security rules, not indexes

### 🎯 Environment-Specific Commands

#### Deploy to Development Only
```bash
./scripts/sync-firebase-indexes.sh dev
```
**Use when:** Testing new indexes before production deployment

#### Deploy to Production Only
```bash
./scripts/sync-firebase-indexes.sh prod
```
**Use when:** Development is already up-to-date, only production needs updates

### 🔍 Comparison Commands

#### Compare Both Environments
```bash
./scripts/sync-firebase-indexes.sh compare
```
**Output Example:**
```
🔍 Comparing local vs remote indexes for Development (quicklifts-dev-01)...
✅ Retrieved remote indexes
📊 Index Comparison:
  📄 Local indexes:  44
  ☁️  Remote indexes: 42
⚠️  Local has more indexes - consider syncing

🔍 Comparing local vs remote indexes for Production (quicklifts-dd3f1)...
✅ Retrieved remote indexes
📊 Index Comparison:
  📄 Local indexes:  44
  ☁️  Remote indexes: 44
✅ Index counts match
```

#### Compare Specific Environment
```bash
# Development only
./scripts/sync-firebase-indexes.sh compare-dev

# Production only
./scripts/sync-firebase-indexes.sh compare-prod
```

### 💾 Backup Commands

#### Backup Both Environments
```bash
./scripts/sync-firebase-indexes.sh backup
```
**Creates files like:**
- `backups/firestore.indexes.backup.quicklifts-dev-01.20241201_143022.json`
- `backups/firestore.indexes.backup.quicklifts-dd3f1.20241201_143023.json`

**Use when:** You want to create manual backups before major changes

## Key Features

### 🔄 Additive Deployment
- The script **never deletes** existing indexes
- Only adds new indexes defined in the configuration
- Preserves manually created indexes from Firebase Console

### 💾 Automatic Backups
- Creates timestamped backups before each deployment
- Backups stored in `backups/` directory (gitignored)

### 🔍 Validation
- Validates JSON syntax before deployment
- Checks Firebase CLI authentication
- Verifies project access

### 📊 Comparison Tools
- Compare local configuration with remote indexes
- Shows index count differences
- Helps identify sync needs

## Setup Instructions

1. **Install Firebase CLI**:
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Test the setup**:
   ```bash
   ./scripts/sync-firebase-indexes.sh info
   ```

4. **Sync indexes**:
   ```bash
   ./scripts/sync-firebase-indexes.sh sync
   ```

## Common Workflows

### 🆕 Adding New Indexes

1. **Edit** `firestore.indexes.json` to add your new indexes
2. **Validate** the configuration:
   ```bash
   ./scripts/sync-firebase-indexes.sh validate
   ```
3. **Deploy** to development first:
   ```bash
   ./scripts/sync-firebase-indexes.sh dev
   ```
4. **Test** your queries in development
5. **Deploy** to production:
   ```bash
   ./scripts/sync-firebase-indexes.sh prod
   ```

### 🔄 Regular Sync Workflow

**Weekly/Monthly maintenance:**
```bash
# 1. Check current status
./scripts/sync-firebase-indexes.sh compare

# 2. If differences found, sync everything
./scripts/sync-firebase-indexes.sh sync
```

### 🚨 Emergency Production Fix

**When production needs immediate index updates:**
```bash
# 1. Validate first
./scripts/sync-firebase-indexes.sh validate

# 2. Deploy directly to production
./scripts/sync-firebase-indexes.sh prod

# 3. Update development later
./scripts/sync-firebase-indexes.sh dev
```

### 🧪 Testing New Features

**When developing new features that need indexes:**
```bash
# 1. Add indexes to firestore.indexes.json
# 2. Deploy to development only
./scripts/sync-firebase-indexes.sh dev

# 3. Test your feature
# 4. When ready, deploy to production
./scripts/sync-firebase-indexes.sh prod
```

## Real-World Examples

### Example 1: Adding a New Collection Index

**Scenario:** Adding indexes for a new `user-preferences` collection

1. **Edit `firestore.indexes.json`:**
```json
{
  "collectionGroup": "user-preferences",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "userId",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "updatedAt",
      "order": "DESCENDING"
    }
  ]
}
```

2. **Deploy and test:**
```bash
./scripts/sync-firebase-indexes.sh validate
./scripts/sync-firebase-indexes.sh dev
# Test your queries...
./scripts/sync-firebase-indexes.sh prod
```

### Example 2: Checking Sync Status

**Scenario:** You suspect indexes are out of sync

```bash
# Check both environments
./scripts/sync-firebase-indexes.sh compare

# Output might show:
# Development: 44 local, 42 remote ⚠️ Local has more
# Production: 44 local, 44 remote ✅ Match

# Sync development
./scripts/sync-firebase-indexes.sh dev
```

### Example 3: Backup Before Major Changes

**Scenario:** About to deploy many new indexes

```bash
# Create backups first
./scripts/sync-firebase-indexes.sh backup

# Then deploy
./scripts/sync-firebase-indexes.sh sync
```

## Best Practices

### Index Design
- Always include `userId` as the first field for user-scoped queries
- Use `DESCENDING` order for timestamp fields when showing recent items first
- Consider query patterns from all client apps (iOS, Web, Android)

### Deployment Workflow
1. Test locally with development database
2. Deploy to development environment first
3. Verify queries work correctly
4. Deploy to production during low-traffic periods

### Maintenance
- Run `compare` command regularly to check sync status
- Keep backups of important index configurations
- Document the purpose of complex composite indexes

## Troubleshooting

### Common Issues

**"Firebase CLI not found"**
```bash
npm install -g firebase-tools
```

**"Not logged in to Firebase"**
```bash
firebase login
```

**"Invalid JSON"**
```bash
./scripts/sync-firebase-indexes.sh validate
```

**"Permission denied"**
- Ensure you have Editor or Owner role on Firebase projects
- Check that you're logged in with the correct Google account

### Getting Help

1. Check the script output for specific error messages
2. Use `./scripts/sync-firebase-indexes.sh validate` to check configuration
3. Use `./scripts/sync-firebase-indexes.sh compare` to see differences
4. Check Firebase Console for index build status

## Migration Notes

This system consolidates Firebase configurations that were previously scattered across:
- `iOS/PulseCheck/` - PulseCheck-specific configs (now removed)
- `iOS/QuickLifts/` - QuickLifts-specific configs (still exists for iOS-specific files)
- `QuickLifts-Web/` - Web app configs (now the central location)

All index management should now be done through this centralized system.

---

## Quick Reference

### 📋 Most Common Commands

```bash
# Check status
./scripts/sync-firebase-indexes.sh info

# Compare environments
./scripts/sync-firebase-indexes.sh compare

# Sync everything
./scripts/sync-firebase-indexes.sh sync

# Deploy to dev only
./scripts/sync-firebase-indexes.sh dev

# Validate before deploying
./scripts/sync-firebase-indexes.sh validate
```

### 🚀 Quick Start Checklist

- [ ] Install Firebase CLI: `npm install -g firebase-tools`
- [ ] Login to Firebase: `firebase login`
- [ ] Test connection: `./scripts/sync-firebase-indexes.sh info`
- [ ] Check sync status: `./scripts/sync-firebase-indexes.sh compare`
- [ ] Deploy if needed: `./scripts/sync-firebase-indexes.sh sync`

### 📁 File Locations

- **Indexes**: `firestore.indexes.json` (44 indexes)
- **Rules**: `firestore.rules`
- **Config**: `firebase.json`
- **Script**: `scripts/sync-firebase-indexes.sh`
- **Backups**: `backups/` (auto-created, gitignored)
- **Temp files**: `temp/` (auto-created, gitignored)

### 🎯 Projects

- **Development**: `quicklifts-dev-01`
- **Production**: `quicklifts-dd3f1`

### ⚡ Key Features

- ✅ **Additive deployment** - Never deletes existing indexes
- ✅ **Automatic backups** - Before each deployment
- ✅ **Validation** - JSON syntax and authentication checks
- ✅ **Comparison tools** - Local vs remote index counts
- ✅ **Environment separation** - Deploy to dev/prod independently
- ✅ **Comprehensive logging** - Detailed output for troubleshooting
