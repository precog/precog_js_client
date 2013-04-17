var PrecogHttp = {
  _defopts: function(options) {
    options.method  = options.method || 'GET';
    options.query   = options.query || {};
    options.path     = Util.addQueryParameters(options.path, query);
    options.headers  = options.headers || {};
    options.success  = options.success;
    options.failure  = options.failure || function() {};
    options.progress = options.progress || function() {};
  },

  ajax: function(options) {
    _defopts(options);

    window.console && 
      window.console.info('HTTP ' + method + ' ' + path + ': headers(' + JSON.stringify(headers) + '), content('+ JSON.stringify(content) + ')');

    var request = (function() {
      if (window.XMLHttpRequest) return new XMLHttpRequest();
      else return new ActiveXObject("Microsoft.XMLHTTP");
    })();

    request.open(method, path);

    request.upload && (
      request.upload.onprogress = function(e) {
        if (e.lengthComputable) {
          progress({ loaded : e.loaded, total : e.total });
        }
      };
    );

    request.onreadystatechange = function() {
      var headers = request.getAllResponseHeaders && 
        Util.parseResponseHeaders(request.getAllResponseHeaders()) || {};

      if (request.readyState === 4) {
        if (request.status >= 200 && request.status < 300 || 
            request.status === "OK" || request.code === "NoContent") {
          if (request.responseText !== null && request.responseText.length > 0) {
            var response = this.responseText;

            try {
              var ctype = headers['Content-Type'];
              if (ctype == 'application/json' || ctype == 'text/json')
                response = JSON.parse(this.responseText);
            } catch (e) {}

            success(json, headers);
          }
          else {
            success(undefined, headers);
          }
        }
        else {
          failure(request.status, request.responseText ? JSON.parse(request.responseText) : request.statusText, headers);
        }
      }
    };

    for (var name in headers) {
      var value = headers[name];
      request.setRequestHeader(name, value);
    }

    if (content !== undefined) {
      if (headers['Content-Type']) {
        request.send(content);
      } else {
        request.setRequestHeader('Content-Type', 'application/json');
        request.send(JSON.stringify(content));
      }
    }
    else {
      request.send(null);
    }

    return request;
  },

  jsonp: function(options) {
    _defopts(options);

    window.console && 
      window.console.info('HTTP ' + method + ' ' + path + ': headers(' + JSON.stringify(headers) + '), content('+ JSON.stringify(content) + ')');

    var random   = Math.floor(Math.random() * 214748363);
    var funcName = 'PrecogJsonpCallback' + random.toString();

    window[funcName] = function(content, meta) {
      if (meta.status.code === 200 || meta.status.code === "OK" || meta.status.code === "NoContent" || meta.status.code === "Created") {
        success(content, meta.headers);
      }
      else {
        failure(meta.status.code, content ? content : meta.status.reason, meta.headers);
      }

      document.head.removeChild(document.getElementById(funcName));

      try{
          delete window[funcName];
      }catch(e){
          window[funcName] = undefined;
      }
    };

    var extraQuery = {};

    extraQuery.method = method;

    for (var _ in headers) { extraQuery.headers = JSON.stringify(headers); break; }

    extraQuery.callback = funcName;

    if (content !== undefined) {
      extraQuery.content = JSON.stringify(content);
    }

    var fullUrl = Util.addQueryParameters(path, extraQuery);

    var script = document.createElement('SCRIPT');

    script.setAttribute('type', 'text/javascript');
    script.setAttribute('src',  fullUrl);
    script.setAttribute('id',   funcName);

    // Workaround for document.head being undefined.
    if (!document.head) document.head = document.getElementsByTagName('head')[0];

    document.head.appendChild(script);
  }
};