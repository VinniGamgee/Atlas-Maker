#!/data/data/com.termux/files/usr/bin/bash

npx cap sync android

cd android || exit

./gradlew assembleRelease
