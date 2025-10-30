#!/bin/bash
#
# disable-workspace.sh
#
# Emergency rollback script to disable workspace feature
# Usage: ./scripts/disable-workspace.sh
#

set -e

echo "🛑 Disabling Workspace Feature..."

# Set FEATURE_WORKSPACE to false in environment config
if [ -f .env ]; then
  if grep -q "FEATURE_WORKSPACE" .env; then
    sed -i 's/FEATURE_WORKSPACE=true/FEATURE_WORKSPACE=false/g' .env
    echo "✓ Updated .env: FEATURE_WORKSPACE=false"
  else
    echo "FEATURE_WORKSPACE=false" >> .env
    echo "✓ Added to .env: FEATURE_WORKSPACE=false"
  fi
else
  echo "FEATURE_WORKSPACE=false" > .env
  echo "✓ Created .env with FEATURE_WORKSPACE=false"
fi

# Comment out workspace route in main.jsx if it exists
if [ -f src/main.jsx ]; then
  echo "Checking src/main.jsx for workspace route..."

  if grep -q "workspace" src/main.jsx 2>/dev/null; then
    echo "⚠️ Workspace route found in src/main.jsx"
    echo "  Manual action required: Comment out workspace route"
    echo "  Line pattern: {currentView === 'workspace' && (<WorkspaceView />)}"
  else
    echo "✓ No workspace route modifications needed in src/main.jsx"
  fi
else
  echo "⚠️ src/main.jsx not found"
fi

# Clear any workspace state from IndexedDB (optional, aggressive)
read -p "🗑️  Clear workspace data from IndexedDB? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  cat > /tmp/clear-workspace-db.js << 'EOF'
// Run this in browser console to clear workspace data
(async () => {
  try {
    await indexedDB.deleteDatabase('fractamind-federation-db');
    console.log('✓ Cleared workspace database');
  } catch (error) {
    console.error('Failed to clear workspace database:', error);
  }
})();
EOF
  echo "✓ Generated IndexedDB clear script: /tmp/clear-workspace-db.js"
  echo "  Run the contents of this file in the browser console to clear workspace data"
fi

echo ""
echo "✅ Workspace feature disabled"
echo ""
echo "Next steps:"
echo "1. Restart the development server"
echo "2. Refresh the browser"
echo "3. Verify workspace menu/button is hidden"
echo "4. (Optional) Run /tmp/clear-workspace-db.js in browser console to clear data"
echo ""
echo "To re-enable: Set FEATURE_WORKSPACE=true in .env and restart"
