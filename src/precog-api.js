
var Precog = function(config) {
  this.config = config;
}

(function(Precog) {
  Precog.GrantTypes = {
    Append:   "append",
    Replace:  "replace",
    Execute:  "execute",
    Mount:    "mount",
    Create:   "create",
    Explore:  "explore"
  };

  var Util = {};

  Util.error = function(msg) {
    if (typeof console != 'undefined') console.error(msg);
    throw new Error(msg);
  };
  Util.requireParam = function(v, name) {
    if (v == null) Util.error('The parameter "' + name + '" may not be null or undefined');
  };
  Util.requireField = function(v, name) {
    if (v[name] == null) Util.error('The field "' + name + '" may not be null or undefined');
  };
  Util.removeTrailingSlash = function(path) {
    if (path == null || path.length === 0) return path;
    else if (path.substr(path.length - 1) == "/") return path.substr(0, path.length - 1);
    else return path;
  };
  Util.sanitizePath = function(path) {
    return (path + "/").replace(/[\/]+/g, "/");
  };
  Util.composef = function(f, g) {
    if (f == null || g == null) return undefined;

    return function(v) {
      return f(g(v));
    };
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

    self.lookupAccountId(email, function(accountId) {
      PrecogHttp.post({
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

    self.lookupAccountId(account.email, function(accountId) {
      PrecogHttp.get({
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

    self.lookupAccountId(account.email, function(accountId) {
      PrecogHttp.get({
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

    self.lookupAccountId(account.email, function(accountId) {
      PrecogHttp.put({
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

    self.lookupAccountId(account.email, function(accountId) {
      PrecogHttp.delete0({
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

  Precog.prototype.createKey = function(grants, success, failure) {
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

  Precog.prototype.describeKey = function(apiKey, success, failure) {
    var self = this;

    self.requireConfig('apiKey');

    return PrecogHttp.get({
      url:      self.securityUrl("apikeys") + "/" + apiKey,
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  Precog.prototype.deleteKey = function(apiKey, success, failure) {
    var self = this;

    Util.requireParam(apiKey, 'apiKey');
    self.requireConfig('apiKey');

    return PrecogHttp.delete0({
      url:      self.securityUrl("apikeys") + "/" + apiKey,
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  Precog.prototype.retrieveGrants = function(apiKey, success, failure) {
    var self = this;

    Util.requireParam(apiKey, 'apiKey');
    self.requireConfig('apiKey');

    return PrecogHttp.get({
      url:      self.securityUrl("apikeys") + "/" + apiKey + "/grants/",
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  Precog.prototype.addGrantToKey = function(info, success, failure) {
    var self = this;

    Util.requireField(info, 'grant');
    Util.requireField(info, 'apiKey');

    self.requireConfig('apiKey');

    return PrecogHttp.post({
      url:      self.securityUrl("apikeys") + "/" + info.apiKey + "/grants/",
      content:  info.grant,
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  Precog.prototype.removeGrant = function(info, success, failure) {
    var self = this;

    Util.requireField(info, 'grantId');
    Util.requireField(info, 'apiKey');

    self.requireConfig('apiKey');

    return PrecogHttp.delete0({
      url:      self.securityUrl("apikeys") + "/" + info.apiKey + "/grants/" + info.grantId,
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

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

  Precog.prototype.describeGrant = function(grantId, success, failure) {
    var self = this;

    Util.requireParam(grantId, 'grantId');

    self.requireConfig('apiKey');

    return PrecogHttp.get({
      url:      self.securityUrl("grants") + "/" + grantId,
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  Precog.prototype.deleteGrant = function(grantId, success, failure) {
    var self = this;

    Util.requireParam(grantId, 'grantId');

    self.requireConfig('apiKey');

    return PrecogHttp.delete0({
      url:      self.securityUrl("grants") + "/" + grantId,
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  Precog.prototype.listGrantChildren = function(grantId, success, failure) {
    var self = this;

    Util.requireParam(grantId, 'grantId');

    self.requireConfig('apiKey');

    return PrecogHttp.get({
      url:      self.securityUrl("grants") + "/" + grantId + "/children/",
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  Precog.prototype.createGrantChild = function(info, success, failure) {
    var self = this;

    Util.requireField(info, 'parentGrantId');
    Util.requireField(info, 'childGrant');

    self.requireConfig('apiKey');

    return PrecogHttp.post({
      url:      self.securityUrl("grants") + "/" + info.parentGrantId + "/children/",
      content:  info.childGrant,
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  // ****************
  // *** METADATA ***
  // ****************
  Precog.prototype.retrieveMetadata = function(path, success, failure) {
    var self = this;

    Util.requireParam(path, 'path');

    self.requireConfig('apiKey');

    return PrecogHttp.get({
      url:      self.metadataUrl("fs") + "/" + path,
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  // ************
  // *** DATA ***
  // ************


  // ****************
  // *** ANALYSIS ***
  // ****************

})(Precog);
