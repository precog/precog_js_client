
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
    JSON:        'application/json',
    JSON_STREAM: 'application/x-json-stream',
    CSV:         'text/csv',
    ZIP:         'application/zip',
    GZIP:        'application/x-gzip'
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

  // ************
  // *** DATA ***
  // ************
  Precog.prototype.uploadFile = function(info, success, failure) {
    var self = this;

    Util.requireField(info, 'dest');
    Util.requireField(info, 'format');
    Util.requireField(info, 'contents');

    self.requireConfig('apiKey');

    var targetDir  = Util.parentPath(info.dest);
    var targetName = Util.lastPathElement(info.dest);

    if (targetName === '') Util.error('A file may only be uploaded to a specific directory');

    var fullPath = Util.sanitizePath(targetDir + '/' + targetName);

    return self.delete0(fullPath).then(function(_) {
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
        headers:  { 'Content-Type': info.type },
        success:  Util.defSuccess(success),
        failure:  Util.defFailure(failure)
      });
    }, Util.defFailure(failure));
  };

  Precog.prototype.ingest = function(info, success, failure) {
    var self = this;

    Util.requireField(info, 'path');
    Util.requireField(info, 'data');
    Util.requireField(info, 'type');

    self.requireConfig('apiKey');

    switch(info.type.toLowerCase()) {
    case 'application/x-gzip':
    case 'gz':
    case 'gzip':
      info.type = 'application/x-gzip';
      break;
    case 'zip':
      info.type = 'application/zip';
      break;
    case 'application/json':
    case 'json':
      info.type = 'application/json';
      break;
    case 'text/csv':
    case 'csv':
      info.type = 'text/csv';
      break;
    default:
      Util.error("The field 'type' must be in ['json', 'csv', 'zip', 'gzip']");
    }

    return PrecogHttp.post({
      url:      self.dataUrl((info.async ? "async" : "sync") + "/fs/" + info.path),
      content:  info.data,
      query:    {
                  apiKey:         self.config.apiKey,
                  ownerAccountId: info.ownerAccountId,
                  delimiter:      info.delimiter,
                  quote:          info.quote,
                  escape:         info.escape
                },
      headers:  { 'Content-Type': info.type },
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

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

  // ****************
  // *** ANALYSIS ***
  // ****************
  Precog.prototype.query = function(info, success, failure) {
    var self = this;

    Util.requireField(info, 'path');
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
