# jgantts-website-publisher
 
## Purpose
 
This is my nodejs website publisher.
I made it for myself; but I like writing flexible code so it should be useful for others with minimal modifications.

LICENSE for both this publisher and the target website is GNU GPL v3.0;
means do what you want excepting that, don't be a dolt, don't try to claim patents, and if you share it include your source and the diff and share under the same GNU GPL v3.0 license.

The main intent is to publish a website.
However I wanted smooth rollovers when publishing updates, so it launches a main process and four worker processes.
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
 - The server launcher does reduce privileges to a non-root user account before launching any application servers

### Future Security Plans

 - Stop using root and make another user account to run the SSL server under

## Other Considerations

Currently the load balancer has no type of cookies or user identifier.
This means that the balancer has no way to route requests from the same user to the same worker/application server.

## Method, Terminology

### Method

### Terminology

#### Specific
 - **JGantts** - Jacob Gantt, the person
 - **jgantts-website-publisher** - this repo; the software in this repo; the npm-based website installer, updater, launcher, SSL handler, HTTPS redirect, load balancer, and a bit of a scant framework
 - **target (site)** - the singular website published and run by this jgantts-website-publisher software, currently only JGantts.com
 - **Next** - Lorum ipsum

#### General
 - **heartbeat** - Very simple transaction between two applications, ensuring each of the other's 'has not crashed' status
 - **CentOS** - linux flavor
 - 



## Publisher-TargetWebsite API

The target website exposes itself as a nodejs module with these exported functions:

- **start(): boolean** => launches website application server and returns success value
    
- **port(): number** => returns application server's port
    
- **heartbeat(): boolean** => returns true in under 100 miliseconds. Any other response, or lack of timely response, is considered a failed heartbeat
    
- **shutdown(): boolean** => closes website application server and returns success value

## Environment

This software was tested using a "blank" CentOS 7 64-bit image from namecheap's VPS package

The install script uses Shell and assumes CentOS 7

The publisher application is written in JavaScript and uses the NodeJS runtime

The target website is envisioned to
 - be a NodeJS app
 - require a build process (TypeScript, React, what have you) and
 - be published on npm as a module

(Technically the only requirement of the target is that you can `npm install` it and that it implements the above API. But without a build process, this entire repo is overkill.)
