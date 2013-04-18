/**
 * An HTTP implementation that detects which implementation to use.
 *
 * @example
 * PrecogHttp({
 *   method: "GET",
 *   url: "http://api.precog.com",
 *   query: { apiKey: "12321323" },
 *   content: {"foo": "bar"},
 *   success: function(result) { },
 *   failure: function(result) { },
 *   progress: function(status) { }
 * })
 */
var PrecogHttp = function(options) {
  if (typeof window === 'undefined') return this.nodejs(options);
  else if ('withCredentials' in this.createAjax()) return this.ajax(options);
  else return this.jsonp(options);
};

(function(PrecogHttp) {
  var Util = {};

  Util.addQuery = function(url, query) {
    var hashtagpos = url.lastIndexOf('#'), hash = '';
    if (hashtagpos >= 0) {
      hash = "#" + url.substr(hashtagpos + 1);
      url  = url.substr(0, hashtagpos);
    }
    var suffix = url.indexOf('?') == -1 ? '?' : '&';
    var queries = [];
    for (var name in query) {
      if (query[name] !== null) {
        var value = query[name].toString();

        if (value.length > 0) {
          queries.push(encodeURIComponent(name) + '=' + encodeURIComponent(value));
        }
      }
    }
    if (queries.length === 0) return url + hash;
    else return url + suffix + queries.join('&') + hash;
  };

  Util.defopts = function(f) {
    return function(options) {
      var o = {};

      o.method   = options.method || 'GET';
      o.url      = Util.addQuery(options.url, options.query);
      o.content  = options.content;
      o.headers  = options.headers || {};
      o.success  = options.success;
      o.failure  = options.failure || function() {};
      o.progress = options.progress || function() {};

      return f(o);
    };
  };

  Util.responseCallback = function(response, success, failure) {
    if (request.status >= 200 && request.status < 300) {
      success(response);
    } else {
      failure(response);
    }
  };

  Util.strtrim = function(string) {
    return string.replace(/^\s+|\s+$/g, '');
  };

  Util.objsize = function(obj) {
    var size = 0;
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) size++;
    }
    return size;
  };

  PrecogHttp.createAjax = function() {
    if (window.XMLHttpRequest) return new XMLHttpRequest();
    else return new ActiveXObject("Microsoft.XMLHTTP");
  };

  /**
   * @example
   * PrecogHttp.ajax({
   *   method: "GET",
   *   url: "http://api.precog.com",
   *   query: { apiKey: "12321323" },
   *   content: {"foo": "bar"},
   *   success: function(result) { },
   *   failure: function(result) { },
   *   progress: function(status) { }
   * })
   */
  PrecogHttp.ajax = Util.defopts(function(options) {
    var parseResponseHeaders = function(xhr) {
      var headers = {};

      if (xhr.getAllResponseHeaders) {
        var responseHeaders = xhr.getAllResponseHeaders().split(/\r?\n/);

        for (var i = 0; i < responseHeaders.length; i++) {
          if (responseHeaders[i]) {
            var line = responseHeaders[i];

            var colonIdx = line.indexOf(':');

            var name  = Util.strtrim(line.substr(0, colonIdx));
            var value = Util.strtrim(line.substr(colonIdx + 1));

            headers[name] = value;
          }
        }
      }

      if (Util.objsize(headers) === 0 && xhr.getResponseHeader) {
        var contentType = xhr.getResponseHeader('Content-Type');

        if (contentType) {
          headers["Content-Type"] = contentType;
        }
      }

      return headers;
    };

    var request = PrecogHttp.createAjax();

    request.open(options.method, options.url);

    request.upload && (request.upload.onprogress = function(e) {
      if (e.lengthComputable) {
        options.progress({loaded : e.loaded, total : e.total });
      }
    });

    request.onreadystatechange = function() {
      var headers = parseResponseHeaders(request);

      if (request.readyState === 4) {
        var content = this.responseText;

        if (content != null) {
          try {
            var ctype = headers['Content-Type'];
            if (ctype == 'application/json' || ctype == 'text/json')
              content = JSON.parse(this.responseText);
          } catch (e) {}
        }

        Util.responseCallback({
          headers:    headers, 
          content:    content, 
          status:     request.status,
          statusText: request.statusText
        }, success, failure);
      }
    };

    for (var name in options.headers) {
      var value = options.headers[name];
      request.setRequestHeader(name, value);
    }

    if (options.content !== undefined) {
      if (options.headers['Content-Type']) {
        request.send(options.content);
      } else {
        request.setRequestHeader('Content-Type', 'application/json');
        request.send(JSON.stringify(options.content));
      }
    } else {
      request.send(null);
    }

    return request;
  });

  /**
   * @example
   * PrecogHttp.jsonp({
   *   method: "GET",
   *   url: "http://api.precog.com",
   *   query: { apiKey: "12321323" },
   *   content: {"foo": "bar"},
   *   success: function(result) { },
   *   failure: function(result) { },
   *   progress: function(status) { }
   * })
   */
  Precog.jsonp = Util.defopts(function(options) {
    var random = Math.floor(Math.random() * 214748363);
    var fname  = 'PrecogJsonpCallback' + random.toString();

    window[fname] = function(content, meta) {
      Util.responseCallback({
        headers:    meta.headers, 
        content:    content, 
        status:     meta.status.code, 
        statusText: meta.status.reason
      }, success, failure);

      document.head.removeChild(document.getElementById(fname));

      try{
        delete window[fname];
      } catch(e) {
        window[fname] = undefined;
      }
    };

    var extraQuery = {};

    extraQuery.method = options.method;

    if (options.headers && Util.objsize(options.headers) > 0) {
      extraQuery.headers = JSON.stringify(options.headers);
    }

    extraQuery.callback = fname;

    if (options.content !== undefined) {
      extraQuery.content = JSON.stringify(options.content);
    }

    var fullUrl = Util.addQuery(options.url, extraQuery);

    var script = document.createElement('SCRIPT');

    script.setAttribute('type', 'text/javascript');
    script.setAttribute('src',  fullUrl);
    script.setAttribute('id',   fname);

    // Workaround for document.head being undefined.
    if (!document.head) document.head = document.getElementsByTagName('head')[0];

    document.head.appendChild(script);
  });

  /**
   * @example
   * PrecogHttp.nodejs({
   *   method: "GET",
   *   url: "http://api.precog.com",
   *   query: { apiKey: "12321323" },
   *   content: {"foo": "bar"},
   *   success: function(result) { },
   *   failure: function(result) { },
   *   progress: function(status) { }
   * })
   */
  Precog.nodejs = Util.defopts(function(options) {
    
  });
})(PrecogHttp);