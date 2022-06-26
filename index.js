const cron = require('node-cron');
const fs = require('fs/promises');
const fsSync = require('fs');
const https = require('https');
const { exec } = require("child_process");
const compareVersions = require('compare-versions');
const tar = require('tar');

const tempPath = `temp/`;
const tempFile = `temp.tgz`

async function updateWebsite() {
    const packageRegistry = `https://registry.npmjs.org/${'jgantts.com'}`;
    const outDir = `../${'jgantts.com'}`;

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
                if (compareVersions(highestVersion, version) < 0) {
                    highestVersion = version;
                }
            }
        }
        let versionMetadata = packageMatadata.versions[highestVersion];
        console.log(versionMetadata.dist.tarball);
        let tarUrl = versionMetadata.dist.tarball;

        await fs.rm(outDir, { recursive: true });
        await fs.mkdir(outDir);

        if (fsSync.existsSync(tempPath)) {
            await fs.rm(tempPath, { recursive: true });
        }
        await fs.mkdir(tempPath);

        downloadFileFromUri(tarUrl, tempPath + tempFile, async () => {
            tar.x(  // or tar.extract(
                {
                    file: tempPath + tempFile,
                    cwd: tempPath
                }
            ).then(_=> {
                console.log("done.");
                //.. tarball has been dumped in cwd ..
            })
        });
    });
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
            console.error(err);
            console.error(err.message);
            // Consume response data to free up memory
            res.resume();
            then({
                error: true,
                continue: false,
                message: `${err.message}`,
            });
            return;
        }

        console.log(uri)
        console.log(path)

        const filePath = fsSync.createWriteStream(path);
        res.pipe(filePath);
        filePath.on('finish',() => {
            filePath.close();
            console.log('Download Completed');
            then({
                error: false,
                continue: true,
                message: ``,
            });
            return;
        })

        res.on('end', () => {
            try {
                console.log('connection closed');
                return;
            } catch (err) {
                console.error(err);
                console.error(err.message);
                then({
                    error: true,
                    continue: false,
                    message: `${err.message}`,
                });
                return;
            }
        });
    }).on('error', (err) => {
        console.error(err);
        console.error(`Got error: ${err.message}`);
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
            console.error(err);
            console.error(err.message);
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
                console.error(err);
                console.error(err.message);
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
        console.error(err);
        console.error(`Got error: ${err.message}`);
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
