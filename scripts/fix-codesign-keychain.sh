#!/bin/bash
# Fixes errSecInternalComponent after a login-keychain password reset.
set -euo pipefail

KEYCHAIN="$HOME/Library/Keychains/login.keychain-db"

echo "This will unlock your login keychain and allow codesign to use your Apple certificates."
echo "Enter the same password you use to log into this Mac."
echo

# Prompt securely (no echo)
read -r -s -p "Mac login password: " PASS
echo
echo

security unlock-keychain -p "$PASS" "$KEYCHAIN"
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$PASS" "$KEYCHAIN" >/dev/null

echo "Testing codesign…"
TMP="$(mktemp)"
echo probe >"$TMP"
if codesign -s "Apple Distribution: Gideon Osborn (G4WDW7JC4M)" -f "$TMP" 2>/tmp/codesign-test.err; then
  echo "✅ codesign works. Go back to Xcode → Product → Archive."
else
  echo "❌ codesign still failing:"
  cat /tmp/codesign-test.err
  echo
  echo "Next: restart the Mac, run this script once more, then Archive."
fi
rm -f "$TMP"
PASS=""
