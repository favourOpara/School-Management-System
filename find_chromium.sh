#!/bin/bash
# Find chromium executable and set environment variable

# Search for chromium
CHROMIUM_PATH=""

echo "Searching for Chromium executable..."

# Method 1: Check nix store with glob pattern (Railway/Nixpacks)
if [ -z "$CHROMIUM_PATH" ]; then
    echo "Checking /nix/store..."
    for nixpath in /nix/store/*/bin/chromium; do
        if [ -f "$nixpath" ]; then
            CHROMIUM_PATH="$nixpath"
            echo "  Found in nix store: $nixpath"
            break
        fi
    done
fi

# Method 2: Check chromium-unwrapped in nix store
if [ -z "$CHROMIUM_PATH" ]; then
    for nixpath in /nix/store/*/bin/chromium-unwrapped; do
        if [ -f "$nixpath" ]; then
            CHROMIUM_PATH="$nixpath"
            echo "  Found chromium-unwrapped in nix store: $nixpath"
            break
        fi
    done
fi

# Method 3: Check standard locations
if [ -z "$CHROMIUM_PATH" ]; then
    echo "Checking standard paths..."
    for path in /usr/bin/chromium /usr/bin/chromium-browser /usr/bin/google-chrome /usr/bin/google-chrome-stable /usr/bin/chromium-unwrapped; do
        if [ -f "$path" ]; then
            CHROMIUM_PATH="$path"
            echo "  Found: $path"
            break
        fi
    done
fi

# Method 4: Try 'which' command
if [ -z "$CHROMIUM_PATH" ]; then
    echo "Trying 'which' command..."
    for cmd in chromium chromium-browser google-chrome chromium-unwrapped; do
        WHICH_RESULT=$(which $cmd 2>/dev/null)
        if [ -n "$WHICH_RESULT" ] && [ -f "$WHICH_RESULT" ]; then
            CHROMIUM_PATH="$WHICH_RESULT"
            echo "  Found via which: $WHICH_RESULT"
            break
        fi
    done
fi

# Export and print result
if [ -n "$CHROMIUM_PATH" ]; then
    export CHROMIUM_EXECUTABLE_PATH="$CHROMIUM_PATH"
    echo ""
    echo "✓ Chromium found at: $CHROMIUM_PATH"
    echo "✓ CHROMIUM_EXECUTABLE_PATH set successfully"
else
    echo ""
    echo "✗ Chromium not found! PDF generation will not work."
    echo "✗ Searched in:"
    echo "  - /nix/store/*/bin/chromium"
    echo "  - /nix/store/*/bin/chromium-unwrapped"
    echo "  - /usr/bin/chromium*"
    echo "  - which chromium"
fi
