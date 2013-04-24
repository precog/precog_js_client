# Precog Client for JavaScript

[Precog](http://www.precog.com/) is a powerful analytics platform for
JSON data. This JavaScript client allows easy querying and uploading
of data.

## Installation

### Browser

Include `precog.min.js` to get a global `Precog` object:

```html
<script src="precog.min.js"></script>
```

### node.js

Install the `precog` library:

```bash
npm install precog
```

And load the library:

```javascript
var precog = require('precog');
```

## Developement

If you would like to made modifications to the source, you can build a
distribution by running the following from the project directory:

```bash
npm install
```

Tests can be run from npm:

```bash
npm test
```

Or by loading `test-api.htm` under the `test` directory into a
browser.

## Documentation

Visit the
[Precog Developer Center](http://www.precog.com/developers/getting-started/sign-up/)
for documentation on the REST API and client libraries.
