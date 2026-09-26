# Tenis Fate

Joc de tenis per torns en català, amb daus Fate i partides compartides.

## Jugar

La versió actual és `versio-nova/`. Els fitxers de l’arrel conserven el prototip original.

- **Mode local:** obre `versio-nova/index.html` i configura qui serveix i el nombre de sets.
- **Mode compartit:** des del web publicat, configura la partida i prem **Crear partida compartida**. Es crea una partida nova amb aquestes opcions i les fitxes inicials (característiques 2, energia 5, recuperació 50%). Comparteix l’enllaç.
- Tothom que tingui l’enllaç pot entrar i controlar els dos tenistes. Aquest és el mode col·laboratiu actual.
- Els altres participants reben els canvis aproximadament cada segon. Els daus i les regles s’executen al servidor; el navegador envia accions, mai el resultat que vol obtenir.
- Les partides es desen al servidor. Si recarregues la pàgina o tornes a l’enllaç, recuperes la partida. Durant una interrupció de connexió es pausen les accions.
- **Sortir de la partida** torna al mode local. Per iniciar una altra partida compartida, surt i crea’n una de nova.

## Desenvolupament

Node.js 22.12 o posterior.

```sh
npm ci
npm run dev
```

El servidor mostra l’adreça local. La base de dades local es desa a `.local/tenis.sqlite` (exclosa de Git).

```sh
npm test
npm run build
```

Les proves cobreixen dos participants, accions simultànies, revisions obsoletes, permisos, validació d’accions, volea, saque i persistència de la mateixa partida.

## Estructura

- `versio-nova/`: interfície i regles originals; també continua funcionant en mode local.
- `scripts/generate-engine.mjs`: genera una versió aïllada de les mateixes regles per al servidor, sense avaluació dinàmica de codi.
- `server/game-dom.mjs`: adaptador del tauler per executar les regles sense navegador.
- `server/api.mjs`: sales, participants i aplicació atòmica d’accions amb control de revisió.
- `server/worker.mjs`: servidor compatible amb Cloudflare Workers i fitxers públics.
- `db/schema.ts` i `drizzle/`: esquema i migracions de la base de dades D1.
- `.github/workflows/checks.yml`: proves i construcció automàtiques a GitHub.

## Publicació i GitHub

GitHub conserva el codi. GitHub Pages només serveix fitxers estàtics i no executa la base de dades ni el servidor multijugador. El joc complet es publica amb Sites (Worker + D1), segons `.openai/hosting.json`.

La construcció produeix `dist/server/index.js`. La configuració declara el vincle D1 `DB`; no conté contrasenyes. Les migracions es generen amb `npm run db:generate` i s’apliquen durant la publicació.

No pugis `.local/`, `.env`, credencials, fitxers de sessió ni `node_modules/`. Els identificadors de participants són secrets temporals de navegador; només se’n desa el resum criptogràfic al servidor.

En el futur es pot afegir un mode de dos jugadors amb torns exclusius i espectadors. La validació centralitzada d’accions permet fer aquest canvi sense canviar les regles del joc.
