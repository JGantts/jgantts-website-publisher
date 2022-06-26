const cron = require('node-cron');
const fsSync = require('fs');
const fs = fsSync.promises;
const https = require('https');
const exec = require('child_process').exec;
const path = require('path');
const compareVersions = require('compare-versions');
const tar = require('tar');
const randomUUID = require('crypto').randomUUID;

const APP_NAME = "jgantts-website-publisher"

const log4js = require("log4js");
log4js.configure({
  appenders: { publish: { type: "file", filename: `${APP_NAME}.log` } },
  categories: { default: { appenders: ["publish"], level: "error" } }
});
const logger = log4js.getLogger();
logger.level = "debug";

logger.debug("Begin Log");

async function updateWebsite() {
    const websitesDir = path.resolve(`../../websites`);

    const tempPath = `${websitesDir}/temp-${randomUUID()}`;
    const tempFile = `temp.tgz`

    const websiteName = 'jgantts.com'
    const packageRegistry = `https://registry.npmjs.org/${websiteName}`;
    const outDir = `${websitesDir}/${websiteName}`;
    const versionFile = `${websitesDir}/${websiteName}.version`

    makeDir(websitesDir)

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

        if (!fsSync.existsSync(versionFile)) {
            await fs.writeFile(versionFile, highestVersion);
        } else {
            const installedVersion = (await fs.readFile(versionFile)).toString();
            if (compareVersions(installedVersion, highestVersion) >= 0) {
                logger.debug(`${websiteName} is already up-to-date.`);
                return;
            }
        }

        let versionMetadata = packageMatadata.versions[highestVersion];
        logger.debug(versionMetadata.dist.tarball);
        let tarUrl = versionMetadata.dist.tarball;

        await cleanDir(outDir)
        await cleanDir(tempPath)

        downloadFileFromUri(tarUrl, `${tempPath}/${tempFile}`, async () => {
            tar.x(  // or tar.extract(
                {
                    file: `${tempPath}/${tempFile}`,
                    cwd: tempPath
                }
            ).then(async _ => {
                logger.debug("moving files.");
                await fs.rename(`${tempPath}/package/`, outDir);
                logger.debug("done.");
                if (fsSync.existsSync(tempPath)) {
                    await fs.rm(tempPath, { recursive: true });
                }
                await fs.writeFile(versionFile, highestVersion);
            });
        });
    });
}

async function makeDir(dir) {
    if (!fsSync.existsSync(dir)) {
        await fs.mkdir(dir);
    }
}

async function cleanDir(dir) {
    if (fsSync.existsSync(dir)) {
        await fs.rm(dir, { recursive: true });
    }
    await fs.mkdir(dir);
}

function downloadFileFromUri(uri, path, then) {
    https.get(uri, (res) => {
        const { statusCode } = res;
        const contentType = res.headers['content-type'];

        let err;
        // Any 2xx status code signals a successful response but
        // here we're only checking for 200.
        if (statusCode !== 200) {
            err = new Error('Request Failed.\n' +
            `Status Code: ${statusCode}`);
        } else if (!/^application\/octet-stream/.test(contentType)) {
            err = new Error('Invalid content-type.\n' +
            `Expected application/octet-stream but received ${contentType}`);
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
            });
            return;
        }

        logger.debug(uri)
        logger.debug(path)

        const filePath = fsSync.createWriteStream(path);
        res.pipe(filePath);
        filePath.on('finish',() => {
            filePath.close();
            logger.debug('Download Completed');
            then({
                error: false,
                continue: true,
                message: ``,
            });
            return;
        })

        res.on('end', () => {
            try {
                logger.debug('connection closed');
                return;
            } catch (err) {
                logger.debug(err);
                logger.debug(err.message);
                then({
                    error: true,
                    continue: false,
                    message: `${err.message}`,
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
        });
        return;
    });
}

function getJsonFromUri(uri, then) {
    https.get(uri, (res) => {
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

cron.schedule('*/5 * * * *', updateWebsite);

updateWebsite();
