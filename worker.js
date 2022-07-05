//Master (balancer) and Worker (sites)
const { fork } = require('child_process');
const log4js = require('log4js');
const fs = require('fs-extra');
const randomUUID = require('uuid').v4;
const exec = require('child_process').exec;
const config = require('./config').config;

const APP_NAME = "jgantts-website-publisher";
const WEBSITE_NAME = 'jgantts.com';
const WORKER_TOTAL = 4;;

process.env.NODE_SITE_PUB_ENV = 'dev';

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
            type: "file", filename: `${config.security.logPath}/${APP_NAME}-worker.log`,
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
    siteDir = `${config.security.websitesDir}/${WEBSITE_NAME}-${uuid}/`;
    logger.debug(`Node Site #${process.pid} starting.`);
    try {
        await fs.copy(`node_modules/${WEBSITE_NAME}/`, siteDir);

        await install(siteDir);

        site = require(siteDir);
        process.on('message', receivedMessage);
        site.start();
        logger.debug('launched');
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
        exec(`cd ${siteDir} && npm install`, async function(error, stdout, stderr){
            logger.debug(`${stdout}`);
            logger.debug(`${stderr}`);
            if (error) {
                reject();
            } else {
                resolve();
            }
        });
    });
}



initSite();
