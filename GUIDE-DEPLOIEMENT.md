# 🚀 Déployer TrailCoach Pro — Guide complet pas-à-pas

---

## Ce que tu vas obtenir
**https://trailcoach-tonnom.netlify.app** — en ligne, gratuit, HTTPS, avec Strava réel.

---

## ① Créer un compte Netlify (2 min)

1. Va sur → **https://netlify.com**
2. Clique **"Sign up"** → choisis **"Sign up with email"** (ou GitHub si tu en as un)
3. Vérifie ton email → clique le lien de confirmation
4. Tu arrives sur le **dashboard Netlify** ✅

---

## ② Déployer le dossier (1 min)

1. Sur le dashboard Netlify, tu vois la section **"Sites"**
2. Repère le cadre avec le texte **"Drag and drop your site output folder here"**
3. **Glisse-dépose le dossier `trailcoach-netlify`** entier dans cette zone
4. Netlify déploie automatiquement ⚡ (10–20 secondes)
5. Tu reçois une URL type → `https://amazing-curie-abc123.netlify.app`

> 💡 **Note ta nouvelle URL** — tu en auras besoin à l'étape ④

---

## ③ Créer ton application Strava (5 min)

1. Va sur → **https://www.strava.com/settings/api**
   *(connecte-toi à Strava si demandé)*

2. Clique **"Create & Manage Your App"**

3. Remplis le formulaire :
   | Champ | Valeur |
   |-------|--------|
   | **App Name** | TrailCoach Pro |
   | **Category** | Coaching |
   | **Club** | *(laisser vide)* |
   | **Website** | `https://ton-url.netlify.app` |
   | **Authorization Callback Domain** | `ton-url.netlify.app` ← **SANS https://** |
   | **App Description** | Coaching trail running |

4. Coche la case conditions → Clique **"Create"**

5. Tu vois maintenant ta page API avec :
   - **Client ID** : un nombre (ex: `123456`) → **NOTE-LE**
   - **Client Secret** : une longue chaîne → **NOTE-LE** (clique 👁 pour voir)

---

## ④ Ajouter les secrets Strava sur Netlify (3 min)

> ⚠️ Le Client Secret ne doit JAMAIS être dans le code — il reste côté serveur Netlify.

1. Va sur **https://app.netlify.com** → clique sur ton site
2. Dans le menu : **"Site configuration"** → **"Environment variables"**
3. Clique **"Add a variable"** → **"Add a single variable"**
4. Ajoute cette première variable :
   - **Key** : `STRAVA_CLIENT_ID`
   - **Value** : ton Client ID (ex: `123456`)
   - Clique **"Create variable"**

5. Refais **"Add a variable"** pour la deuxième :
   - **Key** : `STRAVA_CLIENT_SECRET`
   - **Value** : ton Client Secret (la longue chaîne)
   - Clique **"Create variable"**

6. Va dans **"Deploys"** → clique **"Trigger deploy"** → **"Deploy site"**
   *(Netlify redéploie avec les nouvelles variables — 20 secondes)*

---

## ⑤ Configurer l'app au premier lancement (30 sec)

1. Ouvre ton URL Netlify dans le navigateur
2. L'écran de setup apparaît
3. Entre ton **Client ID** (juste le nombre, ex: `123456`)
4. Clique **"Continuer →"**
5. Tu arrives sur le dashboard TrailCoach Pro ✅

---

## ⑥ Connecter un athlète à Strava

1. Dans l'app → onglet **"Athlète"**
2. Sélectionne l'athlète à connecter
3. Clique **"⚡ Connecter Strava"**
4. Un lien d'autorisation apparaît → clique **"📋 Copier le lien"**
5. Envoie ce lien à ton athlète par SMS/WhatsApp/email
6. L'athlète clique → autorise TrailCoach sur Strava → est redirigé vers ton site
7. La connexion s'établit automatiquement ✅
8. Ses activités Strava se chargent en temps réel

---

## 🔄 Synchronisation des activités

- Clique **"⚡ Sync Strava"** dans la topbar pour synchroniser tous les athlètes connectés
- Les nouvelles activités apparaissent dans la vue Athlète → Activités Strava
- Les stats se mettent à jour dans le Dashboard et l'Analyse

---

## 📁 Structure du dossier déployé

```
trailcoach-netlify/
├── index.html                     ← Application complète (HTML/CSS/JS)
├── netlify.toml                   ← Config routes + fonctions
└── netlify/
    └── functions/
        ├── strava-token.js        ← OAuth sécurisé (Client Secret protégé)
        └── strava-activities.js   ← Proxy API Strava
```

---

## 🔐 Flux OAuth Strava (comment ça marche)

```
Athlète clique le lien d'autorisation
          ↓
Strava demande : "Autoriser TrailCoach à lire tes activités ?"
          ↓
Athlète clique "Autoriser"
          ↓
Strava redirige vers ton-site.netlify.app?code=ABC&state=ATHLETE_ID
          ↓
La fonction Netlify /api/strava-token échange le code
(Client Secret utilisé côté serveur — jamais exposé au client)
          ↓
Token d'accès retourné → stocké dans l'app
          ↓
/api/strava-activities récupère les vraies activités ✅
```

---

## ❓ FAQ

**C'est gratuit ?**
Oui. Plan gratuit Netlify : hébergement illimité + 125 000 appels/mois + HTTPS auto.

**Puis-je changer l'URL ?**
Oui. Netlify → ton site → "Site configuration" → "Change site name".

**Mes données sont-elles sécurisées ?**
Oui. Le Client Secret ne quitte jamais Netlify. Les tokens Strava sont stockés en localStorage (côté coach uniquement).

**Comment mettre à jour l'app ?**
Glisse-dépose à nouveau le dossier sur Netlify → redéploiement automatique.

**Un athlète peut-il voir les données des autres ?**
Non. Chaque athlète a son propre token. L'app est une interface coach.
