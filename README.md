# jgantts-website-publisher
 
## Purpose
 
This is my nodejs website publisher.
I made it for myself; but I like writting flexible code so it should be useful for others with minimal modifications.

The main intent is to publish a website.
However I wanted smooth rollovers when publishig updates, so it launches a main process and four worker processes.
The main process receives all incoming requests and forwards them to a random worker process;
in effect, making this a simple load balancer.
In addition, because HTTPS is desirable, the load balancer redirects all HTTP requests to HTTPS and also handles the SSL certs (see 'Security Considerations').

## Target Site

This software currently targets the JGantts.com website.

Source hosted at [github.com/JGantts/jgantts.com/](https://github.com/JGantts/jgantts.com/)

Build Github Actions at [github.com/JGantts/jgantts.com/actions/workflows/node.js.yml](https://github.com/JGantts/jgantts.com/actions/workflows/node.js.yml)

Build hosted at [www.npmjs.com/package/jgantts.com](https://www.npmjs.com/package/jgantts.com)

Result published at [JGantts.com](https://jgantts.com/)

(Currently awaiting DNS propagation. IP is [199.192.16.176](http://199.192.16.176/))

## Security Considerations

The setup script currently places the target website

## Method

## API
(between this publisher and the published website)

The API is as follows

## Environment

This software was tested using a "blank" CentOS 7 64-bit image from namecheap's VPS package.




