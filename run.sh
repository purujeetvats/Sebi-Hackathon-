#!/usr/bin/env bash

# Serve the NiveshOS app from its own directory.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
app_dir="$script_dir/Sebi-Hackathon-"
port="${PORT:-8080}"

cd "$app_dir"
exec "$script_dir/node_modules/.bin/http-server" -p "$port" -c-1
