
/**
 * Constructs a new Precog client library.
 *
 * @param config.apiKey             The API key of the authorizing account. 
 *                                  This is not needed to access the accounts 
 *                                  API methods.
 *
 * @param config.analyticsService   The URL to the analytics service. This is 
 *                                  a required parameter for all API methods.
 *
 */
function Precog(config) {
  if(!(this instanceof Precog)) return new Precog(config);
  this.config = config;
}

(function(Precog) {
  var Util = {};

  Util.error = function(msg) {
    if (typeof console != 'undefined') console.error(msg);
    throw new Error(msg);
  };
  Util.amap = function(a, f) {
    var ap = [];
    for (var i = 0; i < a.length; i++) {
      ap.push(f(a[i]));
    }
    return ap;
  };
  Util.acontains = function(a, v) {
    for (var i = 0; i < a.length; i++) {
      if (a[i] == v) return true;
    }
    return false;
  };
  Util.requireParam = function(v, name) {
    if (v == null) Util.error('The parameter "' + name + '" may not be null or undefined');
  };
  Util.requireField = function(v, name) {
    if (v == null || v[name] == null) Util.error('The field "' + name + '" may not be null or undefined');
  };
  Util.removeTrailingSlash = function(path) {
    if (path == null || path.length === 0) return path;
    else if (path.substr(path.length - 1) == "/") return path.substr(0, path.length - 1);
    else return path;
  };
  Util.composef = function(f, g) {
    if (!f) return g;
    if (!g) return f;
    else return function(v) {
      return f(g(v));
    };
  };
  Util.parentPath = function(v0) {
    var v = Util.removeTrailingSlash(Util.sanitizePath(v0));
    var elements = v.split('/');
    var sliced = elements.slice(0, elements.length - 1);
    if (!sliced.length) return '/';
    return sliced.join('/');
  };
  Util.lastPathElement = function(v0) {
    var v = Util.sanitizePath(v0);
    var elements = v.split('/');
    if (elements.length === 0) return undefined;
    return elements[elements.length - 1];
  };
  Util.extractField = function(field) { return function(v) { return v[field]; }; };
  Util.extractContent = Util.extractField('content');
  Util.safeCallback = function(f) {
    if (f == null) {
      return function(v) { return v; };
    } else {
      return function(v) {
        var r = f(v);
        if (r === undefined) return v;
        return r;
      };
    }
  };

  Util.sanitizePath = function(path) {
    return path.replace(/\/+/g, '/');
  };
  Util.merge = function(o1, o2) {
    var r, key, index;
    if (o1 === undefined) return o2;
    else if (o2 === undefined) return o1;
    else if (o1 instanceof Array && o2 instanceof Array) {
      r = [];
      // Copy
      for (index = 0; index < o1.length; index++) {
        r.push(o1[index]);
      }
      // Merge
      for (index = 0; index < o2.length; index++) {
        if (r.length > index) {
          r[index] = Util.merge(r[index], o2[index]);
        } else {
          r.push(o2[index]);
        }
      }
    } else if (o1 instanceof Object && o2 instanceof Object) {
      r = {};
      // Copy:
      for (key in o1) {
        r[key] = o1[key];
      }
      // Merge:
      for (key in o2) {
        if (r[key] !== undefined) {
          r[key] = Util.merge(r[key], o2[key]);
        } else {
          r[key] = o2[key];
        }
      }
      return r;
    } else {
      return o2;
    }
  };
  Util.addCallbacks = function(f) {
    return function(v, success, failure) {
      return f.call(this, v).then(Util.safeCallback(success), failure);
    };
  };

  Precog.prototype.serviceUrl = function(serviceName, serviceVersion, path) {
    Util.requireField(this.config, "analyticsService");

    return this.config.analyticsService + 
           Util.sanitizePath("/" + serviceName + "/v" + serviceVersion + "/" + (path || ''));
  };

  Precog.prototype.accountsUrl = function(path) {
    return this.serviceUrl("accounts", 1, path);
  };

  Precog.prototype.securityUrl = function(path) {
    return this.serviceUrl("security", 1, path);
  };

  Precog.prototype.dataUrl = function(path) {
    return this.serviceUrl("ingest", 1, path);
  };

  Precog.prototype.analysisUrl = function(path) {
    return this.serviceUrl("analytics", 1, path);
  };

  Precog.prototype.metadataUrl = function(path) {
    return this.serviceUrl("meta", 1, path);
  };

  Precog.prototype.requireConfig = function(name) {
    if (this.config == null || this.config[name] == null) 
      Util.error('The configuration field "' + name + '" may not be null or undefined');
  };

  // *************
  // *** ENUMS ***
  // *************
  Precog.GrantTypes = {
    Append:   "append",
    Replace:  "replace",
    Execute:  "execute",
    Mount:    "mount",
    Create:   "create",
    Explore:  "explore"
  };

  Precog.FileTypes = {
    JSON:           'application/json',
    JSON_STREAM:    'application/x-json-stream',
    CSV:            'text/csv',
    ZIP:            'application/zip',
    GZIP:           'application/x-gzip',
    QUIRREL_SCRIPT: 'text/x-quirrel-script'
  };

  // ****************
  // *** ACCOUNTS ***
  // ****************

  /**
   * Creates a new account with the specified email and password. In order for 
   * this function to succeed, the specified email cannot already be associated
   * with an account.
   *
   * @example
   * Precog.createAccount({email: "jdoe@foo.com", password: "abc123"});
   */
  Precog.prototype.createAccount = Util.addCallbacks(function(account) {
    var self = this;

    Util.requireField(account, 'email');
    Util.requireField(account, 'password');

    return PrecogHttp.post({
      url:      self.accountsUrl("accounts/"),
      content:  account,
      success:  Util.extractContent
    });
  });

  /**
   * Requests a password reset for the specified email. This may or may not have
   * any effect depending on security settings.
   *
   * @example
   * Precog.requestPasswordReset('jdoe@foo.com');
   */
  Precog.prototype.requestPasswordReset = Util.addCallbacks(function(email) {
    var self = this;

    Util.requireParam(email, 'email');

    return self.lookupAccountId(email).then(function(accountId) {
      return PrecogHttp.post({
        url:      self.accountsUrl("accounts") + "/" + accountId + "/password/reset",
        content:  {email: email},
        success:  Util.extractContent
      });
    });
  });

  /**
   * Looks up the account associated with the specified email address.
   *
   * @example
   * Precog.lookupAccountId('jdoe@foo.com');
   */
  Precog.prototype.lookupAccountId = Util.addCallbacks(function(email) {
    var self = this;
    var resolver = Vow.promise();

    Util.requireParam(email, 'email');

    PrecogHttp.get({
      url:      self.accountsUrl("accounts/search"),
      query:    {email: email},
      success:  function(response) {
        var accounts = response.content;

        if (!accounts || accounts.length === 0) {
          resolver.reject({status: 400, statusText: 'No account ID found for given email'});
        } else {
          resolver.fulfill(accounts[0]);
        }
      },
      failure: resolver.reject
    });

    return resolver;
  });

  /**
   * Describes the specified account, identified by email and password.
   *
   * @example
   * Precog.describeAccount({email: 'jdoe@foo.com', password: 'abc123'});
   */
  Precog.prototype.describeAccount = Util.addCallbacks(function(account) {
    var self = this;

    Util.requireField(account, 'email');
    Util.requireField(account, 'password');

    return self.lookupAccountId(account.email).then(function(response) {
      return PrecogHttp.get({
        basicAuth: {
          username: account.email,
          password: account.password
        },
        url:      self.accountsUrl("accounts/" + response.accountId),
        success:  Util.extractContent
      });
    });
  });

  /**
   * Adds a grant to the specified account.
   *
   * @example
   * Precog.addGrantToAccount(
   *   {accountId: '23987123', grantId: '0d43eece-7abb-43bd-8385-e33bac78e145'}
   * );
   */
  Precog.prototype.addGrantToAccount = Util.addCallbacks(function(info) {
    var self = this;

    Util.requireField(info, 'accountId');
    Util.requireField(info, 'grantId');

    return PrecogHttp.post({
      url:      self.accountsUrl("accounts/" + info.accountId + "/grants/"),
      content:  {grantId: info.grantId},
      success:  Util.extractContent
    });
  });

  /**
   * Retrieves the plan that the specified account is on. The account is 
   * identified by email and password.
   *
   * @example
   * Precog.currentPlan({email: 'jdoe@foo.com', password: 'abc123'});
   */
  Precog.prototype.currentPlan = Util.addCallbacks(function(account) {
    var self = this;

    Util.requireField(account, 'email');
    Util.requireField(account, 'password');

    return self.lookupAccountId(account.email).then(function(response) {
      return PrecogHttp.get({
        basicAuth: {
          username: account.email,
          password: account.password
        },
        url:     self.accountsUrl("accounts/" + response.accountId + "/plan"),
        success: Util.composef(Util.extractField('type'), Util.extractContent)
      });
    });
  });

  /**
   * Changes the account's plan.
   *
   * @example
   * Precog.changePlan({email: 'jdoe@foo.com', password: 'abc123', plan: 'BRONZE'});
   */
  Precog.prototype.changePlan = Util.addCallbacks(function(account) {
    var self = this;

    Util.requireField(account, 'email');
    Util.requireField(account, 'password');
    Util.requireField(account, 'plan');

    return self.lookupAccountId(account.email).then(function(response) {
      return PrecogHttp.put({
        basicAuth: {
          username: account.email,
          password: account.password
        },
        url:      self.accountsUrl("accounts/" + response.accountId + "/plan"),
        content:  {type: account.plan},
        success:  Util.extractContent
      });
    });
  });

  /**
   * Delete's the account's plan, resetting it to the default plan on the system.
   *
   * @example
   * Precog.deletePlan({email: 'jdoe@foo.com', password: 'abc123'});
   */
  Precog.prototype.deletePlan = Util.addCallbacks(function(account) {
    var self = this;

    Util.requireField(account, 'email');
    Util.requireField(account, 'password');

    return self.lookupAccountId(account.email).then(function(response) {
      return PrecogHttp.delete0({
        basicAuth: {
          username: account.email,
          password: account.password
        },
        url:      self.accountsUrl("accounts/" + response.accountId + "/plan"),
        success:  Util.composef(Util.extractField('type'), Util.extractContent)
      });
    });
  });

  // ****************
  // *** SECURITY ***
  // ****************

  /**
   * Lists API keys.
   *
   * @example
   * Precog.listApiKeys();
   */
  Precog.prototype.listApiKeys = function(success, failure) {
    var self = this;

    self.requireConfig('apiKey');

    return PrecogHttp.get({
      url:      self.securityUrl("apikeys/"),
      query:    {apiKey: self.config.apiKey},
      success:  Util.extractContent
    }).then(Util.safeCallback(success), failure);
  };

  /**
   * Creates a new API key with the specified grants.
   *
   * @example
   * Precog.createApiKey(grants);
   */
  Precog.prototype.createApiKey = Util.addCallbacks(function(grants) {
    var self = this;

    Util.requireParam(grants, 'grants');
    self.requireConfig('apiKey');

    return PrecogHttp.post({
      url:      self.securityUrl("apikeys/"),
      content:  grants,
      query:    {apiKey: self.config.apiKey},
      success:  Util.extractContent
    });
  });

  /**
   * Describes an existing API key.
   *
   * @example
   * Precog.describeApiKey('475ae23d-f5f9-4ffc-b643-e805413d2233');
   */
  Precog.prototype.describeApiKey = Util.addCallbacks(function(apiKey) {
    var self = this;

    self.requireConfig('apiKey');

    return PrecogHttp.get({
      url:      self.securityUrl("apikeys/" + apiKey),
      query:    {apiKey: self.config.apiKey},
      success:  Util.extractContent
    });
  });

  /**
   * Deletes an existing API key.
   *
   * @example
   * Precog.deleteApiKey('475ae23d-f5f9-4ffc-b643-e805413d2233');
   */
  Precog.prototype.deleteApiKey = Util.addCallbacks(function(apiKey) {
    var self = this;

    Util.requireParam(apiKey, 'apiKey');
    self.requireConfig('apiKey');

    return PrecogHttp.delete0({
      url:      self.securityUrl("apikeys/" + apiKey),
      query:    {apiKey: self.config.apiKey},
      success:  Util.extractContent
    });
  });

  /**
   * Retrieves the grants associated with an existing API key.
   *
   * @example
   * Precog.retrieveApiKeyGrants('475ae23d-f5f9-4ffc-b643-e805413d2233');
   */
  Precog.prototype.retrieveApiKeyGrants = Util.addCallbacks(function(apiKey) {
    var self = this;

    Util.requireParam(apiKey, 'apiKey');
    self.requireConfig('apiKey');

    return PrecogHttp.get({
      url:      self.securityUrl("apikeys/" + apiKey + "/grants/"),
      query:    {apiKey: self.config.apiKey},
      success:  Util.extractContent
    });
  });

  /**
   * Adds a grant to an existing API key.
   *
   * @example
   * Precog.createApiKey({grant: grant, apiKey: apiKey});
   */
  Precog.prototype.addGrantToApiKey = Util.addCallbacks(function(info) {
    var self = this;

    Util.requireField(info, 'grant');
    Util.requireField(info, 'apiKey');

    self.requireConfig('apiKey');

    return PrecogHttp.post({
      url:      self.securityUrl("apikeys/" + info.apiKey + "/grants/"),
      content:  info.grant,
      query:    {apiKey: self.config.apiKey},
      success:  Util.extractContent
    });
  });

  /**
   * Removes a grant from an existing API key.
   *
   * @example
   * Precog.removeGrantFromApiKey({
   *   apiKey: '475ae23d-f5f9-4ffc-b643-e805413d2233', 
   *   grantId: '0b47db0d-ed14-4b56-831b-76b8bf66f976'
   * });
   */
  Precog.prototype.removeGrantFromApiKey = Util.addCallbacks(function(info) {
    var self = this;

    Util.requireField(info, 'grantId');
    Util.requireField(info, 'apiKey');

    self.requireConfig('apiKey');

    return PrecogHttp.delete0({
      url:      self.securityUrl("apikeys/" + info.apiKey + "/grants/" + info.grantId),
      query:    {apiKey: self.config.apiKey},
      success:  Util.extractContent
    });
  });

  /**
   * Creates a new grant.
   *
   * @example
   * Precog.createGrant({
   *   "name": "",
   *   "description": "",
   *   "parentIds": "",
   *   "expirationDate": "",
   *   "permissions" : [{
   *     "accessType": "read",
   *     "path": "/foo/",
   *     "ownerAccountIds": "[Owner Account Id]"
   *   }]
   * });
   */
  Precog.prototype.createGrant = Util.addCallbacks(function(grant) {
    var self = this;

    Util.requireParam(grant, 'grant');

    self.requireConfig('apiKey');

    return PrecogHttp.post({
      url:      self.securityUrl("grants/"),
      content:  grant,
      query:    {apiKey: self.config.apiKey},
      success:  Util.extractContent
    });
  });

  /**
   * Describes an existing grant.
   *
   * @example
   * Precog.describeGrant('581c36a6-0e14-487e-8622-3a38b828b931');
   */
  Precog.prototype.describeGrant = Util.addCallbacks(function(grantId) {
    var self = this;

    Util.requireParam(grantId, 'grantId');

    self.requireConfig('apiKey');

    return PrecogHttp.get({
      url:      self.securityUrl("grants/" + grantId),
      query:    {apiKey: self.config.apiKey},
      success:  Util.extractContent
    });
  });

  /**
   * Deletes an existing grant. In order for this operation to succeed,
   * the grant must have been created by the authorizing API key.
   *
   * @example
   * Precog.deleteGrant('581c36a6-0e14-487e-8622-3a38b828b931');
   */
  Precog.prototype.deleteGrant = Util.addCallbacks(function(grantId) {
    var self = this;

    Util.requireParam(grantId, 'grantId');

    self.requireConfig('apiKey');

    return PrecogHttp.delete0({
      url:      self.securityUrl("grants/" + grantId),
      query:    {apiKey: self.config.apiKey},
      success:  Util.extractContent
    });
  });

  /**
   * Lists the children of an existing grant.
   *
   * @example
   * Precog.listGrantChildren('581c36a6-0e14-487e-8622-3a38b828b931');
   */
  Precog.prototype.listGrantChildren = Util.addCallbacks(function(grantId) {
    var self = this;

    Util.requireParam(grantId, 'grantId');

    self.requireConfig('apiKey');

    return PrecogHttp.get({
      url:      self.securityUrl("grants/" + grantId + "/children/"),
      query:    {apiKey: self.config.apiKey},
      success:  Util.extractContent
    });
  });

  /**
   * Lists the children of an existing grant.
   *
   * @example
   * Precog.createGrantChild({
   *   parentGrantId: '581c36a6-0e14-487e-8622-3a38b828b931', 
   *   childGrant: childGrant
   * });
   */
  Precog.prototype.createGrantChild = Util.addCallbacks(function(info) {
    var self = this;

    Util.requireField(info, 'parentGrantId');
    Util.requireField(info, 'childGrant');

    self.requireConfig('apiKey');

    return PrecogHttp.post({
      url:      self.securityUrl("grants/" + info.parentGrantId + "/children/"),
      content:  info.childGrant,
      query:    {apiKey: self.config.apiKey},
      success:  Util.extractContent
    });
  });

  // ****************
  // *** METADATA ***
  // ****************

  /**
   * Retrieves metadata for the specified path.
   *
   * @example
   * Precog.getMetadata('/foo');
   */
  Precog.prototype.getMetadata = Util.addCallbacks(function(path) {
    var self = this;

    Util.requireParam(path, 'path');

    self.requireConfig('apiKey');

    return PrecogHttp.get({
      url:      self.metadataUrl("fs/" + path),
      query:    {apiKey: self.config.apiKey},
      success:  Util.extractContent
    });
  });

  /**
   * Legacy method (retrieves raw API results).
   */   
  Precog.prototype._retrieveMetadata = Util.addCallbacks(function(path) {
    var self = this;

    Util.requireParam(path, 'path');

    self.requireConfig('apiKey');

    return PrecogHttp.get({
      url:      self.metadataUrl("fs/" + path),
      query:    {apiKey: self.config.apiKey},
      success:  Util.extractContent
    });
  });

  Precog.prototype._isEmulateData = function(path0) {
    Util.requireParam(path0, 'path');

    if (typeof localStorage !== 'undefined') {
      var path = Util.sanitizePath(path0);

      return localStorage.getItem('Precog.' + path) != null;
    }

    return false;
  };

  Precog.prototype._getEmulateData = function(path0) {
    Util.requireParam(path0, 'path');

    var data = {};
    if (typeof localStorage !== 'undefined') {
      var path = Util.sanitizePath(path0);

      data = JSON.parse(localStorage.getItem('Precog.' + path) || '{}');
    }

    return data;
  };

  Precog.prototype._deleteEmulateData = function(path0) {
    Util.requireParam(path0, 'path');

    if (typeof localStorage !== 'undefined') {
      var path = Util.sanitizePath(path0);

      localStorage.removeItem('Precog.' + path);
    }
  };

  Precog.prototype._setEmulateData = function(path0, data) {
    var self = this;

    Util.requireParam(path0, 'path');

    if (typeof localStorage !== 'undefined') {
      var path = Util.sanitizePath(path0);

      var data0 = self._getEmulateData(path);

      localStorage.setItem('Precog.' + path, JSON.stringify(Util.merge(data0, data)));
    }
  };

  /**
   * Retrieves all children of the specified path.
   *
   * @example
   * Precog.listChildren('/foo');
   */
  Precog.prototype.listChildren = Util.addCallbacks(function(path) {
    var self = this;

    Util.requireParam(path, 'path');

    // FIXME: EMULATION
    // Get extra children not stored in file system:
    var nodeData = self._getEmulateData(path);

    var extraChildren = nodeData.children || [];

    function addExtraChildren(metadata) {
      return metadata.children.concat(extraChildren);
    }
     // END EMULATION

    return this._retrieveMetadata(path).then(addExtraChildren);
  });

  /**
   * Retrieves all descendants of the specified path.
   *
   * @example
   * Precog.listDescendants('/foo');
   */
  Precog.prototype.listDescendants = Util.addCallbacks(function(path) {
    var self = this;

    Util.requireParam(path, 'path');

    function listDescendants0(root, prefix) {
      return self.listChildren(root).then(function(children) {
        var futures = Util.amap(children, function(child) {
          var fullPath = root + '/' + child;

          return listDescendants0(fullPath, prefix + child);
        });

        return Vow.all(futures).then(function(arrays) {
          var prefixed = Util.amap(children, function(child) {
            return prefix + child;
          });
          return [].concat.apply(prefixed, arrays);
        });
      });
    }

    return listDescendants0(path, '');
  });

  /**
   * Determines if the specified file exists.
   *
   * @example
   * Precog.existsFile('/foo/bar.json');
   */
  Precog.prototype.existsFile = Util.addCallbacks(function(path) {
    var self = this;

    Util.requireParam(path, 'path');

    var targetDir  = Util.parentPath(path);
    var targetName = Util.lastPathElement(path);

    if (targetName === '') Util.error('To determine if a file exists, the file name must be specified');

    return self.listChildren(targetDir).then(function(children) {
      return Util.acontains(children, targetName);
    });
  });

  // ************
  // *** DATA ***
  // ************

  /**
   * Uploads the specified contents to the specified path, using the specified
   * file type (which must be a mime-type accepted by the server).
   *
   * @example
   * Precog.uploadFile({path: '/foo/bar.csv', type: Precog.FileTypes.CSV, contents: contents});
   */
  Precog.prototype.uploadFile = Util.addCallbacks(function(info) {
    var self = this;
    var resolver;

    Util.requireField(info, 'path');
    Util.requireField(info, 'type');
    Util.requireField(info, 'contents');

    self.requireConfig('apiKey');

    var targetDir  = Util.parentPath(info.path);
    var targetName = Util.lastPathElement(info.path);

    if (targetName === '') Util.error('A file may only be uploaded to a specific directory');

    var fullPath = targetDir + '/' + targetName;

    // FIXME: EMULATION
    var emulate;

    switch (info.type) {
      case Precog.FileTypes.JSON:
      case Precog.FileTypes.JSON_STREAM:
      case Precog.FileTypes.CSV:
      case Precog.FileTypes.ZIP:
      case Precog.FileTypes.GZIP:

        emulate = false;
      break;

      default: 
        emulate = true;

      break;
    }

    if (emulate) {
      // FIXME: EMULATION
      var parentNode = self._getEmulateData(targetDir);

      var children = parentNode.children || [];

      children.push(targetName);

      // Keep track of children inside parent node:
      self._setEmulateData(targetDir, {children: children});

      // Keep track of the contents & type of this file:
      var fileNode = self._getEmulateData(fullPath);

      fileNode.type     = info.type;
      fileNode.contents = info.contents;
      fileNode.version  = fileNode.version ? fileNode.version + 1 : 1;
      fileNode.lastModified = new Date().getMilliseconds();

      self._setEmulateData(fullPath, fileNode);

      if (info.type === 'text/x-quirrel-script') {
        // The file is a script, immediately execute it:
        return self.executeFile({
          path: fullPath
        }).then(function(results) {
          // Take the data, and upload it to the file system.
          var data = results.data;

          return uploadFile({
            path:     fullPath,
            type:     'application/json',
            contents: data
          });
        }).then(function() {
          return {versions: {head: fileNode.version}};
        });
      } else {
        // The file is not a script, so we can't execute it, so just
        // report success:
        resolver = Vow.promise();
        resolver.fulfill({versions:{head: fileNode.version}});
        return resolver;
      }

      // END EMULATION
    } else {
      resolver = Vow.promise();
      self.delete0(fullPath).then(function() {
        return PrecogHttp.post({
          url:      self.dataUrl((info.async ? "async" : "sync") + "/fs/" + fullPath),
          content:  info.contents,
          query:    {
            apiKey:         self.config.apiKey,
            ownerAccountId: info.ownerAccountId,
            delimiter:      info.delimiter,
            quote:          info.quote,
            escape:         info.escape
          },
          headers:  { 'Content-Type': info.type }
        }).then(function(v) { resolver.fulfill(v.content); });
      }).done();
      return resolver;
    }
  });

  /**
   * Creates the specified file. The file must not already exist.
   *
   * @example
   * Precog.createFile({path: '/foo/bar.csv', type: Precog.FileTypes.CSV, contents: contents});
   */
  Precog.prototype.createFile = Util.addCallbacks(function(info) {
    var self = this;

    Util.requireField(info, 'path');
    Util.requireField(info, 'type');
    Util.requireFiled(info, 'contents');

    return self.existsFile(info.path).then(function(fileExists) {
      if (!fileExists) {
        return self.uploadFile(info);
      } else Util.error('The file ' + info.path + ' already exists');
    });
  });

  /**
   * Retrieves the contents of the specified file.
   *
   * @example
   * Precog.retrieveFile('/foo/bar.qrl');
   */
  Precog.prototype.retrieveFile = Util.addCallbacks(function(path) {
    var self = this;

    // FIXME: EMULATION
    if (self._isEmulateData(path)) {
      var fileNode = self._getEmulateData(path);
      var resolver = Vow.promise();
      resolver.fulfill({
        contents: fileNode.contents, 
        type:     fileNode.type
      });

      return resolver;
    } else {
      return self.execute({query: 'load("' + path + '")'}).then(function(results) {
        return {
          contents: JSON.stringify(results.data),
          type:    'application/json'
        };
      });
    }
    // END EMULATION
  });

  /**
   * Appends a JSON value to the specified file.
   *
   * @example
   * Precog.append({path: '/website/clicks.json', value: clickEvent});
   */
  Precog.prototype.append = Util.addCallbacks(function(info) {
    info.values = [info.value];

    delete info.value;

    return this.appendAll(info, success, failure);
  });

  /**
   * Appends a collection of JSON values to the specified file.
   *
   * @example
   * Precog.append({path: '/website/clicks.json', values: clickEvents});
   */
  Precog.prototype.appendAll = Util.addCallbacks(function(info) {
    var self = this;

    Util.requireField(info, 'value');
    Util.requireField(info, 'path');

    self.requireConfig('apiKey');

    var targetDir  = Util.parentPath(info.path);
    var targetName = Util.lastPathElement(info.path);

    if (targetName === '') Util.error('Data must be appended to a specific file.');

    var fullPath = targetDir + '/' + targetName;

    return PrecogHttp.post({
      url:      self.dataUrl(info.async ? "async" : "sync") + "/fs/" + fullPath,
      content:  info.values,
      query:    {
                  apiKey:         self.config.apiKey,
                  ownerAccountId: info.ownerAccountId
                },
      headers:  { 'Content-Type': 'application/json' },
      success:  Util.extractContent
    });
  });

  /**
   * Deletes a specified file in the Precog file system.
   *
   * @example
   * Precog.delete0('/website/clicks.json');
   */
  Precog.prototype.delete0 = Util.addCallbacks(function(path) {
    var self = this;

    Util.requireParam(path, 'path');

    self.requireConfig('apiKey');

    self._deleteEmulateData(path);

    return PrecogHttp.delete0({
      url:      self.dataUrl("async/fs/" + path),
      query:    {apiKey: self.config.apiKey},
      success:  Util.extractContent
    });
  });

  /**
   * Deletes the specified directory and everything it contains.
   *
   * @example
   * Precog.deleteAll('/website/');
   */
  Precog.prototype.deleteAll = Util.addCallbacks(function(path0) {
    var self = this;

    Util.requireParam(path0, 'path');

    self.requireConfig('apiKey');

    var path = Util.sanitizePath(path0 + '/');

    return self.listDescendants(path).then(function(children0) {
      // Convert relative paths to absolute paths:
      var absolutePaths = (Util.amap(children0, function(child) {
        return path + child;
      })).concat([path]);

      return Vow.all(Util.amap(absolutePaths, function(child) {
        return self.delete0(child);
      }));
    });
  });

  /**
   * Copies a file from specified source to specified destination.
   *
   * @example
   * Precog.copyFile({source: '/foo/v1.qrl', dest: '/foo/v2.qrl'})
   */
  Precog.prototype.copyFile = Util.addCallbacks(function(info) {
    var self = this;

    Util.requireField(info, 'source');
    Util.requireField(info, 'dest');

    return self.retrieveFile(info.source).then(function(file) {
      return self.uploadFile({
        path:     info.dest,
        type:     file.type,
        contents: file.contents
      });
    });
  });

  /**
   * Copies then deletes a file from specified source to specified
   * destination.
   *
   * @example
   * Precog.moveFile({source: '/foo/helloo.qrl', dest: '/foo/hello.qrl'})
   */
  Precog.prototype.moveFile = Util.addCallbacks(function(info) {
    var self = this;

    Util.requireField(info, 'source');
    Util.requireField(info, 'dest');

    return self.copyFile(info).then(function() {
      return self.delete0(info.source);
    });
  });

  /**
   * Copies then deletes a whole directory from specified source to
   * specified destination.
   *
   * @example
   * Precog.moveDirectory({source: '/foo/helloo', dest: '/foo/hello'})
   */
  Precog.prototype.moveDirectory = Util.addCallbacks(function(info) {
    var self = this;

    Util.requireField(info, 'source');
    Util.requireField(info, 'dest');

    return self.listDescendants(info.source).then(function(descendants) {
      var resolvers = [];

      // Copy each file
      for(var i = 0; i < descendants.length; i++) {
        resolvers.push(self.copyFile({
          source: info.source + '/' + descendants[i],
          dest:   info.dest + '/' + descendants[i]
        }));
      }

      return Vow.all(resolvers).then(function() {
        return self.deleteAll(info.source);
      });
    });
  });

  // ****************
  // *** ANALYSIS ***
  // ****************

  /**
   * Executes the specified file, which must be a Quirrel script.
   *
   * @example
   * Precog.executeFile({path: '/foo/script.qrl'});
   */
  Precog.prototype.executeFile = Util.addCallbacks(function(info) {
    var self = this;

    Util.requireField(info, 'path');

    // FIXME: EMULATION
    if (self._isEmulateData(info.path) && info.maxAge) {
      // User wants to cache, see if there's a cached version:
      var fileNode = self._getEmulateData(info.path);

      if (fileNode.cached) {
        var cached = fileNode.cached;

        // There's a cached version, see if it's fresh enough:
        var now = (new Date()).getMilliseconds() / 1000;

        var age = now - cached.timestamp;

        if (age < info.maxAge || info.maxStale && (age < (info.maxAge + info.maxStale))) {
          var resolver = Vow.promise();
          resolver.fulfill(cached.results);
          return resolver;
        }
      }
    }
    // END EMULATION

    // FIXME: EMULATION

    // Pull back the contents of the file:
    return self.retrieveFile(info.path).then(function(file) {
      // See if the file is executable:
      if (file.type === 'text/x-quirrel-script') {
        var executeRequest = {
          query: file.contents
        };

        // Execute the script:
        return self.execute(executeRequest).then(function(results) {
          if (typeof localStorage !== 'undefined') {
            // If there are no errors, store the cached execution of the script:
            if (!results.errors || !results.errors.length) {
              var fileNode = self._getEmulateData(info.path);

              fileNode.type     = 'text/x-quirrel-script';
              fileNode.contents = file.contents;
              fileNode.cached = {
                results:   results,
                timestamp: (new Date()).getMilliseconds() / 1000
              };

              self._setEmulateData(info.path, fileNode);
            }
          }

          return results;
        });
      } else {
        Util.error('The file ' + info.path +
                   ' does not have type text/x-quirrel-script and therefore cannot be executed');
      }
    });

    // END EMULATION
  });

  /**
   * Executes the specified Quirrel query.
   *
   * Optionally, a 'path' field may be specified which uses that path as
   * the base path.
   *
   * @return {"data": ..., "errors": ..., "warnings": ...}
   *
   * @example
   * Precog.execute({query: 'count(//foo)'});
   */
  Precog.prototype.execute = Util.addCallbacks(function(info) {
    var self = this;

    Util.requireField(info, 'query');

    self.requireConfig('apiKey');

    return PrecogHttp.get({
      url:      self.analysisUrl("fs/" + (info.path || '')),
      query:    {
                  apiKey: self.config.apiKey, 
                  q:      info.query,
                  limit:  info.limit,
                  skip:   info.skip,
                  sortOn: info.sortOn,
                  format: 'detailed'
                },
      success:  Util.extractContent
    });
  });

  /**
   * Submits a Quirrel query and gives a job identifier back. Use
   * asyncQueryResults to poll for results.
   *
   * @example
   * Precog.asyncQuery({query: '1 + 4'});
   */
  Precog.prototype.asyncQuery = Util.addCallbacks(function(info) {
    var self = this;

    Util.requireField(info, 'query');

    return PrecogHttp.post({
      url:      self.analysisUrl("queries"),
      query:    {
                  apiKey     : self.config.apiKey,
                  q          : info.query,
                  limit      : info.limit,
                  basePath   : info.path,
                  skip       : info.skip,
                  order      : info.order,
                  sortOn     : info.sortOn,
                  sortOrder  : info.sortOrder,
                  timeout    : info.timeout,
                  prefixPath : info.prefixPath,
                  format     : info.format
                },
      success:  Util.extractContent
    });
  });

  /**
   * Poll the status of the specified query job.
   *
   * @example
   * Precog.asyncQuery('8837ee1674fb478fb2ebb0b521eaa6ce');
   */
  Precog.prototype.asyncQueryResults = Util.addCallbacks(function(jobId) {
    var self = this;

    Util.requireParam(jobId, 'jobId');

    return PrecogHttp.get({
      url:      self.analysisUrl("queries/") + jobId,
      query:    {apiKey: self.config.apiKey},
      success:  Util.extractContent
    });
  });
})(Precog);
