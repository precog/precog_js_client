(function(definition) {
  if (typeof bootstrap === "function") {
    // Montage Require
    bootstrap("precog", definition);
  } else if (typeof exports === "object") {
    // CommonJS
    module.exports = definition();
  } else if (typeof define === "function") {
    // RequireJS
    define(definition);
  } else if (typeof ses !== "undefined") {
    // SES (Secure EcmaScript)
    if (!ses.ok()) return;
    ses.makePrecog = definition;
  } else {
    // <script>
    window.Precog = definition();
  }
})(function() {
  //= ext/Base64.js

  //= ext/json2.js

  if (typeof window !== 'undefined') {
    //= ext/sessionstorage.1.4.js
  } else {
    var storage = {};

    localStorage = {
      setItem: function(key, value) {
        storage[key] = value;
      },

      getItem: function(key) {
        return storage[key];
      },

      removeItem: function(key) {
        delete storage[key];
      }
    };
  }

  //= ext/vow.js
  if (typeof window == 'undefined') {
    Vow = module.exports;
  }

  //= precog-http.js
  //= precog-api.js

  /**
   * The API exported by the Precog JS Client.
   * @namespace precog
   */

  /**
   * Constructs a new Precog client library.
   *
   * @constructor api
   * @memberof precog
   *
   * @param config.apiKey             The API key of the authorizing account.
   *                                  This is not needed to access the accounts
   *                                  API methods.
   *
   * @param config.analyticsService   The URL to the analytics service. This is
   *                                  a required parameter for all API methods.
   * @returns {Precog}
   */

  /**
   * An HTTP implementation that detects which implementation to use.
   *
   * @constructor http
   * @memberof precog
   * @param {Object} options
   * @returns {PrecogHttp}
   */

  return {
    http: PrecogHttp,
    api:  Precog
  };
});
