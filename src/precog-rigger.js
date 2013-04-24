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
  }

  //= ext/vow.js
  if (typeof window == 'undefined') {
    Vow = module.exports;
  }

  //= precog-http.js
  //= precog-api.js

  return {
    http: PrecogHttp,
    api:  Precog
  };
});
