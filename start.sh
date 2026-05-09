#!/bin/bash
export GOOGLE_MAPS_API_KEY="YOUR_GOOGLE_MAPS_API_KEY"
export NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="YOUR_GOOGLE_MAPS_API_KEY"
export FASTAPI_BACKEND_URL=http://localhost:8000
export PORT=3000
export HOSTNAME=0.0.0.0
cd /home/z/my-project
exec node .next/standalone/server.js
