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

- `versio-nova/`: interfície i regles originals; també funciona en mode local.
- `scripts/generate-engine.mjs`: genera el motor de regles del servidor.
- `server/api.mjs`: partides, participants i accions atòmiques amb control de revisió.
- `api/index.js`: entrada de Vercel Functions.
- `server/postgres-db.mjs`: connexió PostgreSQL per a producció.
- `db/postgres.sql`: esquema de producció, aplicat amb `npm run db:migrate`.
- `server/local-app.mjs` i `server/local-db.mjs`: servidor i SQLite de desenvolupament.
- `db/schema.ts` i `drizzle/`: esquema i migracions SQLite locals.
- `vercel.json`: construcció, rutes i configuració de Vercel.
- `.github/workflows/checks.yml`: proves i construcció automàtiques a GitHub.

## Publicació a Vercel

El web i el servei multijugador s’allotgen a Vercel. Les partides es desen en PostgreSQL
(per exemple, Neon amb el pla gratuït del Marketplace de Vercel).
El codi es conserva a GitHub. GitHub Pages només pot servir el tauler estàtic.

1. Vincula el projecte amb `npx vercel link` al compte propietari.
2. A Vercel → Storage, connecta una base de dades PostgreSQL al projecte per a producció.
3. Configura `DATABASE_URL` o `POSTGRES_URL` amb la connexió que facilita el proveïdor.
4. Descarrega les variables amb `npx vercel env pull .env.local --environment=production`.
5. Executa `npm run db:migrate` per crear l’esquema sense esborrar dades.
6. Executa `npm test` i publica amb `npx vercel --prod`.

La construcció genera el web a `dist/` i el motor a `.generated/`; Vercel empaqueta
`api/index.js` com a funció Node.js. El navegador fa les peticions a `/api/rooms`
del mateix domini. No cal un servidor separat ni una subscripció de ChatGPT.
Les versions de previsualització necessiten una base de dades pròpia si s’hi vol
provar el multijugador; no hi connectis la de producció automàticament.

El tauler de GitHub Pages es connecta a `https://tenis-fate.vercel.app`.
Per canviar aquest destí, actualitza `versio-nova/multiplayer.js` o configura
`window.TENIS_API_ORIGIN` abans de carregar-lo.
El servidor accepta el mateix origen i `https://gausachs.github.io`.

No pugis `.local/`, `.vercel/`, `.env*` (excepte `.env.example`), credencials,
fitxers de sessió ni `node_modules/`. Els identificadors de participants són secrets
temporals de navegador; al servidor només se’n desa el resum criptogràfic.
