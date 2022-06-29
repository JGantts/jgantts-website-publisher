//Master (balancer) and Worker (sites)
const cluster = require('cluster');
const log4js = require('log4js');

const APP_NAME = "jgantts-website-publisher"
const websiteName = 'jgantts.com'

log4js.configure({
    appenders: { publish: { type: "file", filename: `${APP_NAME}.log` } },
    categories: { default: { appenders: ["publish"], level: "error" } }
});
const logger = log4js.getLogger();
logger.level = "debug";
logger.debug(`Begin Log ${APP_NAME} ${process.pid}${cluster.isMaster ? ": Master" : ""}`);

//Worker  (site)
if (!cluster.isMaster) {
    logger.debug(`Node Site #${process.pid} starting.`);
    try {
        require('jgantts.com').start();
        logger.debug(`Node Site #${process.pid} started.`);
    } catch (err) {
        logger.debug(`Node Site #${process.pid} failed.`);
        logger.debug(`z`);
    }

//Master (balancer)
} else {
    logger.debug(`Node Load Balancer is running. PID: ${process.pid}`);
    logger.debug(`NodeJS ${process.versions.node}`);

    let currentSite = cluster.fork();

    cluster.on('fork', (worker, code, signal) => {
        logger.debug(`Worker ${worker.process.pid} forked`);
    });

    cluster.on('exit', (worker, code, signal) => {
        logger.debug(`Worker ${worker.process.pid} died.`);
        logger.debug(`Restarting server...`);
        currentSite = cluster.fork();
    });

    const cron = require('node-cron');
    const fsSync = require('fs');
    const https = require('https');
    const fs = fsSync.promises;
    const exec = require('child_process').exec;
    const path = require('path');
    const compareVersions = require('compare-versions');
    const tar = require('tar');
    const randomUUID = require('crypto').randomUUID;
    const express = require('express');

    const APP_NAME = "jgantts-website-publisher";

    cron.schedule('* * * * *', checkStatusandVersion);

    async function checkStatusandVersion() {
        logger.debug(`check version and status`);
        await checkVersion();
        await checkStatus();
    }

    async function checkStatus() {
        if (currentSite.isDead()) {
            currentSite = cluster.fork();
        }
        if (!currentSite.isAlive()) {
            let newSite = cluster.fork();
            await currentSite.kill();
            currentSite = newSite;
        }
    }

    async function checkVersion() {

        const packageRegistry = `https://registry.npmjs.org/${websiteName}`;

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

            let packageFile = `node_modules/${websiteName}/package.json`;

            if (fsSync.existsSync(packageFile)) {
                const packageFileSting = (await fs.readFile(packageFile)).toString();
                const packageFileJson = JSON.parse(packageFileSting);
                const installedVersion = packageFileJson.version;
                if (compareVersions(installedVersion, highestVersion) >= 0) {
                    logger.debug(`${websiteName} is already up-to-date @${highestVersion}.`);
                    return;
                }
            }

            exec(`npm install ${websiteName}`, async function(error, stdout, stderr){
                console.log("here");
                console.log(stdout);
                console.log(stderr);
                let newSite = cluster.fork();
                await currentSite.kill();
                currentSite = newSite;
             });
        });
    }

    function getJsonFromUri(uri, then) {
        console.log("getJsonFromUri");
        https.get(uri, (res) => {
            console.log("response");
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
            logger.debu(err);
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
}
