# NODEJS_SCRIPT_HELPER

Début du déploiement du projet. C'est un peu le fouillis mais en phase de développement. Tous les éléments seront dans la branche alpha pour le moment le temps que toutes les fonctions, les divers modules du gestionnaire de script soient bien séparés.

## Pourquoi un gestionnaire de Script pour NodeJS ?

Ayant souvant des scripts tournant sur NodeJS et m'embêtant à chaque fois pour le lancement automatisé des scripts, j'ai choisi de faire mon propre gestionnaire de scripts pouvant interragir avec Discord pour des logs, des commandes de gestion et plus. Le nombre de scripts devenant assez conséquent, je devais trouver un moyen pour tout centraliser et les gérer. Chaque scripts est détecté par le gestionnaire et attribue des paramètres par défaut comme pour le lancement automatiqué ou le redémarrage sur crash d'un des scripts.

## Pourquoi Discord ?

Discord, c'est un réseau qui est quasiment partout mais surtout celui que j'utilise le plus. L'affichage des salons à certaines personnes uniquement, le fait de pouvoir gérer les permissions simplement, l'api accessible de Discord est un point non négligeable pour ma part pour que je puisse agir vite ou gérer à distance mes scripts sans passer par une machine à distance.

## Le fonctionnement du gestionnaire

Ci-dessous, les différents éléments permettant de savoir ce que fait le script, comment le configurer et l'intégrer à votre environnement.

### Les paquets requis

Les paquets requis sont les suivants :
```txt
dotenv fs path express child_process discord.js
```

En clonant ce repository, vous pouvez simplement faire la commande ci-dessous afin de récupérer les modules de NodeJS directement.
```bash
npm update
```

### La configuration requise

Un fichier **.env.sample** est présent dans ce repos pour donner les variables d'environnements par défaut. Il faut le copier ou juste le renommer en **.env**






# A faire

- Variables par défaut dans modulesDatabase.json
- Variables par défaut dans .env
- Support des API
- Vérification des variables, messages, réponses api
- Compléter le fichier de langue
- Ajouter d'autres langage
- Créer des exports des modules

