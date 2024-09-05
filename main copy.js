/*################                          ################
################    CHARGEMENT DES MODULES  ################
################                            ################*/
let startTime = performance.now();
const dotenv = require('dotenv');
dotenv.config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const { fork } = require('child_process');
let discord_enabled

if (process.env.DISCORD_ACTIVATE = "true") {
    discord_enabled = true
    const { Client, GatewayIntentBits, Partials, REST, Routes } = require('discord.js');
    const Discord_worker = new Client({
        autoReconnect: true,
        partials: [
            Partials.Channel,
            Partials.GuildMember,
            Partials.Message,
            Partials.Reaction,
            Partials.User,
            Partials.GuildScheduledEvent
        ],
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildEmojisAndStickers,
            GatewayIntentBits.GuildIntegrations,
            GatewayIntentBits.GuildWebhooks,
            GatewayIntentBits.GuildInvites,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.GuildMessageTyping,
            GatewayIntentBits.DirectMessages,
            GatewayIntentBits.DirectMessageReactions,
            GatewayIntentBits.DirectMessageTyping,
            GatewayIntentBits.GuildScheduledEvents,
            GatewayIntentBits.MessageContent
        ]
    });
    Discord_worker.login(process.env.KEY_DISCORD);
} else {
    discord_enabled = false
}

// Ajout d'Express pour l'API web
const app = express();
const port = process.env.API_PORT || 3000;

app.use(express.json());

app.listen(port, () => {
    log(`API web en cours d'écoute sur le port ${port}`);
});






/*################                          ################
################    DEFINIR LES VARIABLES   ################
################                            ################*/
const modulesDir = path.join(__dirname, 'modules');
const excludedSettingsKeys = ['name'];
const allowedSettings = ['autoStart', 'crashReload'];
let moduleCrashInfo = {}
let database = {};
let workers = {};
let workerLogs = {};
let manualStops = {};
let mainProcessCrashCount = 0;
let MAX_CRASHES = 5; // Nombre max de crashs avant d'arrêter les tentatives de redémarrage
let CRASH_WINDOW_MS = 10000;
let firstMainCrashTime = Date.now();
let channel_main = process.env.CHANNEL_MAIN;
let messages = require('./lang/' + process.env.LANG_MAIN + '.json');
const databasePath = path.join(__dirname, 'modulesDatabase.json');
let realTimeListeners = {};
let manualReloading = false;

















/*################                              ################
################    FONC LOG ET ENVOI DISCORD   ################
################                                ################*/
function log(message) {
    let date = new Date();
    let year = date.getFullYear();
    let month = date.getMonth().toString().padStart(2, '0');
    let day = date.getDate().toString().padStart(2, '0');
    let logDir = path.join(__dirname, 'logs');
    let ModulesDir = path.join(__dirname, 'modules');
    let logFile = path.join(logDir, `${year}-${month}-${day}-log-main.txt`);
    let timestamp = date.toISOString();
    let time = timestamp.slice(11, 19);
    let logMessage = `[ ${timestamp} | main ] ${message}\n`;
    console.log(`[ ${year}-${month}-${day} ${time} | main ] ${message}`);
    if (Discord_worker.isReady() && discord_enabled) Discord_worker.channels.cache.get(process.env.CHANNEL_LOG).send(`[ ${year}-${month}-${day} ${time} | main ] ${message}`);

    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
    }
    if (!fs.existsSync(ModulesDir)) {
        fs.mkdirSync(ModulesDir);
    }

    fs.appendFile(logFile, logMessage, (err) => {
        if (err) {
            console.error(messages.erreur[0] + err);
        }
    });
}

function feedback(message, source, channel = "") {
    log(message);
    if (source && source === 'discord' && discord_enabled) {
        Discord_worker.channels.cache.get(channel).send(message);
    }
}



























/*################                              ################
################    CHARGEMENT DES MODULES      ################
################                                ################*/

function findModuleNameInsensitive(name) {
    try {
        const lowerName = name.toLowerCase();
        const moduleEntry = database.modules.find(m => m.name.toLowerCase() === lowerName);
        return moduleEntry ? moduleEntry.name : null; // Retourne le nom exact ou null si non trouvé
    }
    catch {
        log("Une erreur a eu lieu avec la fonction : findModuleNameInsensitive");
        return undefined;
    }
}




async function load_modules() {
    try {
        await initializeModulesDatabase();
        database = JSON.parse(fs.readFileSync(databasePath));
        for (const module of database.modules) {
            if (module.autoStart) {
                startWorker(module.name); // Démarrer chaque worker automatiquement
            }
        }
    } catch (error) {
        console.error("Erreur lors du chargement des modules : ", error);
    }
}







function initializeModulesDatabase() {
    return new Promise((resolve, reject) => {
        fs.readdir(modulesDir, { withFileTypes: true }, (err, entries) => {
            if (err) {
                console.error(`Erreur lors de la lecture du répertoire des modules: ${err}`);
                return reject(err);
            }

            let databaseUpdated = false;
            let database = { modules: [] };
            if (fs.existsSync(databasePath)) {
                database = JSON.parse(fs.readFileSync(databasePath));
            }

            const moduleNamesInDirectory = entries.map(entry => entry.name.replace('.js', ''));

            // Ajouter ou mettre à jour les modules présents dans le dossier
            entries.forEach(entry => {
                const moduleName = entry.name.replace('.js', '');
                const modulePath = entry.isDirectory() ? path.join(modulesDir, entry.name, 'index.js') : path.join(modulesDir, `${moduleName}.js`);

                if ((entry.isDirectory() && fs.existsSync(modulePath)) || (!entry.isDirectory() && entry.name.endsWith('.js'))) {
                    if (!database.modules.some(module => module.name === moduleName)) {
                        database.modules.push({ name: moduleName, autoStart: database.default.autoStart, crashReload: database.default.autoStart, hide: false });
                        databaseUpdated = true;
                    }
                }
            });

            // Mettre à jour la valeur `hide` des modules qui ne sont plus présents dans le dossier
            database.modules.forEach(module => {
                if (!moduleNamesInDirectory.includes(module.name)) {
                    if (!module.hide) {
                        module.hide = true;
                        databaseUpdated = true;
                    }
                } else if (module.hide) {
                    module.hide = false;
                    databaseUpdated = true;
                }
            });

            if (databaseUpdated || !fs.existsSync(databasePath)) {
                fs.writeFileSync(databasePath, JSON.stringify(database, null, 2));
                console.log("Base de données des modules créée ou mise à jour.");
            }
            resolve(); // La base de données est prête
        });
    });
}






































/*################                          ################
################    GESTION DES MODULES  ################
################                            ################*/
function startWorker(moduleName) {
    const moduleInfo = database.modules.find(module => module.name === moduleName && !module.hide);

    if (!moduleInfo) {
        log(`Module ${moduleName} non trouvé ou masqué dans la base de données.`);
        return;
    }

    const modulePath = path.join(modulesDir, moduleName, 'index.js');
    const isDirectoryModule = fs.existsSync(modulePath);
    const options = isDirectoryModule ? { cwd: path.join(modulesDir, moduleName), silent: true } : { silent: true };

    workers[moduleName] = fork(isDirectoryModule ? modulePath : path.join(modulesDir, `${moduleName}.js`), [], options);

    if (!workerLogs[moduleName]) {
        workerLogs[moduleName] = [];
    }

    if (workers[moduleName].stdout) {
        workers[moduleName].stdout.on('data', (data) => {
            let log = data.toString();
            workerLogs[moduleName].push(log);
            if (workerLogs[moduleName].length > 2000) {
                workerLogs[moduleName].shift();
            }
        });
    }

    if (workers[moduleName].stderr) {
        workers[moduleName].stderr.on('data', (data) => {
            let log = data.toString();
            workerLogs[moduleName].push(log);
            if (workerLogs[moduleName].length > 2000) {
                workerLogs[moduleName].shift();
            }
        });
    }

    workers[moduleName].on('exit', (code) => {
        log(`Le worker ${moduleName} s'est arrêté avec le code ${code}.`);
        if (!manualStops[moduleName] && !manualReloading && moduleInfo.crashReload && checkModuleCrashCount(moduleName)) {
            log(`Redémarrage automatique du module ${moduleName} en raison de la configuration de crashReload.`);
            setTimeout(() => startWorker(moduleName), 5000);
        } else {
            delete manualStops[moduleName];
        }
    });

    log(`Worker pour le module ${moduleName} démarré.`);
}






function saveDatabase() {
    fs.writeFileSync(databasePath, JSON.stringify(database, null, 2), 'utf-8');
    log("La base de données des modules a été mise à jour.");
}

function checkModuleCrashCount(moduleName) {
    const now = Date.now();
    const crashInfo = moduleCrashInfo[moduleName] || { count: 0, firstCrashTime: now };

    crashInfo.count += 1;
    if (crashInfo.count === 1) {
        crashInfo.firstCrashTime = now;
    }

    if (crashInfo.count > MAX_CRASHES && (now - crashInfo.firstCrashTime) <= CRASH_WINDOW_MS) {
        log(`Trop de crashs pour ${moduleName} dans un court laps de temps, arrêt des tentatives de redémarrage.`);
        return false; // Ne pas redémarrer le module
    }

    if ((now - crashInfo.firstCrashTime) > CRASH_WINDOW_MS) {
        // Réinitialiser le compteur de crashs si la fenêtre de temps est dépassée
        crashInfo.count = 1;
        crashInfo.firstCrashTime = now;
    }

    moduleCrashInfo[moduleName] = crashInfo;
    return true; // Redémarrer le module
}


function convertToHMS(milliseconds) {
    let hours = Math.floor(milliseconds / 3600000);
    milliseconds = milliseconds % 3600000;
    let minutes = Math.floor(milliseconds / 60000);
    milliseconds = milliseconds % 60000;
    let seconds = Math.floor(milliseconds / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
}

function updateModuleSetting(moduleName, settingKey, settingValue, source, channel) {
    const exactModuleName = findModuleNameInsensitive(moduleName);
    if (!exactModuleName) {
        feedback(`Module ${moduleName} non trouvé.`, source, channel);
        return;
    }

    const module = database.modules.find(m => m.name === exactModuleName);
    if (!module) {
        feedback(`Module ${exactModuleName} non trouvé.`, source, channel);
        return;
    }

    // Trouver la clé de paramètre en tenant compte de la casse
    const normalizedSettingKey = Object.keys(module).find(key => key.toLowerCase() === settingKey.toLowerCase());

    if (!normalizedSettingKey || !allowedSettings.map(s => s.toLowerCase()).includes(normalizedSettingKey.toLowerCase())) {
        feedback(`Le paramètre ${settingKey} n'est pas autorisé. Seuls les paramètres suivants sont autorisés: ${allowedSettings.join(", ")}.`, source, channel);
        return;
    }

    try {
        // Conversion de la valeur du paramètre au type approprié
        const valueType = typeof module[normalizedSettingKey];
        const convertedValue = convertValue(settingValue, valueType);
        module[normalizedSettingKey] = convertedValue;
        feedback(`Paramètre ${normalizedSettingKey} du module ${exactModuleName} mis à jour avec la valeur ${settingValue}.`, source, channel);
        saveDatabase();
    } catch (error) {
        feedback(`Erreur lors de la mise à jour du paramètre : ${error.message}`, source, channel);
    }
}

function convertValue(value, valueType) {
    switch (valueType) {
        case 'boolean':
            if (value.toLowerCase() === 'true') return true;
            if (value.toLowerCase() === 'false') return false;
            throw new Error(`Valeur invalide pour le type boolean : ${value}`);
        case 'number':
            const numberValue = parseFloat(value);
            if (isNaN(numberValue)) throw new Error(`Valeur invalide pour le type number : ${value}`);
            return numberValue;
        case 'string':
            return value; // Pas besoin de conversion
        default:
            throw new Error(`Type non géré : ${valueType}`);
    }
}































/*################                      ################
################    GESTION COMMANDES     ################
################                        ################*/

function handleCommand(action, moduleName, source, channel = "", args = []) {
    // Normaliser le nom du module en minuscules pour la comparaison
    const normalizedModuleName = moduleName.toLowerCase();

    switch (action) {
        case 'time':
            time(source, channel);
            break;
        case 'stop_main':
            stop_main(source, channel);
            break;
        case 'start':
            startModule(normalizedModuleName, source, channel);
            break;
        case 'stop':
            stopModule(normalizedModuleName, source, channel);
            break;
        case 'reload':
            reloadModule(normalizedModuleName, source, channel);
            break;
        case 'refresh_modules':
            refreshModules(source, channel);
            break;
        case 'status':
            showStatus(source, channel);
            break;
        case 'modules':
            listModules(source, channel);
            break;
        case 'settings':
            manageSettings(source, channel, args);
            break;
        case 'last_logs':
            getLastModuleLogs(normalizedModuleName, source, channel);
            break;
        case 'send_command':
            if (args.length < 3) {
                feedback('Usage: send_command <moduleName> <command>', source, channel);
                return;
            }
            const commandToSend = args.slice(2).join(' ');
            sendCommandToWorker(normalizedModuleName, commandToSend, source, channel);
            break;
        case 'realtime_console':
            handleRealTimeConsole(args, source, channel);
            break;
        default:
            feedback('Commande non reconnue.', source, channel);
            break;
    }
}

function time(source, channel = "") {
    let executionTimeMain = performance.now() - startTime;
    let hms = convertToHMS(executionTimeMain);
    feedback(`Le temps d'exécution du script principal est de ${hms}m`, source, channel);
}

function stop_main(source, channel = "") {
    feedback('Arrêt du processus principal', source, channel);
    process.exit(0);
}

function startModule(moduleName, source, channel = "") {
    if (moduleName === 'all') {
        feedback("Démarrage de tous les modules...", source, channel);
        database.modules.forEach(module => {
            // Vérifie si le worker pour le module n'existe pas ou n'est pas connecté avant de démarrer
            if (!workers[module.name] || !workers[module.name].connected) {
                startWorker(module.name); // Démarrage du module si non actif
            } else {
                feedback(`Le module ${module.name} est déjà actif.`, source, channel);
            }
        });
    } else {
        const exactModuleName = findModuleNameInsensitive(moduleName);
        if (exactModuleName) {
            // Vérifie également ici si le module est déjà en cours d'exécution
            if (!workers[exactModuleName] || !workers[exactModuleName].connected) {
                feedback(`Démarrage du module ${exactModuleName}...`, source, channel);
                startWorker(exactModuleName);
            } else {
                feedback(`Le module ${exactModuleName} est déjà actif.`, source, channel);
            }
        } else {
            feedback(`Module ${moduleName} non trouvé.`, source, channel);
        }
    }
}

function stopModule(moduleName, source, channel = "") {
    const exactModuleName = findModuleNameInsensitive(moduleName);
    if (moduleName === 'all') {
        feedback("Arrêt de tous les modules...", source, channel);
        Object.keys(workers).forEach(name => {
            if (name !== 'main') {
                workers[name].kill();
                manualStops[name] = true; // Marque comme arrêté manuellement
            }
        });
    } else if (workers[exactModuleName]) {
        if (!workers[exactModuleName]) {
            return res.status(404).json({ error: "Worker non trouvé." });
        }
        feedback(`Arrêt du module ${moduleName}...`, source, channel);
        manualStops[exactModuleName] = true; // Marquez le worker comme arrêté manuellement
        workers[exactModuleName].kill();
        delete workers[exactModuleName];
    } else {
        feedback(`Module ${moduleName} non trouvé.`, source, channel);
    }
}

function reloadModule(moduleName, source, channel = "") {
    manualReloading = true;

    if (moduleName === 'all') {
        feedback("Rechargement de tous les modules...", source, channel);
        Object.keys(workers).forEach(name => {
            if (name !== 'main') {
                if (workers[name]) {
                    workers[name].kill();
                    delete workers[name];
                }
                startWorker(name);
            }
        });
    } else if (moduleName === 'main') {
        feedback("Rechargement du gestionnaire principal...", source, channel);
        process.exit(0); // This will trigger a restart of the main process if managed by a process manager like PM2
    } else {
        const exactModuleName = findModuleNameInsensitive(moduleName);
        if (exactModuleName && workers[exactModuleName]) {
            feedback(`Rechargement du module ${exactModuleName}...`, source, channel);
            workers[exactModuleName].kill();
            delete workers[exactModuleName];
            startWorker(exactModuleName);
        } else {
            feedback(`Module ${moduleName} non trouvé ou non actif.`, source, channel);
        }
    }

    setTimeout(() => {
        manualReloading = false;
    }, 5000); // Réinitialiser après un délai pour éviter les redémarrages automatiques pendant le rechargement manuel
}



function refreshModules(source, channel = "") {
    initializeModulesDatabase().then(() => {
        feedback("Liste des modules rechargée.", source, channel);
        saveDatabase();
    }).catch(err => {
        feedback(`Erreur lors du rechargement des modules : ${err.message}`, source, channel);
    });
}


function showStatus(source, channel = "") {
    let statusMessage = "Statut des modules :\n";
    database.modules.forEach(module => {
        // Utilisez findModuleNameInsensitive pour correspondre à la casse insensible
        const exactModuleName = findModuleNameInsensitive(module.name);
        statusMessage += `${module.name}: ${(exactModuleName && workers[exactModuleName] && workers[exactModuleName].connected) ? 'Actif' : 'Inactif'}\n`;
    });
    feedback(statusMessage.trim(), source, channel);
}


function listModules(source, channel = "") {
    let modulesMessage = "Modules disponibles :\n";
    // Affichez simplement les noms des modules depuis database.modules
    const moduleNames = database.modules.map(module => module.name).join(', ');
    modulesMessage += moduleNames;
    feedback(modulesMessage, source, channel);
}

function manageSettings(source, channel, args) {
    if (args.length < 2) {
        // Liste tous les modules et leurs paramètres configurables
        let modulesList = "Usage: settings <moduleName> <settingKey> <settingValue>\nModules disponibles avec paramètres configurables: \n";
        database.modules.forEach(module => {
            const settingsList = Object.keys(module)
                .filter(key => allowedSettings.includes(key))
                .join(", ");
            modulesList += `${module.name}: ${settingsList || "Aucun paramètre configurable"}\n`;
        });
        feedback(modulesList, source, channel);
    } else if (args.length === 2) {
        // Affiche les paramètres disponibles et leurs valeurs pour le module spécifié
        const moduleName = findModuleNameInsensitive(args[1]);
        const module = database.modules.find(m => m.name.toLowerCase() === moduleName.toLowerCase());
        if (module) {
            let settingsList = `Paramètres pour ${moduleName}:\n`;
            Object.keys(module).forEach(key => {
                if (allowedSettings.includes(key)) {
                    settingsList += `  ${key}: ${module[key]}\n`;
                }
            });
            feedback(settingsList, source, channel);
        } else {
            feedback("Module non trouvé.", source, channel);
        }
    } else if (args.length > 2) {
        // Modifie le paramètre spécifié pour le module
        const moduleName = args[1];
        const settingKey = args[2];
        const settingValue = args[3];

        if (!allowedSettings.map(s => s.toLowerCase()).includes(settingKey.toLowerCase())) {
            feedback(`Le paramètre ${settingKey} n'est pas autorisé. Seuls les paramètres suivants sont autorisés: ${allowedSettings.join(", ")}.`, source, channel);
            return;
        }

        updateModuleSetting(moduleName, settingKey, settingValue, source, channel);
    }
}

function getLastModuleLogs(moduleName, source, channel = "") {
    const exactModuleName = findModuleNameInsensitive(moduleName);
    if (!exactModuleName) {
        feedback(`Module ${moduleName} non trouvé.`, source, channel);
        return;
    }

    const logs = workerLogs[exactModuleName] || [];
    const last15Lines = logs.slice(-50); // Récupérer les 50 dernières lignes des logs

    feedback(`Dernières 50 lignes du module ${exactModuleName}:\n${last15Lines.join('\n')}`, source, channel);
}

function sendCommandToWorker(moduleName, command, source, channel = "") {
    const exactModuleName = findModuleNameInsensitive(moduleName);
    if (!exactModuleName) {
        feedback(`Module ${moduleName} non trouvé.`, source, channel);
        return;
    }

    if (!workers[exactModuleName]) {
        feedback(`Worker pour le module ${exactModuleName} non trouvé.`, source, channel);
        return;
    }

    if (!workers[exactModuleName].stdin) {
        feedback(`Le worker pour le module ${exactModuleName} ne supporte pas l'entrée de commandes via stdin.`, source, channel);
        return;
    }

    try {
        workers[exactModuleName].stdin.write(`${command}\n`);
        feedback(`Commande '${command}' envoyée au module ${exactModuleName}.`, source, channel);
    } catch (error) {
        console.error(`Erreur lors de l'envoi de la commande: ${error.message}`);
        feedback(`Erreur lors de l'envoi de la commande: ${error.message}`, source, channel);
    }
}

function handleRealTimeConsole(args, source, channel) {
    if (args.length < 2) {
        feedback('Usage: realtime_console [stop, all, (module)]', source, channel);
        return;
    }

    const command = args[1].toLowerCase();

    switch (command) {
        case 'stop':
            stopRealTimeConsole(source, channel);
            break;
        case 'all':
            startRealTimeConsoleForAll(source, channel);
            break;
        default:
            startRealTimeConsoleForModule(command, source, channel);
            break;
    }
}

function startRealTimeConsoleForModule(moduleName, source, channel) {
    const exactModuleName = findModuleNameInsensitive(moduleName);
    if (!exactModuleName || !workers[exactModuleName]) {
        feedback(`Module ${moduleName} non trouvé ou non actif.`, source, channel);
        return;
    }

    const worker = workers[exactModuleName];
    if (realTimeListeners[exactModuleName]) {
        feedback(`Écoute en temps réel déjà active pour le module ${exactModuleName}.`, source, channel);
        return;
    }

    realTimeListeners[exactModuleName] = true;

    worker.stdout.on('data', (data) => {
        console.log(`[${exactModuleName}] : ${data.toString()}`);
    });

    worker.stderr.on('data', (data) => {
        console.error(`[${exactModuleName}] : ${data.toString()}`);
    });

    feedback(`Écoute en temps réel activée pour le module ${exactModuleName}.`, source, channel);
}

function startRealTimeConsoleForAll(source, channel) {
    Object.keys(workers).forEach((moduleName) => {
        startRealTimeConsoleForModule(moduleName, source, channel);
    });
    feedback(`Écoute en temps réel activée pour tous les modules.`, source, channel);
}

function stopRealTimeConsole(source, channel) {
    Object.keys(realTimeListeners).forEach((moduleName) => {
        const worker = workers[moduleName];
        if (worker) {
            worker.stdout.removeAllListeners('data');
            worker.stderr.removeAllListeners('data');
        }
    });

    realTimeListeners = {};
    feedback(`Écoute en temps réel désactivée pour tous les modules.`, source, channel);
}




























process.stdin.on('data', (data) => {
    const input = data.toString().trim();
    let consoleString = " via la console"

    if (input === 'help') {
        log(`
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
    `)
    } else {
        const args = input.split(' ');
        const action = args[0].toLowerCase();
        const moduleName = args[1] || 'all'; // Utilise 'all' par défaut si aucun module n'est spécifié
        const exactModuleName = findModuleNameInsensitive(moduleName);

        handleCommand(action, exactModuleName || moduleName, 'console', null, args);
    }
    // else if (input === 'modules') {
    //     log(Object.keys(modules))
    //     log(`Les modules trouvés sont : ${module}`);
    //     // } else if (input === 'set_variable') {
    //     //     // demander à l'utilisateur de saisir le nom de la variable et sa valeur
    //     //     process.stdout.write("Entrez le nom de la variable : ");
    //     //     process.stdin.on('data', (varName) => {
    //     //         process.stdout.write("Entrez la valeur de la variable : ");
    //     //         process.stdin.on('data', (varValue) => {
    //     //             // définir la variable avec la valeur saisie
    //     //             let variable = {
    //     //                 [varName.toString().trim()]: varValue.toString().trim()
    //     //             };
    //     //             process.stdout.write(`La variable ${varName.toString().trim()} a été définie avec la valeur ${varValue.toString().trim()}\n`);
    //     //         });
    //     //     });
    // } 
});



















/*################                              ################
################    CONNEXION DISCORD           ################
################                                ################*/
if (discord_enabled) {
    Discord_worker.on('ready', () => {
        log(`Processus principal lancé`);
        Discord_worker.channels.cache.get(channel_main).send('Bot du processus principal lancé');
        //startWorker();
        load_modules();
    });


    Discord_worker.on('messageCreate', async message => {
        if (message.author.bot || message.channel.id !== channel_main) return;
        log("Message détecté dans le salon principal")
        if (message.content.toLowerCase() === 'help') {
            feedback(messages.help_console, "discord", message.channel.id);
        } else {
            const args = message.content.split(' ');
            const action = args[0].toLowerCase();
            const moduleName = args[1] || 'all'; // Utilise 'all' par défaut si aucun module n'est spécifié
            const exactModuleName = findModuleNameInsensitive(moduleName);

            handleCommand(action, exactModuleName || moduleName, 'discord', message.channel.id, args);
        }
        // else if (message.content.toLowerCase() === 'modules') {
        //     feedback(`Les modules trouvés sont : ${Object.keys(modules)}`, "discord", message.channel.id)
        // } 
    });
}















/*################                              ################
################             API WEB            ################
################                                ################*/
// API pour lister les modules avec détails et liens pour les actions
app.get('/api/modules/list', (req, res) => {
    const modulesList = database.modules.map(module => ({
        name: module.name,
        settings: Object.keys(module).reduce((settings, key) => {
            if (!excludedSettingsKeys.includes(key)) {
                settings[key] = module[key];
            }
            return settings;
        }, {}),
        state: workers[module.name] && workers[module.name].connected ? 'Actif' : 'Inactif',
        links: {
            start: `http://${req.headers.host}/api/module/${encodeURIComponent(module.name)}/start`,
            stop: `http://${req.headers.host}/api/module/${encodeURIComponent(module.name)}/stop`,
            restart: `http://${req.headers.host}/api/module/${encodeURIComponent(module.name)}/restart`,
            sendCommand: `http://${req.headers.host}/api/module/${encodeURIComponent(module.name)}/send-command`,
            logs: `http://${req.headers.host}/api/module/${encodeURIComponent(module.name)}/logs`
        }
    }));
    res.json({ success: true, modules: modulesList });
});

app.post('/api/module/:workerName/action', async (req, res) => {
    const { workerName } = req.params;
    const { action } = req.body;

    try {
        switch (action) {
            case 'start':
                if (workers[workerName]) {
                    return res.status(400).json({ error: "Le worker est déjà démarré." });
                }
                startWorker(workerName);
                break;
            case 'stop':
                if (!workers[workerName]) {
                    return res.status(404).json({ error: "Worker non trouvé." });
                }
                manualStops[workerName] = true; // Marquez le worker comme arrêté manuellement
                workers[workerName].kill();
                delete workers[workerName]; // Supprimez le worker de la liste des workers actifs
                break;
            case 'restart':
                if (!workers[workerName]) {
                    return res.status(404).json({ error: "Worker non trouvé." });
                }
                workers[workerName].kill();
                delete workers[workerName]; // Préparez pour un redémarrage
                setTimeout(() => startWorker(workerName), 1000); // Donnez du temps pour que le processus s'arrête proprement
                break;
            default:
                return res.status(400).json({ error: "Action non valide." });
        }
        res.json({ success: true, message: `Action '${action}' effectuée sur ${workerName}.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Une erreur est survenue lors de l'exécution de l'action." });
    }
});


app.post('/api/module/:workerName/send-command', (req, res) => {
    const workerName = req.params.workerName;
    const { command } = req.body;

    if (!workers[workerName]) {
        return res.status(404).json({ error: "Worker non trouvé" });
    }

    try {
        workers[workerName].send({ command }); // Envoyez la commande au worker
        res.json({ success: true, message: `Commande '${command}' envoyée à ${workerName}.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Une erreur est survenue lors de l'envoi de la commande." });
    }
});


// API pour obtenir les logs d'un worker spécifique
app.get('/api/module/:workerName/logs', (req, res) => {
    const workerName = req.params.workerName;
    const logs = workerLogs[workerName] || ["Aucun log disponible pour ce worker."];
    res.json({ success: true, logs });
});

app.use(express.static('public'));



















/*################                          ################
################    PREVENTION PLANTAGES    ################
################                            ################*/
function checkMainProcessCrashCount() {
    const now = Date.now();
    mainProcessCrashCount += 1;

    if (mainProcessCrashCount > MAX_CRASHES && (now - firstMainCrashTime) <= CRASH_WINDOW_MS) {
        log('Trop d\'erreurs non gérées, arrêt du processus principal.');
        // Envoyer une notification à l'administrateur ici
        process.exit(1); // Arrête le processus principal
    }

    if ((now - firstMainCrashTime) > CRASH_WINDOW_MS) {
        // Réinitialiser le compteur de crashs si la fenêtre de temps est dépassée
        mainProcessCrashCount = 1;
        firstMainCrashTime = now;
    }
}

process.on('uncaughtException', (err) => {
    log(`Erreur non gérée: ${err.stack || err}`);
    checkMainProcessCrashCount();
});

process.on('unhandledRejection', (reason, promise) => {
    log(`Rejet de promesse non géré: ${reason.stack || reason}`);
    checkMainProcessCrashCount();
});


process.on('SIGINT', () => {
    console.log('Fermeture du script...');
    process.exit(0); // Sortie normale
});

if(discord_enabled){
    Discord_worker.on('error', (err) => {
        log(err);
        // Discord_worker.channels.cache.get(channel_main).send(err);
    });

    Discord_worker.on('disconnect', () => {
        log(messages.disconnected);
        worker.kill();
    });

    Discord_worker.on('reconnecting', () => {
        log(messages.reconnect);
    });
}

const requiredEnvVars = ['API_PORT', 'KEY_DISCORD', 'CHANNEL_MAIN', 'DISCORD_ACTIVATED', 'CHANNEL_DEV'];
requiredEnvVars.forEach((envVar) => {
    if (!process.env[envVar]) {
        console.error(`La variable d'environnement ${envVar} est manquante. Vérifiez que le fichier .env est correct.`);
        process.exit(1);
    }
});