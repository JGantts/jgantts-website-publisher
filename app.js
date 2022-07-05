const { fork } = require('child_process');
const log4js = require('log4js');
const randomUUID = require('uuid').v4;
const cron = require('node-cron');
const fsSync = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');
const httpProxy = require('http-proxy');
const fs = require('fs-extra');
const exec = require('child_process').exec;
const path = require('path');
const compareVersions = require('compare-versions');
const config = require('./config').config;

let workerBodies = new Object();

process.on('exit', async (code) => {
    Object.keys(workerBodies).forEach(async (workerKey) => {
        await killWorker(workerBodies[workerKey]);
    });
});

const APP_NAME = "jgantts-website-publisher"
const WEBSITE_NAME = 'jgantts.com'
const WORKER_TOTAL = 4;

log4js.configure({
    appenders: {
        out: {
            type: "stdout",
            layout: {
                type: "pattern",
                pattern: "%d{hh.mm.ss} [main] %p %c %m"
            }
        },
        publish: {
            type: "file", filename: `${APP_NAME}.log`,
            mode: "666",
            layout: {
                type: "pattern",
                pattern: "%d{yyyy/MM/dd-hh.mm.ss} [main] %p %c %m"
            }
        }
    },
    categories: { default: { appenders: ["publish", "out"], level: "debug" } }
});

const logger = log4js.getLogger();
logger.level = "debug";
logger.debug(`Begin Log ${APP_NAME} ${process.pid}`);

logger.debug(`Node Load Balancer is running. PID: ${process.pid}`);
logger.debug(`NodeJS ${process.versions.node}`);

let initilize = async () => {
    await fs.ensureDir(config.security.workingDir);
    process.chdir(config.security.workingDir);

    let loadBalancerPoxy = httpProxy.createProxyServer();

    let port = process.env.PORT | 8080;



    const app = express();
    const httpServer = http.createServer(app);
    const httpsServer = https.createServer(config.ssh, app);

    const HTTP_PORT = 80;
    const HTTPS_PORT = 443;

    let listeningPort;

    if (process.env.NODE_SITE_PUB_ENV === 'dev') {
        listeningPort = 8080;
    } else {
        listeningPort = HTTPS_PORT;
        var httpsRedirectServer = express();
        httpsRedirectServer.get('*', function(req, res) {
            if (!req.secure) {
                res.redirect('https://' + req.headers.host + req.url);
            }
        })
        httpsRedirectServer.listen(HTTP_PORT);
    }

    http.createServer(function (req, res) {
        if (!req.secure) {
            res.redirect('https://' + req.headers.host + req.url);
        }
        let keys = Object.keys(workerBodies);
        if (keys.length > 0) {
            let keyIndex = Math.floor(Math.random() * keys.length);
            let workerBody = workerBodies[keys[keyIndex]];
            let port = workerBody.port;
            let target = {host: '127.0.0.1', port: port};
            logger.debug(`port: ${port}`);
            loadBalancerPoxy.web(req, res, { target });
        } else {
            res.writeHead(503, {'Content-Type': 'text/html'});
            res.write("<p>503 Service Unavailable</p>");
            res.write("<p>It's not you it's us.</p>");
            res.write("<p>Server may be booting.<br />Please try again in a few minutes.</p>");
            res.end();
        }
    }).listen(listeningPort);

    logger.debug('Before privledge reduction.');

    process.setuid(config.security.leastprivilegeduser);
    if (process.getuid() === 0){
        logger.debug('failed to reduce privilege. Quitting');
        throw Error('failed to reduce privilege. Quitting');
    }

    logger.debug('After privledge reduction.');

    await startWorkers();

    checkStatusandVersion();

    cron.schedule('* * * * *', checkStatusandVersion);
};

let startWorkers = async () => {
    for (let i = 0; i < WORKER_TOTAL; i++) {
        await startWorker();
    }
}

let restartWorkers = async () => {
    logger.debug("restartWorkers")
    Object.keys(workerBodies).forEach(async (workerKey) => {
        await restartWorker(workerBodies[workerKey]);
    });
    logger.debug("done restartWorkers")
}

let restartWorker = (oldWorkerBody) => {
    return new Promise(async (resolve, reject) => {
        if (oldWorkerBody !== null) {
            await killWorker(oldWorkerBody);
        }
        await startWorker();
        resolve();
    });
}

let killWorker = (workerBody) => {
    return new Promise(async (resolve, reject) => {
        workerBody.active = false;
        workerBody.shutdownCallback = () => {
            delete workerBodies[workerBody.uuid];
            resolve();
        };
        workerBody.worker.send({type: 'shutdown'});
    });
}

let getPortPromise = (worker) => {
    return new Promise(async (resolve, reject) => {
        logger.debug('Getting port');
        worker.on('message', (msg) => {
            switch (msg.type){
                case "port":
                if (msg.content.success) {
                    logger.debug(`Listening on port ${msg.content.port}`);
                    resolve(msg.content.port);
                } else {
                    reject();
                }
                break;

                default:
                reject();
                break;
            }
        });
        worker.send({type: 'port'});
    });
}

let startWorker = async () => {
    let newWorker = await startWorkerPromise();
    logger.debug(`Worker ${newWorker.pid} fork.`);
    let port = await getPortPromise(newWorker);
    let workerBody = {
        uuid: randomUUID(),
        worker: newWorker,
        active: true,
        port: port,
        activeConnections: 0,
        heartbeat: false,
        shutdownCallback: () => {}
    };
    newWorker.on('message', async (msg) => {
        logger.debug(`${msg.type}`);
        switch (msg.type){
            case "heartbeat":
            logger.debug(`heartbeat = ${msg.content.heartbeat}`)
            workerBody.heartbeat = msg.content;
            break;

            case "shutdown":
            workerBody.worker.kill();
            workerBody.shutdownCallback();
            break;
        }
    });
    newWorker.on('Error', (err) => {
        logger.debug(err.message);
    });
    workerBodies[workerBody.uuid] = workerBody;
}

let startWorkerPromise = () => {
    return new Promise(async (resolve, reject) => {
        let newWorker = fork('./worker.js');
        newWorker.on('message', async (msg) => {
            logger.debug(`${msg.type}`);
            switch (msg.type){
                case "start":
                resolve(newWorker);
                break;

                default:
                reject();
                break;
            }
        });
    });
}

let checkStatusandVersion = async () => {
    logger.debug(`check version and status`);
    await checkVersion();
    await checkStatus();
}

let checkStatus = async () => {
    Object.keys(workerBodies).forEach(async (workerKey) => {
        let workerBody = workerBodies[workerKey]
        if (workerBody.worker.exitCode !== null) {
            await restartWorker(workerBody);
        } else {
            workerBody.heartbeat = false;
            workerBody.worker.send({type: "heartbeat"});
            await delay(1000);
            if (!workerBody.heartbeat) {
                await restartWorker(workerBody);
            }
        }
    });
}

let delay = async (ms) => {
    return new Promise((resolve, reject) => setTimeout(resolve, ms));
}

let checkVersion = async () => {

    const packageRegistry = `https://registry.npmjs.org/${WEBSITE_NAME}`;

    getJsonFromUri(packageRegistry, async (res) => {
        if (res.error) { console.error(res.message); return; }
        else if (!res.continue) { console.error(res.message); return; }

        const packageMatadata = res.data
        let versionsMetadata = packageMatadata.versions
        let highestVersion = null;
        for(var version in versionsMetadata) {
            if(highestVersion === null) {
                highestVersion = version;
            } else {
                if (compareVersions(highestVersion, version) <= 0) {
                    highestVersion = version;
                }
            }
        }

        let packageFile = `node_modules/${WEBSITE_NAME}/package.json`;

        if (fsSync.existsSync(packageFile)) {
            const packageFileSting = (await fs.readFile(packageFile)).toString();
            const packageFileJson = JSON.parse(packageFileSting);
            const installedVersion = packageFileJson.version;
            if (compareVersions(installedVersion, highestVersion) >= 0) {
                logger.debug(`${WEBSITE_NAME} is already up-to-date @${highestVersion}.`);
                return;
            }
        }

        logger.debug(`Updating ${WEBSITE_NAME} module`);
        exec(`npm install ${WEBSITE_NAME}@${highestVersion}`, async function(error, stdout, stderr){
            logger.debug(`Done updating ${WEBSITE_NAME} module`);
            logger.debug(stdout);
            logger.debug(stderr);
            restartWorkers();
        });
    });
}

let getJsonFromUri = async (uri, then) => {
    https.get(uri, (res) => {
        logger.debug("response");
        const { statusCode } = res;
        const contentType = res.headers['content-type'];

        let err;
        // Any 2xx status code signals a successful response but
        // here we're only checking for 200.
        if (statusCode !== 200) {
            err = new Error('Request Failed.\n' +
            `Status Code: ${statusCode}`);
        } else if (!/^application\/json/.test(contentType)) {
            error = new Error('Invalid content-type.\n' +
            `Expected application/json but received ${contentType}`);
        }
        if (err) {
            logger.debug(err);
            logger.debug(err.message);
            // Consume response data to free up memory
            res.resume();
            then({
                error: true,
                continue: false,
                message: `${err.message}`,
                data: null
            });
            return;
        }

        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
            try {
                const parsedData = JSON.parse(rawData);
                then({
                    error: false,
                    continue: true,
                    message: ``,
                    data: parsedData
                });
                return;
            } catch (err) {
                logger.debug(err);
                logger.debug(err.message);
                then({
                    error: true,
                    continue: false,
                    message: `${err.message}`,
                    data: null
                });
                return;
            }
        });
    }).on('error', (err) => {
        logger.debug(err);
        logger.debug(`Got error: ${err.message}`);
        then({
            error: true,
            continue: false,
            message: `${err.message}`,
            data: null
        });
        return;
    });
}

initilize();
