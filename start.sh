#!/bin/bash
# Start Command Center local server
cd "$(dirname "$0")"
echo "🚀 Starting Geeves Command Center..."
echo "📍 Open: http://localhost:8080"
echo ""
echo "Press Ctrl+C to stop"
python3 -m http.server 8080
