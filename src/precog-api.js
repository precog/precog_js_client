
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
  Util.sanitizePath = function(path) {
    return path.replace(/[\/]+/g, "/");
  };
  Util.composef = function(f, g) {
    if (f == null || g == null) return undefined;
    else return function(v) {
      return f(g(v));
    };
  };
  Util.parentPath = function(v0) {
    var v = Util.removeTrailingSlash(Util.sanitizePath(v0));
    var elements = v.split('/');
    var sliced = elements.slice(0,-1);
    if (sliced.length <= 1) return '/';
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
  Util.unwrapSingleton = function(v) { return v instanceof Array ? v[0] : v; };
  Util.defSuccess = function(success) {
    return Util.composef(success, Util.extractContent);
  };
  Util.safeCallback = function(f) {
    if (f == null) return function(v) { return v; };
    else return f;
  };

  Util.defSuccessSingletonArray = function(success) {
    return Util.composef(success, Util.composef(Util.unwrapSingleton, Util.extractContent));
  };

  Util.defFailure = function(failure) {
    return Util.composef(failure, function(r) { return {message: r.statusText, code: r.statusCode};});
  };

  Precog.prototype.serviceUrl = function(serviceName, serviceVersion, path) {
    Util.requireField(this.config, "analyticsService");

    var fullpathDirty = this.config.analyticsService + "/" + 
                        serviceName + "/v" + serviceVersion + "/" + (path || '');

    return Util.sanitizePath(fullpathDirty);
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
    return this.serviceUrl("metadata", 1, path);
  };

  Precog.prototype.requireConfig = function(name) {
    if (this.config == null || this.config[name] == null) 
      Util.error('The configuration field "' + name + '" may not be null or undefined');
  };

  // *************
  // *** ENUMS ***
  // *************
  Precog.prototype.GrantTypes = {
    Append:   "append",
    Replace:  "replace",
    Execute:  "execute",
    Mount:    "mount",
    Create:   "create",
    Explore:  "explore"
  };

  Precog.prototype.FileTypes = {
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
  Precog.prototype.createAccount = function(account, success, failure) {
    var self = this;

    Util.requireField(account, 'email');
    Util.requireField(account, 'password');

    return PrecogHttp.post({
      url:      self.accountsUrl("accounts"),
      content:  account,
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  /**
   * Requests a password reset for the specified email. This may or may not have
   * any effect depending on security settings.
   *
   * @example
   * Precog.requestPasswordReset('jdoe@foo.com');
   */
  Precog.prototype.requestPasswordReset = function(email, success, failure) {
    var self = this;

    Util.requireParam(email, 'email');

    return self.lookupAccountId(email).then(function(accountId) {
      return PrecogHttp.post({
        url:      self.accountsUrl("accounts/" + accountId + "/password/reset"),
        content:  {email: email},
        success:  Util.defSuccess(success),
        failure:  Util.defFailure(failure)
      });
    }, Util.defFailure(failure));
  };

  /**
   * Looks up the account associated with the specified email address.
   *
   * @example
   * Precog.lookupAccountId('jdoe@foo.com');
   */
  Precog.prototype.lookupAccountId = function(email, success, failure) {
    var self = this;

    Util.requireParam(email, 'email');

    return PrecogHttp.get({
      url:      self.accountsUrl("accounts/search"),
      content:  {email: email},
      success:  Util.defSuccessSingletonArray(success),
      failure:  Util.defFailure(failure)
    });
  };

  /**
   * Describes the specified account, identified by email and password.
   *
   * @example
   * Precog.describeAccount({email: 'jdoe@foo.com', password: 'abc123'});
   */
  Precog.prototype.describeAccount = function(account, success, failure) {
    var self = this;

    Util.requireField(account, 'email');
    Util.requireField(account, 'password');

    return self.lookupAccountId(account.email).then(function(accountId) {
      return PrecogHttp.get({
        basicAuth: {
          username: account.email,
          password: account.password
        },
        url:      self.accountsUrl("accounts/" + accountId),
        success:  Util.defSuccess(success),
        failure:  Util.defFailure(failure)
      });
    }, Util.defFailure(failure));
  };

  /**
   * Adds a grant to the specified account.
   *
   * @example
   * Precog.describeAccount(
   *   {accountId: '23987123', grantId: '0d43eece-7abb-43bd-8385-e33bac78e145'}
   * );
   */
  Precog.prototype.addGrantToAccount = function(info, success, failure) {
    var self = this;

    Util.requireField(info, 'accountId');
    Util.requireField(info, 'grantId');

    return PrecogHttp.post({
      url:      self.accountsUrl("accounts/" + info.accountId + "/grants/"),
      content:  {grantId: info.grant},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  /**
   * Retrieves the plan that the specified account is on. The account is 
   * identified by email and password.
   *
   * @example
   * Precog.currentPlan({email: 'jdoe@foo.com', password: 'abc123'});
   */
  Precog.prototype.currentPlan = function(account, success, failure) {
    var self = this;

    Util.requireField(account, 'email');
    Util.requireField(account, 'password');

    return self.lookupAccountId(account.email).then(function(accountId) {
      return PrecogHttp.get({
        basicAuth: {
          username: account.email,
          password: account.password
        },
        url:      self.accountsUrl("accounts/" + accountId + "/plan"),
        success:  Util.composef(Util.extractField('type'), Util.defSuccess(success)),
        failure:  Util.defFailure(failure)
      });
    }, Util.defFailure(failure));
  };

  /**
   * Changes the account's plan.
   *
   * @example
   * Precog.changePlan({email: 'jdoe@foo.com', password: 'abc123', plan: 'BRONZE'});
   */
  Precog.prototype.changePlan = function(account, success, failure) {
    var self = this;

    Util.requireField(account, 'email');
    Util.requireField(account, 'password');
    Util.requireField(account, 'plan');

    return self.lookupAccountId(account.email).then(function(accountId) {
      return PrecogHttp.put({
        basicAuth: {
          username: account.email,
          password: account.password
        },
        url:      self.accountsUrl("accounts/" + accountId + "/plan"),
        content:  {type: account.plan},
        success:  Util.defSuccess(success),
        failure:  Util.defFailure(failure)
      });
    }, Util.defFailure(failure));
  };

  /**
   * Delete's the account's plan, resetting it to the default plan on the system.
   *
   * @example
   * Precog.deletePlan({email: 'jdoe@foo.com', password: 'abc123'});
   */
  Precog.prototype.deletePlan = function(account, success, failure) {
    var self = this;

    Util.requireField(account, 'email');
    Util.requireField(account, 'password');

    return self.lookupAccountId(account.email).then(function(accountId) {
      return PrecogHttp.delete0({
        basicAuth: {
          username: account.email,
          password: account.password
        },
        url:      self.accountsUrl("accounts/" + accountId + "/plan"),
        success:  Util.defSuccess(success),
        failure:  Util.defFailure(failure)
      });
    }, Util.defFailure(failure));
  };

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
      url:      self.securityUrl("apikeys"),
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  /**
   * Creates a new API key with the specified grants.
   *
   * @example
   * Precog.createApiKey(grants);
   */
  Precog.prototype.createApiKey = function(grants, success, failure) {
    var self = this;

    Util.requireParam(grants, 'grants');
    self.requireConfig('apiKey');

    return PrecogHttp.post({
      url:      self.securityUrl("apikeys"),
      content:  grants,
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  /**
   * Describes an existing API key.
   *
   * @example
   * Precog.describeApiKey('475ae23d-f5f9-4ffc-b643-e805413d2233');
   */
  Precog.prototype.describeApiKey = function(apiKey, success, failure) {
    var self = this;

    self.requireConfig('apiKey');

    return PrecogHttp.get({
      url:      self.securityUrl("apikeys/" + apiKey),
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  /**
   * Deletes an existing API key.
   *
   * @example
   * Precog.deleteApiKey('475ae23d-f5f9-4ffc-b643-e805413d2233');
   */
  Precog.prototype.deleteApiKey = function(apiKey, success, failure) {
    var self = this;

    Util.requireParam(apiKey, 'apiKey');
    self.requireConfig('apiKey');

    return PrecogHttp.delete0({
      url:      self.securityUrl("apikeys/" + apiKey),
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  /**
   * Retrieves the grants associated with an existing API key.
   *
   * @example
   * Precog.retrieveApiKeyGrants('475ae23d-f5f9-4ffc-b643-e805413d2233');
   */
  Precog.prototype.retrieveApiKeyGrants = function(apiKey, success, failure) {
    var self = this;

    Util.requireParam(apiKey, 'apiKey');
    self.requireConfig('apiKey');

    return PrecogHttp.get({
      url:      self.securityUrl("apikeys/" + apiKey + "/grants/"),
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  /**
   * Adds a grant to an existing API key.
   *
   * @example
   * Precog.createApiKey({grant: grant, apiKey: apiKey});
   */
  Precog.prototype.addGrantToApiKey = function(info, success, failure) {
    var self = this;

    Util.requireField(info, 'grant');
    Util.requireField(info, 'apiKey');

    self.requireConfig('apiKey');

    return PrecogHttp.post({
      url:      self.securityUrl("apikeys/" + info.apiKey + "/grants/"),
      content:  info.grant,
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  /**
   * Removes a grant from an existing API key.
   *
   * @example
   * Precog.removeGrantFromApiKey({
   *   apiKey: '475ae23d-f5f9-4ffc-b643-e805413d2233', 
   *   grantId: '0b47db0d-ed14-4b56-831b-76b8bf66f976'
   * });
   */
  Precog.prototype.removeGrantFromApiKey = function(info, success, failure) {
    var self = this;

    Util.requireField(info, 'grantId');
    Util.requireField(info, 'apiKey');

    self.requireConfig('apiKey');

    return PrecogHttp.delete0({
      url:      self.securityUrl("apikeys/" + info.apiKey + "/grants/" + info.grantId),
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

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
  Precog.prototype.createGrant = function(grant, success, failure) {
    var self = this;

    Util.requireParam(grant, 'grant');

    self.requireConfig('apiKey');

    return PrecogHttp.post({
      url:      self.securityUrl("grants"),
      content:  grant,
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  /**
   * Describes an existing grant.
   *
   * @example
   * Precog.describeGrant('581c36a6-0e14-487e-8622-3a38b828b931');
   */
  Precog.prototype.describeGrant = function(grantId, success, failure) {
    var self = this;

    Util.requireParam(grantId, 'grantId');

    self.requireConfig('apiKey');

    return PrecogHttp.get({
      url:      self.securityUrl("grants/" + grantId),
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  /**
   * Deletes an existing grant. In order for this operation to succeed,
   * the grant must have been created by the authorizing API key.
   *
   * @example
   * Precog.deleteGrant('581c36a6-0e14-487e-8622-3a38b828b931');
   */
  Precog.prototype.deleteGrant = function(grantId, success, failure) {
    var self = this;

    Util.requireParam(grantId, 'grantId');

    self.requireConfig('apiKey');

    return PrecogHttp.delete0({
      url:      self.securityUrl("grants/" + grantId),
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  /**
   * Lists the children of an existing grant.
   *
   * @example
   * Precog.listGrantChildren('581c36a6-0e14-487e-8622-3a38b828b931');
   */
  Precog.prototype.listGrantChildren = function(grantId, success, failure) {
    var self = this;

    Util.requireParam(grantId, 'grantId');

    self.requireConfig('apiKey');

    return PrecogHttp.get({
      url:      self.securityUrl("grants/" + grantId + "/children/"),
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  /**
   * Lists the children of an existing grant.
   *
   * @example
   * Precog.createGrantChild({
   *   parentGrantId: '581c36a6-0e14-487e-8622-3a38b828b931', 
   *   childGrant: childGrant
   * });
   */
  Precog.prototype.createGrantChild = function(info, success, failure) {
    var self = this;

    Util.requireField(info, 'parentGrantId');
    Util.requireField(info, 'childGrant');

    self.requireConfig('apiKey');

    return PrecogHttp.post({
      url:      self.securityUrl("grants/" + info.parentGrantId + "/children/"),
      content:  info.childGrant,
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  // ****************
  // *** METADATA ***
  // ****************

  /**
   * Retrieves metadata for the specified path.
   *
   * @example
   * Precog.retrieveMetadata('/foo');
   */
  Precog.prototype.retrieveMetadata = function(path, success, failure) {
    var self = this;

    Util.requireParam(path, 'path');

    self.requireConfig('apiKey');

    return PrecogHttp.get({
      url:      self.metadataUrl("fs/" + path),
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  /**
   * Retrieves all children of the specified path.
   *
   * @example
   * Precog.listChildren('/foo');
   */
  Precog.prototype.listChildren = function(path, success, failure) {
    var success1 = function(metadata) {
      return metadata.children;
    };

    return this.retrieveMetadata(path).then(success1).then(
        Util.safeCallback(success), Util.safeCallback(failure));
  };

  /**
   * Retrieves all descendants of the specified path.
   *
   * @example
   * Precog.listDescendants('/foo');
   */
  Precog.prototype.listDescendants = function(path, success, failure) {
    var listDescendants0 = function(root) {
      this.listChildren(root).then(function(children) {
        var futures = Util.amap(children, function(child) {
          var fullPath = root + '/' + child;

          return listDescendants0(fullPath);
        });

        return Future.every(futures).then(function(arrays) {
          var merged = [];
          merged.concat.apply(merged, arrays);
          return merged;
        });
      });
    };

    return listDescendants0(path).then(Util.safeCallback(success), Util.safeCallback(failure));
  };

  // ************
  // *** DATA ***
  // ************

  /**
   * Uploads the specified contents to the specified path, using the specified
   * file type (which must be a mime-type accepted by the server).
   *
   * @example
   * Precog.uploadFile({path: '/foo/bar.csv', Precog.FileTypes.CSV, contents: contents});
   */
  Precog.prototype.uploadFile = function(info, success, failure) {
    var self = this;

    Util.requireField(info, 'path');
    Util.requireField(info, 'format');
    Util.requireField(info, 'contents');

    self.requireConfig('apiKey');

    var targetDir  = Util.parentPath(info.path);
    var targetName = Util.lastPathElement(info.path);

    if (targetName === '') Util.error('A file may only be uploaded to a specific directory');

    var fullPath = targetDir + '/' + targetName;

    var handle = function(_) {
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
      });
    };

    return self.delete0(fullPath).
            then(handle)["catch"](handle). // We don't care if the delete failed
            then(Util.safeCallback(success), Util.safeCallback(failure));
  };

  /**
   * Creates the specified file. The file must not already exist.
   *
   * @example
   * Precog.createFile({path: '/foo/bar.csv', type: Precog.FileTypes.CSV, contents: contents});
   */
  Precog.prototype.createFile = function(info, success, failure) {
    var self = this;

    Util.requireField(info, 'path');
    Util.requireField(info, 'type');
    Util.requireFiled(info, 'contents');

    var targetDir  = Util.parentPath(info.path);
    var targetName = Util.lastPathElement(info.path);

    if (targetName === '') Util.error('To replace a file, the file name must be specified');

    return self.listChildren(targetDir).then(function(children) {
      if (!Util.acontains(children, targetName)) {
        return self.uploadFile(info);
      } else Util.error('The file ' + targetName + ' already exists in the directory ' + targetDir);
    }).then(Util.safeCallback(success), Util.safeCallback(failure));
  };

  /**
   * Retrieves the contents of the specified file.
   *
   * @example
   * Precog.retrieveFile('/foo/bar.qrl');
   */
  Precog.prototype.retrieveFile = function(info, success, failure) {
  };

  /**
   * Appends a JSON value to the specified file.
   *
   * @example
   * Precog.append({path: '/website/clicks.json', value: clickEvent});
   */
  Precog.prototype.append = function(info, success, failure) {
    info.values = [info.value];

    delete info.value;

    return this.appendAll(info, success, failure);
  };

  /**
   * Appends a collection of JSON values to the specified file.
   *
   * @example
   * Precog.append({path: '/website/clicks.json', values: clickEvents});
   */
  Precog.prototype.appendAll = function(info, success, failure) {
    var self = this;

    Util.requireField(info, 'value');
    Util.requireField(info, 'path');

    self.requireConfig('apiKey');

    var targetDir  = Util.parentPath(info.path);
    var targetName = Util.lastPathElement(info.path);

    if (targetName === '') Util.error('Data must be appended to a specific file.');

    var fullPath = targetDir + '/' + targetName;

    return PrecogHttp.post({
      url:      self.dataUrl((info.async ? "async" : "sync") + "/fs/" + fullPath),
      content:  info.values,
      query:    {
                  apiKey:         self.config.apiKey,
                  ownerAccountId: info.ownerAccountId
                },
      headers:  { 'Content-Type': 'application/json' },
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  /**
   * Deletes a specified file in the Precog file system.
   *
   * @example
   * Precog.delete0('/website/clicks.json');
   */
  Precog.prototype.delete0 = function(path, success, failure) {
    var self = this;

    Util.requireParam(path, 'path');

    self.requireConfig('apiKey');

    return PrecogHttp.delete0({
      url:      self.dataUrl("async/fs/" + info.path),
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  /**
   * Deletes the specified directory and everything it contains.
   *
   * @example
   * Precog.deleteAll('/website/');
   */
  Precog.prototype.deleteAll = function(path, success, failure) {
    var self = this;

    Util.requireParam(path, 'path');

    return this.listDescendants(path).then(function(children0) {
      var children = children0.concat([path]);

      var futures = Util.amap(children, self.delete0);

      return Future.every(futures);
    }).then(Util.safeCallback(success), Util.safeCallback(failure));
  };

  // ****************
  // *** ANALYSIS ***
  // ****************

  /**
   * Executes the specified file, which must be a Quirrel script.
   *
   * @example
   * Precog.executeFile('/foo/script.qrl');
   */
  Precog.prototype.executeFile = function(path, success, failure) {
    var self = this;

    Util.requireParam(path, 'path');

    self.retrieveFile(path).then(function(file) {
      if (file.type === 'text/x-quirrel-script') {
        return self.execute(file.contents);
      } else Util.error('The file ' + path + 
                        ' does not have type text/x-quirrel-script and therefore cannot be executed');
    }).then(Util.safeCallback(success), Util.safeCallback(failure));
  };

  /**
   * Executes the specified Quirrel query.
   *
   * @example
   * Precog.execute({query: 'count(//foo)'});
   */
  Precog.prototype.execute = function(info, success, failure) {
    var self = this;

    Util.requireField(info, 'query');

    self.requireConfig('apiKey');

    return PrecogHttp.get({
      url:      self.analysisUrl("fs/" + info.path),
      query:    {
                  apiKey: self.config.apiKey, 
                  q:      info.query,
                  limit:  info.limit,
                  skip:   info.skip,
                  sortOn: info.sortOn
                },
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  Precog.prototype.asyncQuery = function(info, success, failure ) {
    var self = this;

    Util.requireField(info, 'query');

    return PrecogHttp.post({
      url:      Util.analysisUrl("queries"),
      query:    {
                  apiKey     : self.config.apiKey,
                  limit      : info.limit,
                  basePath   : info.basePath,
                  skip       : info.skip,
                  order      : info.order,
                  sortOn     : info.sortOn,
                  sortOrder  : info.sortOrder,
                  timeout    : info.timeout,
                  prefixPath : info.prefixPath,
                  format     : info.format
                },
      content:  info.query,
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  Precog.prototype.asyncQueryResults = function(info, success, failure) {
    var self = this;

    Util.requireField(info, 'jobId');

    return PrecogHttp.get({
      url:      self.analysisUrl("queries") + '/' + info.jobId,
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

})(Precog);
