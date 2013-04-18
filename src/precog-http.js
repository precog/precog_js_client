var PrecogHttp = {};

(function(PrecogHttp) {
  var defopts = function(f) {
    var addQuery = function(url, query) {
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

    return function(options) {
      var o = {};

      o.method   = options.method || 'GET';
      o.query    = options.query || {};
      o.path     = addQuery(options.path, query);
      o.content  = options.content;
      o.headers  = options.headers || {};
      o.success  = options.success;
      o.failure  = options.failure || function() {};
      o.progress = options.progress || function() {};

      return f(o);
    };
  };

  PrecogHttp.ajax = defopts(function(options) {
    var parseResponseHeaders = function(xhr) {
      var trim = function(string) {
        return string.replace(/^\s+|\s+$/g, '');
      };
      var size = function(obj) {
        var size = 0;
        for (var key in obj) {
          if (obj.hasOwnProperty(key)) size++;
        }
        return size;
      };

      var headers = {};

      if (xhr.getAllResponseHeaders) {
        var responseHeaders = xhr.getAllResponseHeaders().split(/\r?\n/);

        for (var i = 0; i < responseHeaders.length; i++) {
          if (responseHeaders[i]) {
            var line = responseHeaders[i];

            var colonIdx = line.indexOf(':');

            var name  = trim(line.substr(0, colonIdx));
            var value = trim(line.substr(colonIdx + 1));

            headers[name] = value;
          }
        }
      }

      if (size(headers) === 0 && xhr.getResponseHeader) {
        var contentType = xhr.getResponseHeader('Content-Type');

        if (contentType) {
          headers["Content-Type"] = contentType;
        }
      }

      return headers;
    };

    var request = (function() {
      if (window.XMLHttpRequest) return new XMLHttpRequest();
      else return new ActiveXObject("Microsoft.XMLHTTP");
    })();

    request.open(options.method, options.path);

    request.upload && (request.upload.onprogress = function(e) {
      if (e.lengthComputable) {
        options.progress({loaded : e.loaded, total : e.total });
      }
    });

    request.onreadystatechange = function() {
      var headers = parseResponseHeaders(request);

      if (request.readyState === 4) {
        var response = this.responseText;

        if (response != null) {
          try {
            var ctype = headers['Content-Type'];
            if (ctype == 'application/json' || ctype == 'text/json')
              response = JSON.parse(this.responseText);
          } catch (e) {}
        }

        if (request.status >= 200 && request.status < 300) {
          success({headers: headers, content: response, status: request.status});
        }
        else {
          failure({headers: headers, content: response, status: request.status});
        }
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

  Precog.jsonp = defopts(function(options) {
    var random   = Math.floor(Math.random() * 214748363);
    var funcName = 'PrecogJsonpCallback' + random.toString();

    window[funcName] = function(content, meta) {
      if (meta.status.code === 200 || meta.status.code === "OK" || meta.status.code === "NoContent" || meta.status.code === "Created") {
        options.success(content, meta.headers);
      }
      else {
        failure(meta.status.code, content ? content : meta.status.reason, meta.headers);
      }

      document.head.removeChild(document.getElementById(funcName));

      try{
        delete window[funcName];
      } catch(e){
        window[funcName] = undefined;
      }
    };

    var extraQuery = options.query;

    extraQuery.method = options.method;

    if (options.headers) {
      extraQuery.headers = JSON.stringify(options.headers);
    }

    extraQuery.callback = funcName;

    if (options.content !== undefined) {
      extraQuery.content = JSON.stringify(options.content);
    }

    var fullUrl = addQuery(options.path, extraQuery);

    var script = document.createElement('SCRIPT');

    script.setAttribute('type', 'text/javascript');
    script.setAttribute('src',  fullUrl);
    script.setAttribute('id',   funcName);

    // Workaround for document.head being undefined.
    if (!document.head) document.head = document.getElementsByTagName('head')[0];

    document.head.appendChild(script);
  });

  Precog.nodejs = defopts(function(options) {
    
  });
})(PrecogHttp);