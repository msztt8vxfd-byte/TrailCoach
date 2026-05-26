# TrailCoach Pro

Application de coaching trail running avec intégration Strava.

## Fonctionnalités

- **Coach** — Dashboard avec KPIs, tendances semaine/semaine, planning, analyse des performances
- **Athlète** — Programme personnalisé, suivi de séances, carte de motivation, connexion Strava
- **Strava** — OAuth 2.0, sync automatique via webhooks, analyse des activités

## Stack

| Couche | Technologie |
|---|---|
| Frontend | HTML5 + CSS3 + Vanilla JS |
| Backend | Serverless Functions (Netlify Blobs / Vercel KV) |
| Auth athlète | PIN 4 chiffres |
| Auth coach | Token secret |
| Déploiement | Netlify (principal) · Vercel (alternatif) |

## Structure

```
TrailCoach/
├── public/                 # Frontend statique
│   ├── index.html          # Interface coach
│   ├── athlete.html        # Interface athlète (mobile)
│   ├── css/
│   │   ├── shared.css
│   │   ├── coach.css
│   │   └── athlete.css
│   └── js/
│       ├── utils.js
│       ├── coach.js
│       └── athlete.js
│
├── netlify/functions/      # API Netlify (Netlify Blobs)
├── api/                    # API Vercel (Vercel KV)
│
├── docs/
│   └── DEPLOIEMENT.md      # Guide de déploiement complet
│
├── netlify.toml
├── vercel.json
└── package.json
```

## Démarrage rapide

Voir [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) pour le guide complet.

```bash
# Dev local (frontend uniquement)
npx serve public

# Ou via Python
python3 -m http.server 8080 -d public
```

## Variables d'environnement requises

```
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
COACH_TOKEN=...         # Token aléatoire pour protéger les écritures
```
