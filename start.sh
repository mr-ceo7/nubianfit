#!/bin/bash

# Configuration
FRONTEND_PORT=3000
BACKEND_PORT=8000

echo "=================================================="
echo " Starting NubianFit Application Services "
echo "=================================================="

# Function to free a port by finding and killing its process
free_port() {
  local port=$1
  echo "Checking port $port..."
  
  # Try using lsof to find PIDs
  if command -v lsof >/dev/null 2>&1; then
    local pids=$(lsof -t -i :$port)
    if [ -n "$pids" ]; then
      echo "-> Killing processes on port $port: $pids"
      kill -9 $pids 2>/dev/null
      sleep 1
    fi
  else
    # Fallback to fuser if lsof is not available
    if command -v fuser >/dev/null 2>&1; then
      echo "-> Freeing port $port using fuser..."
      fuser -k $port/tcp >/dev/null 2>&1
      sleep 1
    fi
  fi
}

# Free ports first to avoid address-already-in-use errors
free_port $FRONTEND_PORT
free_port $BACKEND_PORT

# Setup cleanup function to terminate servers on Ctrl+C (SIGINT/SIGTERM)
cleanup() {
  echo ""
  echo "=================================================="
  echo "       Stopping NubianFit Servers...              "
  echo "=================================================="
  kill "$BACKEND_PID" 2>/dev/null || true
  kill "$FRONTEND_PID" 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

# Check and setup Python Virtual Environment if needed
if [ ! -d "backend/venv" ]; then
  echo "Creating Python virtual environment in backend/venv..."
  python3 -m venv backend/venv
  ./backend/venv/bin/pip install --upgrade pip
  ./backend/venv/bin/pip install -r backend/requirements.txt
fi

# Ensure database is seeded
if [ ! -f "backend/nubianfit.db" ]; then
  echo "Initializing and seeding database..."
  ./backend/venv/bin/python backend/seed_data.py
fi

# Start Backend Server
echo "Starting FastAPI Backend Server..."
cd backend
if [ -f "./venv/bin/uvicorn" ]; then
  ./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port $BACKEND_PORT &
  BACKEND_PID=$!
else
  python3 -m uvicorn app.main:app --host 0.0.0.0 --port $BACKEND_PORT &
  BACKEND_PID=$!
fi
cd ..

# Start Frontend Server
echo "Starting Vite Frontend Server..."
npm run dev > /dev/null 2>&1 &
FRONTEND_PID=$!

echo "=================================================="
echo " 🏋️ NubianFit Services successfully started!"
echo " - Frontend: http://localhost:$FRONTEND_PORT"
echo " - Backend:  http://localhost:$BACKEND_PORT"
echo " - API Docs: http://localhost:$BACKEND_PORT/docs"
echo "=================================================="
echo "Tailing backend logs directly (Press Ctrl+C to stop servers)..."
echo "--------------------------------------------------"

# Wait for background processes to keep the script alive
wait
