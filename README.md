# jgantts-website-publisher
 
## Purpose
 
This is my nodejs website publisher.
I made it for myself; but I like writting flexible code so it should be useful for others with minimal modifications.

LICENSE for both this publisher and the target website is GNU GPL v3.0;
means do what you want excepting that, don't be a dolt, don't try to claim patents, and if you share it include your source and the diff and share under the same GNU GPL v3.0 license.

The main intent is to publish a website.
However I wanted smooth rollovers when publishig updates, so it launches a main process and four worker processes.
The main process receives all incoming requests and forwards them to a random worker process;
in effect, making this a simple load balancer with four application servers.
In addition, because HTTPS is desirable, the load balancer redirects all HTTP requests to HTTPS and also handles the SSL certs (see 'Security Considerations').

## Target Site

This software currently targets the JGantts.com website.

Source hosted at [github.com/JGantts/jgantts.com/](https://github.com/JGantts/jgantts.com/)

Build Github Actions at [github.com/JGantts/jgantts.com/actions/workflows/node.js.yml](https://github.com/JGantts/jgantts.com/actions/workflows/node.js.yml)

Build hosted at [www.npmjs.com/package/jgantts.com](https://www.npmjs.com/package/jgantts.com)

Result published at [JGantts.com](https://jgantts.com/)

(Currently awaiting DNS propagation. IP is [199.192.16.176](http://199.192.16.176/))

## Security Considerations

 - Currently the setup script for the CentOS VM places the target website's publish package files under /root/
 - Currently the server launcher must be launched as root
 - The server laucher does reduce privileges to a non-root user account before launching any application servers

### Future Security Plans

 - Stop using root and make another user account to run the SSL server under

## Method

## Publisher-TargetWebsite API

The target website exposes itself as a nodejs module with these exported functions:

- start(): boolean
- port(): number
- heartbeat(): boolean
- shutdown(): boolean


## Environment

This software was tested using a "blank" CentOS 7 64-bit image from namecheap's VPS package

The install script uses Shell and assumes CentOS 7

The publisher application is written in JavaScript using the NodeJS runtime

The target website is envisioned to
 - be a NodeJS app
 - require a build process (TypeScript, React, what have you) and
 - be published on npm as a module

(Technically the only requirement of the target is that you can `npm install` it and that it implements the above API. But without a build process, this entire repo is overkill.)
