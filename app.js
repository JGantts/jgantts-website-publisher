//Master (balancer) and Worker (sites)
const cluster = require('cluster');
const log4js = require('log4js');

const APP_NAME = "jgantts-website-publisher"
const WEBSITE_NAME = 'jgantts.com'
const WORKER_TOTAL = 4;

process.env.NODE_SITE_PUB_ENV = 'prod';


log4js.configure({
    appenders: {
        out: {
            type: "stdout",
            layout: {
                type: "pattern",
                pattern: "%d{hh.mm.ss} %p %c %m"
            }
        },
        publish: {
             type: "file", filename: `${APP_NAME}.log`,
             layout: {
                 type: "pattern",
                 pattern: "%d{yyyy/MM/dd-hh.mm.ss} %p %c %m"
             }
         }
     },
    categories: { default: { appenders: ["publish", "out"], level: "debug" } }
});
const logger = log4js.getLogger();
logger.level = "debug";
logger.debug(`Begin Log ${APP_NAME} ${process.pid}${cluster.isMaster ? ": Master" : ""}`);


//Worker (site)
if (!cluster.isMaster) {
    let site;
    logger.debug(`Node Site #${process.pid} starting.`);
    try {
        site = require('jgantts.com')
        site.start();
        logger.debug(`Node Site #${process.pid} started.`);
    } catch (err) {
        logger.debug(`Node Site #${process.pid} failed.`);
        logger.debug(`${err.message}`);
    }

    process.on('message', async function(msg) {
        let heartbeat = await site.isAlive();
        switch (msg.type){
            case 'heartbeat':
            process.send({
                type: 'heartbeat',
                content: heartbeat
            });
            break;
        }
    });

//Master (balancer)
} else {
    const cron = require('node-cron');
    const fsSync = require('fs');
    const https = require('https');
    const fs = fsSync.promises;
    const exec = require('child_process').exec;
    const path = require('path');
    const compareVersions = require('compare-versions');

    logger.debug(`Node Load Balancer is running. PID: ${process.pid}`);
    logger.debug(`NodeJS ${process.versions.node}`);

    let workerBodies = new Object();



    let onFork = (worker, code, sig) => {
        logger.debug(`Worker ${worker.process.pid} fork.`);
        let workerBody = {worker: worker, heartbeat: false};
        workerBodies[worker.id] = workerBody;
        worker.on('message', async (msg) => {
            switch (msg.type){
                case "heartbeat":
                logger.debug(`heartbeat = ${msg.content}`)
                workerBody.heartbeat = msg.content;
                break;
            }
        });
    };
    let onDisconnect = (worker, code, sig) => {logger.debug(`Worker ${worker.process.pid} disconnect.`);};
    let onExit = (worker, code, sig) => {logger.debug(`Worker ${worker.process.pid} exit.`);};

    cluster.on('fork', onFork);
    cluster.on('disconnect', onDisconnect);
    cluster.on('exit', (worker, code, signal) => onExit);

    for (let i = 0; i < WORKER_TOTAL; i++) {
        cluster.fork();
    }



    async function restartWorkers() {
        logger.debug("restartWorkers")
        Object.keys(workerBodies).forEach(async (workerKey) => {
            await restartWorker(workerBodies[workerKey]);
        });
        logger.debug("done restartWorkers")
    }

    async function restartWorker(oldWorkerBody) {
        return new Promise(function(resolve, reject) {
            onFork = (newWorker, code, signal) => {
                onExit = (discWorker, code, signal) => {
                    logger.debug(`Worker ${discWorker.process.pid} exit.`);
                    delete workerBodies[discWorker.id]
                    workerBodies[newWorker.id] = newWorker;
                    resolve();
                }
                oldWorkerBody.worker.disconnect();
           };
        });
    }

    async function checkStatusandVersion() {
        logger.debug(`check version and status`);
        await checkVersion();
        await checkStatus();
    }

    async function checkStatus() {
        Object.keys(workerBodies).forEach(async (workerKey) => {
            let workerBody = workerBodies[workerKey]
            if (workerBody.worker.isDead()) {
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

    function delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function checkVersion() {

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

            exec(`npm install ${WEBSITE_NAME}`, async function(error, stdout, stderr){
                logger.debug("here");
                logger.debug(stdout);
                logger.debug(stderr);
                restartWorkers();
             });
        });
    }

    function getJsonFromUri(uri, then) {
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

    cron.schedule('* * * * *', checkStatusandVersion);
    checkStatusandVersion();
}
