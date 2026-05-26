# 🚀 Déployer & mettre à jour TrailCoach Pro

---

## Première installation

### ① Créer un compte Netlify (2 min)

1. Va sur **https://netlify.com** → **Sign up** → avec ton email ou GitHub
2. Vérifie ton email → tu arrives sur le dashboard Netlify ✅

---

### ② Déployer le zip (1 min)

1. Sur le dashboard Netlify → **"Sites"** → bouton **"Add new site"** → **"Deploy manually"**
2. Glisse-dépose le fichier **`trailcoach-netlify.zip`** dans la zone de dépôt
3. Netlify décompresse et déploie automatiquement (20 secondes)
4. Tu reçois une URL type → `https://amazing-curie-abc123.netlify.app`

> 💡 **Personnalise l'URL** : Netlify → ton site → Site configuration → Change site name

---

### ③ Créer ton application Strava (5 min)

1. Va sur **https://www.strava.com/settings/api**
2. Clique **"Create & Manage Your App"**
3. Remplis le formulaire :

| Champ | Valeur |
|---|---|
| App Name | TrailCoach Pro |
| Category | Coaching |
| Website | `https://ton-url.netlify.app` |
| **Authorization Callback Domain** | `ton-url.netlify.app` ← sans https:// |

4. Clique **"Create"**
5. Note ton **Client ID** (un nombre) et ton **Client Secret** (longue chaîne, clique 👁 pour voir)

---

### ④ Ajouter les variables d'environnement Netlify (3 min)

Netlify → ton site → **Site configuration** → **Environment variables** → **Add a variable**

| Clé | Valeur | Obligatoire |
|---|---|---|
| `STRAVA_CLIENT_ID` | ton Client ID Strava | ✅ |
| `STRAVA_CLIENT_SECRET` | ton Client Secret Strava | ✅ |
| `COACH_TOKEN` | copié depuis ⚙ Réglages de l'app (voir étape ⑥) | ✅ |

Après avoir ajouté les variables → **Deploys** → **Trigger deploy** → **Deploy site**

---

### ⑤ Premier lancement de l'app

1. Ouvre ton URL Netlify
2. L'écran de setup apparaît → entre ton **Client ID Strava** → **Continuer**
3. Tu arrives sur le dashboard TrailCoach Pro ✅

---

### ⑥ Copier le COACH_TOKEN dans Netlify

1. Dans l'app → clique sur ton nom (coin bas gauche) → **⚙ Réglages & Cloud**
2. Copie le **Token Coach** (bouton 📋)
3. Retourne sur Netlify → **Environment variables** → ajoute `COACH_TOKEN` avec cette valeur
4. **Trigger deploy** pour que la variable soit prise en compte

---

### ⑦ Configurer le webhook Strava (sync auto)

> Le webhook permet que les activités des athlètes arrivent **automatiquement** dans l'app, sans rien faire.

1. Dans l'app → **⚙ Réglages & Cloud**
2. Section **Webhook Strava** → clique **⚡ Configurer le webhook Strava**
3. Le badge passe à **✓ Actif** → c'est terminé ✅

---

### ⑧ Connecter un athlète à Strava

1. Dans l'app → onglet **Athlète** → sélectionne un athlète
2. Clique **⚡ Connecter Strava** → copie le lien d'autorisation
3. Envoie ce lien à l'athlète (SMS / WhatsApp)
4. L'athlète clique → autorise sur Strava → connexion automatique ✅

OU l'athlète peut se connecter **lui-même** depuis **sa tablette** :
1. Ouvre son lien `ton-url.netlify.app/athlete.html?id=X`
2. Entre son PIN → clique **⚡ Connecter Strava** dans son profil
3. Autorise → ses activités se synchronisent automatiquement ✅

---

### ⑨ Donner accès à un athlète

1. Dans l'app → sélectionne l'athlète → **📤 Lien athlète**
2. Copie le lien + le PIN → envoie à l'athlète
3. L'athlète ouvre le lien sur sa tablette ou téléphone, entre son PIN
4. Il voit son programme, peut valider ses séances et connecter Strava

---

## Mettre à jour l'app (quand il y a de nouvelles fonctionnalités)

1. Récupère le nouveau fichier **`trailcoach-netlify.zip`**
2. Netlify → ton site → **Deploys** → **"Deploy manually"** (ou glisse-dépose le zip)
3. Le site se met à jour en 20 secondes ✅

> Toutes tes données sont dans **Netlify Blobs** (base de données cloud) → elles ne sont **pas effacées** lors d'une mise à jour.

---

## Architecture

```
trailcoach-netlify.zip
├── index.html                          ← Interface coach (toi)
├── athlete.html                        ← Interface athlète (tablette)
├── netlify.toml                        ← Configuration
├── package.json
└── netlify/functions/
    ├── athlete-data.js                 ← Base de données athlètes (Netlify Blobs)
    ├── strava-token.js                 ← OAuth Strava sécurisé
    ├── strava-activities.js            ← Proxy API Strava
    ├── strava-webhook.js               ← Réception events Strava (sync auto)
    └── strava-webhook-setup.js         ← Configuration webhook (1 clic)
```

---

## Variables d'environnement résumé

| Variable | Rôle | Valeur |
|---|---|---|
| `COACH_TOKEN` | Protège l'écriture dans la base | Depuis ⚙ Réglages de l'app |
| `STRAVA_CLIENT_ID` | Identifiant app Strava | strava.com/settings/api |
| `STRAVA_CLIENT_SECRET` | Secret app Strava | strava.com/settings/api |

---

## Flux de synchronisation Strava

```
Athlète finit une sortie → enregistre sur Strava / Garmin / Suunto
              ↓
Strava envoie un événement webhook à l'app
              ↓
La fonction récupère l'activité avec le token de l'athlète
              ↓
L'activité est stockée dans la base de données
La séance planifiée du même jour est validée automatiquement
              ↓
Le coach voit la mise à jour → bouton ↙ Sync statuts
L'athlète voit l'activité dans son programme ✅
```

---

## FAQ

**C'est gratuit ?**
Oui. Plan gratuit Netlify : hébergement + HTTPS + 125 000 appels fonctions/mois + Netlify Blobs 1 Go.

**Mes données sont-elles perdues si je redéploie ?**
Non. Les données des athlètes sont dans Netlify Blobs (base de données cloud), indépendante du code.

**Puis-je utiliser l'app sur téléphone ?**
Oui. `athlete.html` est optimisé mobile. L'interface coach (`index.html`) est prévue pour tablette/desktop.

**Un athlète peut-il voir les données des autres ?**
Non. Chaque athlète accède uniquement à ses données avec son PIN.
