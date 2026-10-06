# The Secrets Project

This is a mirror of the code repository for [The Secrets Project](https://thesecretsproject.com). If you came looking for the answers, nice try—the secrets have been redacted.

## Engine overview

Each secret is its own little module, carrying the rules for detecting it and the pieces it contributes to the page. The engine finds these modules at startup and assembles their contributions into named slots. A secret can create new slots for other secrets to occupy, or transform how existing contributions fit together. That lets separately written discoveries nest, combine and rearrange the interface without every secret needing to know how every other secret works. Even the places where things appear can be things you have to discover.

Your browser sends small batches of interactions to the server, where the engine routes them to the relevant detectors and checks their prerequisites. When something unlocks, the server composes the newly available pieces into your page. Interactive code is built into separate, self-contained bundles called *islands*, which are delivered when you have access to them. The same system ties together recognizing an action, remembering a discovery, changing the interface and admitting the next piece of code—all while keeping the rules for undiscovered secrets on the server, where Inspect Element can express its disappointment.

Even with the secrets redacted, would you believe this thing still runs? There’s a tiny working demo tucked inside, with one made-up secret so you can watch the machinery work without spoiling the real ones.

## License

[MIT](LICENSE)
