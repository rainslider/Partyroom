# Partyroom

Maak een party, krijg een code van 5 tekens en laat anderen die invullen bij Join party.
De website staat op `/party`, bijvoorbeeld `https://www.rainslider.com/party`.

## Lokaal proberen

Je hebt Node.js 18 of nieuwer nodig (nodejs.org).

    node server.js

Open daarna http://localhost:3000/party. Open het in twee tabbladen om te testen.

## Online zetten met Render (eenvoudigste route)

1. Maak een gratis account op github.com en een nieuwe repository. Upload alle bestanden uit deze map (`server.js`, `package.json`, `index.html`).
2. Maak een account op render.com en kies New > Web Service. Kies je repository.
3. Instellingen: Runtime Node, Build Command leeg laten, Start Command `node server.js`.
4. Na het deployen krijg je een adres als `partyroom.onrender.com/party`. Controleer dat het werkt.
5. Ga in Render naar Settings > Custom Domains en voeg `www.rainslider.com` toe. Render laat zien welk DNS-record je moet aanmaken.
6. Ga naar de plek waar je rainslider.com hebt gekocht, open de DNS-instellingen en maak dat record aan (meestal een CNAME voor `www`).

Het gratis Render-plan gaat na een tijdje inactiviteit slapen. De eerste bezoeker wacht dan een halve minuut. Een betaald plan heeft dat niet.

Staat er al een andere website op rainslider.com? Dan kan `/party` niet op dezelfde plek staan. Gebruik dan `party.rainslider.com` (een CNAME voor `party`), of laat de hoofdwebsite `/party` doorsturen naar de Partyroom-server.

## Hoe het werkt

- Party maken: de server maakt een code en onthoudt wie er in de party zit.
- Join party: de server zoekt de code. Bestaat hij niet, dan krijg je een melding.
- Parties zitten alleen in het geheugen. Als de server herstart, zijn alle parties weg.
- Maximaal 20 mensen per party en 2000 parties tegelijk (aan te passen bovenaan `server.js`).
