#!/bin/sh
set -e
node setup.js
node bot.js &
node api.js
