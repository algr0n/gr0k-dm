#!/bin/bash
# Sync local SQLite to Turso

echo "🔄 Syncing local database to Turso..."

# Check if logged in
if ! turso auth token &>/dev/null; then
    echo "Please login first: turso auth login"
    exit 1
fi

# Get database name from user or use default
DB_NAME=${1:-gr0k-dm-algr0n}

echo "📤 Generating new token..."
NEW_TOKEN=$(turso db tokens create $DB_NAME)

if [ -z "$NEW_TOKEN" ]; then
    echo "❌ Failed to generate token"
    exit 1
fi

echo "✅ Token generated"

# Update .env file
echo "📝 Updating .env file..."
sed -i.bak "s|TURSO_DATABASE_URL=.*|TURSO_DATABASE_URL=libsql://$DB_NAME.aws-us-west-2.turso.io|" .env
sed -i.bak "s|TURSO_AUTH_TOKEN=.*|TURSO_AUTH_TOKEN=$NEW_TOKEN|" .env

echo "🚀 Pushing schema to Turso..."
npm run db:push

echo "✅ Done! Your Turso database is now synced."
echo ""
echo "To switch back to local development:"
echo "  TURSO_DATABASE_URL=file:./dev.sqlite"
