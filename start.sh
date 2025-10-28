#!/bin/bash

# Sovellusportfolio käynnistysskripti

echo "🚀 Käynnistetään Sovellusportfolio..."

# Tarkista onko .env tiedosto olemassa
if [ ! -f .env ]; then
    echo "⚠️  .env tiedosto puuttuu!"
    echo "📋 Kopioi env.example .env nimellä ja täytä GitHub-token:"
    echo "   cp env.example .env"
    echo ""
    echo "🔑 Lisää .env tiedostoon:"
    echo "   GITHUB_TOKEN=your_github_personal_access_token_here"
    echo "   GITHUB_USERNAME=your_github_username"
    echo ""
    exit 1
fi

# Tarkista onko node_modules olemassa
if [ ! -d "node_modules" ]; then
    echo "📦 Asennetaan riippuvuudet..."
    npm install
fi

# Käynnistä sovellus
echo "🌐 Käynnistetään sovellus portissa 3000..."
echo "🔗 Avaa selain osoitteessa: http://localhost:3000"
echo ""

npm start
