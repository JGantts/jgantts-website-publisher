const { fork } = require('child_process');
const log4js = require('log4js');
const fs = require('fs-extra');
const randomUUID = require('uuid').v4;
const exec = require('child_process').exec;
const config = require('./config').config;
const path = require('path');

const APP_NAME = "jgantts-website-publisher";
const WEBSITE_NAME = 'jgantts.com';
const WORKER_TOTAL = 4;

process.env.NODE_SITE_PUB_ENV = 'dev';

log4js.configure({
    appenders: {
        out: {
            type: "stdout",
            layout: {
                type: "pattern",
                pattern: "%d{hh.mm.ss} [work] %p %c %m"
            }
        },
        publish: {
            type: "file", filename: `${APP_NAME}-worker.log`,
            layout: {
                type: "pattern",
                pattern: "%d{yyyy/MM/dd-hh.mm.ss} [work] %p %c %m",
            }
        }
    },
    categories: { default: { appenders: ["out"], level: "debug" } }
});
const logger = log4js.getLogger();
logger.level = "debug";
logger.debug(`Begin Log ${APP_NAME} ${process.pid}`);

let site;
let siteDir;

let receivedMessage = async (msg) => {
    logger.debug(`Received ${msg.type}`);
    switch (msg.type){
        case 'heartbeat':
        let heartbeat = await site.heartbeat();
        process.send({
            type: 'heartbeat',
            content: { heartbeat: heartbeat }
        });
        break;

        case 'shutdown':
        await site.shutdown();
        await fs.remove(siteDir);
        process.send({
            type: 'shutdown',
            content: { success: true }
        });
        break;

        case 'port':
        let port = await site.port();
        process.send({
            type: 'port',
            content: {
                success: true,
                port: port
             }
        });
        break;
    }
}

let initSite = async () => {
    let uuid = randomUUID();
    siteDir = `websites/${WEBSITE_NAME}-${uuid}/`;
    logDir = `website-logs/${WEBSITE_NAME}-${uuid}/`;
    await fs.ensureDir(siteDir);
    await fs.ensureDir(logDir);
    logger.debug(`Node Site #${process.pid} initializing.`);
    try {
        await fs.copy(path.join(path.dirname(await fs.realpath(__filename)), `node_modules/${WEBSITE_NAME}/`), siteDir);

        logger.debug(`cwd: ${process.cwd()}`);
        await install(siteDir);

        logger.debug(fs.existsSync(siteDir));
        logger.debug(`Node Site #${process.pid} loading.`);
        site = require(await fs.realpath(siteDir));
        process.on('message', receivedMessage);
        let tempWorkindDir = process.cwd();
        logger.debug(`tempWorkindDir: ${tempWorkindDir}`);
        process.chdir(logDir);
        logger.debug(site);
        logger.debug(site.start);
        logger.debug(`Node Site #${process.pid} starting.`);
        site.start();
        process.chdir(tempWorkindDir);
        logger.debug(`Node Site #${process.pid} started.`);
    } catch (err) {
        logger.debug(`Node Site #${process.pid} failed.`);
        logger.debug(`${err.message}`);
    }
    let heartbeat = await site.heartbeat();
    if (!heartbeat) {
        logger.debug(`Heart failed to start.`);
        throw new Error();
    }
    process.send({
        type: 'start',
        content: { success: true }
    });
};

let install = (siteDir) => {
    return new Promise(async (resolve, reject) => {
        logger.debug(`npm install ${siteDir}`);
        exec(`cd ${siteDir} && npm install && cd ../`, async function(error, stdout, stderr){
            logger.debug(`stdout: ${stdout}`);
            logger.debug(`stderr: ${stderr}`);
            if (error) {
                reject();
            } else {
                resolve();
            }
        });
    });
}



initSite();
