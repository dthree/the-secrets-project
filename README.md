# The Secrets Project

This is a code mirror for [The Secrets Project](https://thesecretsproject.com). If you came looking for the answers, nice try—the secrets have been redacted.

## Engine overview

Each secret lives in its own module, carrying its detection rules and the pieces it contributes to the page. The engine finds these modules at startup and assembles their contributions into named slots. A secret can create new slots for other secrets to occupy, or transform how existing contributions fit together. That lets separately written discoveries nest, combine and rearrange the interface without every secret needing to know how every other secret works. Even the places where things appear can be things you have to discover.

Your browser sends small batches of interactions to the server, where the engine routes them to the relevant detectors and checks their prerequisites. When something unlocks, the server composes the newly available pieces into your page. Interactive code is built into separate, self-contained bundles called *islands*, which are delivered when you have access to them. The same system ties together recognizing an action, remembering a discovery, changing the interface and admitting the next piece of code—all while keeping the rules for undiscovered secrets on the server, where Inspect Element can express its disappointment.

Even with the secrets redacted, would you believe this thing still runs? There’s a small working demo tucked inside, with two connected, made-up secrets that let you watch the machinery work without spoiling the real ones.

## Run the example

With Node.js 22 or newer installed, run:

```sh
npm ci
npm run build
npm test
npm start
```

Open [the local demo](http://127.0.0.1:5178), type `example`, and submit it. The server reveals the contribution, its stylesheet and its island for your session. Turn the machine’s handle to discover what it makes. The server remembers your turns, checks the second discovery’s prerequisite and grants its demo tokens once. Refresh to keep your progress, or choose **Start over** to clear both discoveries, the counter and the reward. Restarting the server clears every demo session.

The [example secret guide](src/secrets/999999-example/README.md) explains the current file layout, required fields, optional configuration and storage boundaries. The exported [TypeScript types](src/shared/secret.ts) are the schema reference; this demo uses the same registry, evaluator and composer as the site, with a small local server adapter.

## License

[MIT](LICENSE)
