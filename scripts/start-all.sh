#!/bin/bash

echo "🚀 Uruchamianie wszystkich 12 stron example..."
echo ""

# Uruchom każdą stronę w tle
cd /home/dominik/strona-stride/frontend/examples/strona-example-1 && npm run dev &
sleep 2
cd /home/dominik/strona-stride/frontend/examples/strona-example-2 && npm run dev &
sleep 2
cd /home/dominik/strona-stride/frontend/examples/strona-example-3 && npm run dev &
sleep 2
cd /home/dominik/strona-stride/frontend/examples/strona-example-4 && npm run dev &
sleep 2
cd /home/dominik/strona-stride/frontend/examples/strona-example-5 && npm run dev &
sleep 2
cd /home/dominik/strona-stride/frontend/examples/strona-example-6 && npm run dev &
sleep 2
cd /home/dominik/strona-stride/frontend/examples/strona-example-7 && npm run dev &
sleep 2
cd /home/dominik/strona-stride/frontend/examples/strona-example-8 && npm run dev &
sleep 2
cd /home/dominik/strona-stride/frontend/examples/strona-example-9 && npm run dev &
sleep 2
cd /home/dominik/strona-stride/frontend/examples/strona-example-10 && npm run dev &
sleep 2
cd /home/dominik/strona-stride/frontend/examples/strona-example-11 && npm run dev &
sleep 2
cd /home/dominik/strona-stride/frontend/examples/strona-example-12 && npm run dev &

echo "✅ Wszystkie strony zostały uruchomione!"
echo ""
echo "Dostępne na:"
echo "  • http://localhost:3001 - TechStore (Sklep technologiczny)"
echo "  • http://localhost:3002 - DevSolutions (Konsulting IT)"
echo "  • http://localhost:3003 - TastyBites (Dostawa jedzenia)"
echo "  • http://localhost:3004 - FITPRO (Klub fitness)"
echo "  • http://localhost:3005 - PIXEL STUDIO (Agencja kreatywna)"
echo "  • http://localhost:3006 - LUXESTATE (Luksusowe nieruchomości)"
echo "  • http://localhost:3007 - ÉLÉGANCE (Fashion Store)"
echo "  • http://localhost:3008 - LENSCRAFT (Photography Studio)"
echo "  • http://localhost:3009 - ARCHMIND (Architecture Firm)"
echo "  • http://localhost:3010 - Sterling & Associates (Law Firm)"
echo "  • http://localhost:3011 - HealthCare Plus (Medical Clinic)"
echo "  • http://localhost:3012 - LearnHub (Education Platform)"
echo ""
echo "Naciśnij Ctrl+C aby zatrzymać wszystkie serwery"

wait
