# jgantts-website-publisher
 
## Purpose
 
This is my nodejs website publisher.
I made it for myself; but I like writting flexible code so it should be useful for others with minimal modifications.

The main intent is to publish a website.
However I wanted smooth rollovers when publishig updates, so it launches a main process and four worker processes.
The main process receives all incoming requests and forwards them to a random worker process;
in effect, making this is a simple load balancer.

## Target Site

This software currently targets the JGantts.com website.
Source hosted at https://github.com/JGantts/jgantts.com/
Build hosted at https://www.npmjs.com/package/jgantts.com
Result hosted at https://jgantts.com/

## Security Considerations

The setup script currently places the target website

## Method

## API
(between this publisher and the published website)

The API is as follows

## Environment

This software was tested using a "blank" CentOS 7 64-bit image from namecheap's VPS package.




