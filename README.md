# NODEJS_SCRIPT_HELPER

Début du déploiement du projet. C'est un peu le fouillis mais en phase de développement. Tous les éléments seront dans la branche alpha pour le moment le temps que toutes les fonctions, les divers modules du gestionnaire de script soient bien séparés.

## Pourquoi un gestionnaire de Script pour NodeJS ?

Ayant souvant des scripts tournant sur NodeJS et m'embêtant à chaque fois pour le lancement automatisé des scripts, j'ai choisi de faire mon propre gestionnaire de scripts pouvant interragir avec Discord pour des logs, des commandes de gestion et plus. Le nombre de scripts devenant assez conséquent, je devais trouver un moyen pour tout centraliser et les gérer. Chaque scripts est détecté par le gestionnaire et attribue des paramètres par défaut comme pour le lancement automatiqué ou le redémarrage sur crash d'un des scripts.

## Pourquoi Discord ?

Discord, c'est un réseau qui est quasiment partout mais surtout celui que j'utilise le plus. L'affichage des salons à certaines personnes uniquement, le fait de pouvoir gérer les permissions simplement, l'api accessible de Discord est un point non négligeable pour ma part pour que je puisse agir vite ou gérer à distance mes scripts sans passer par une machine à distance.  
!! **J'utilise discord car cela répond à un besoin mais il est possible de le désactiver grâce aux variables d'environnements.**

## Fonctionnement du gestionnaire

Le gestionnaire embarque tout le nécessaire pour créer des logs, redémarrer un script qui s'interromperait, les démarrer automatiquement et autre. Différentes possibilités s'offrent à vous pour gérer les scripts en cours d'execution. Il est possible d'afficher les dernières lignes que les scripts auraient sorti en console, envoyer les commandes aux scripts en cours d'execution et garder une vue en direct sur la console.

### Voici les commandes 

```text
=================================================
                    Aide console
=================================================
help : afficher l'aide
start : démarre le processus du bot
stop : arrêter complètement main et index
stop_main : arrêter complètement main et index
time : afficher le temps d'exécution du script
reload : recharger tous les modules
reload <module> : recharger le module spécifié
reload main : recharger le gestionnaire principal
refresh_modules : recharger la liste des modules
status : afficher le statut des modules
modules : lister tous les modules disponibles
settings : gérer les paramètres des modules
last_logs <module> : afficher les 50 dernières lignes de logs du module spécifié
send_command <module> <command> : envoyer une commande à un module
realtime_console [stop, all, <module>] : écouter les sorties des modules en temps réel
=================================================
```

## Configuration du gestionnaire

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

Un fichier **.env.sample** est présent dans ce repos pour donner les variables d'environnements par défaut. Il faut le copier ou juste le renommer en **.env**.

### Pour le lancement

Pour le lancement, il suffit de lancer **supervisor.js** pour garder le gestionnaire de script ouvert en cas de crash ou de lancer **main.js** pour lancer le gestionnaire de script simplement sans redémarrage en cas de crash.




# A faire

- Permettre d'apporter d'autres tunnels de communication que Discord
- Variables par défaut dans modulesDatabase.json
- Variables par défaut dans .env
- Support des API
- Vérification des variables, messages, réponses api
- Compléter le fichier de langue
- Ajouter d'autres langage
- Créer des exports des modules
- Faire fonctionner la tabulation
- Corriger les problèmes d'affichage des consoles des scripts en direct après un plantage

