# Contributing

Hey, you're cool. *hugs*

Anyway, here's the developer setup

Follow all the steps in the README like normal except:

* Add `http://localhost:4433/api/oauth` to your FitBit application (space delimited I'm like 99% sure)
* Clone down this repository to your computer
* `npm install`
* Download the Vercel CLI `npm install -g vercel-cli`
* `vercel dev --listen 4433` locally

You can now locally mess with the code and data from FitBit, everything is served off of `http://localhost:4433`