#!/bin/bash
# Find chromium executable and set environment variable

# Search for chromium
CHROMIUM_PATH=""

# Check nix store
if [ -z "$CHROMIUM_PATH" ]; then
    NIX_CHROMIUM=$(find /nix/store -path "*/bin/chromium" 2>/dev/null | head -n 1)
    if [ -n "$NIX_CHROMIUM" ] && [ -f "$NIX_CHROMIUM" ]; then
        CHROMIUM_PATH="$NIX_CHROMIUM"
    fi
fi

# Check standard locations
if [ -z "$CHROMIUM_PATH" ]; then
    for path in /usr/bin/chromium /usr/bin/chromium-browser /usr/bin/google-chrome /usr/bin/google-chrome-stable; do
        if [ -f "$path" ]; then
            CHROMIUM_PATH="$path"
            break
        fi
    done
fi

# Try 'which' command
if [ -z "$CHROMIUM_PATH" ]; then
    WHICH_CHROMIUM=$(which chromium 2>/dev/null)
    if [ -n "$WHICH_CHROMIUM" ] && [ -f "$WHICH_CHROMIUM" ]; then
        CHROMIUM_PATH="$WHICH_CHROMIUM"
    fi
fi

# Export and print result
if [ -n "$CHROMIUM_PATH" ]; then
    export CHROMIUM_EXECUTABLE_PATH="$CHROMIUM_PATH"
    echo "✓ Chromium found at: $CHROMIUM_PATH"
else
    echo "✗ Chromium not found! PDF generation will not work."
fi
