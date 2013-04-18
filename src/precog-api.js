
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
  Util.composef = function(f, f0) {
    return function(v) {
      return f(f0(v));
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
   * this function to succeed, there must exist no account with the specified
   * email.
   *
   * @example
   * Precog.createAccount({email: "jdoe@foo.com", password: "abc123"});
   */
  Precog.prototype.createAccount = function(account, success, failure) {
    var self = this;

    Util.requireField(account, 'email');
    Util.requireField(account, 'password');

    PrecogHttp.post({
      url:      self.accountsUrl("accounts"),
      content:  account,
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  Precog.prototype.requestResetPassword = function(email, success, failure) {
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

  Precog.prototype.lookupAccountId = function(email, success, failure) {
    var self = this;

    Util.requireParam(email, 'email');

    PrecogHttp.get({
      url:      self.accountsUrl("accounts/search"),
      content:  {email: email},
      success:  Util.defSuccessSingletonArray(success),
      failure:  Util.defFailure(failure)
    });
  };

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

  Precog.prototype.addGrantToAccount = function(info, success, failure) {
    var self = this;

    Util.requireField(info, 'accountId');
    Util.requireField(info, 'grantId');

    PrecogHttp.post({
      url:      self.accountsUrl("accounts/" + info.accountId + "/grants/"),
      content:  {grantId: info.grant},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

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
  Precog.prototype.listKeys = function(success, failure) {
    var self = this;

    self.requireConfig('apiKey');

    PrecogHttp.get({
      url:      self.securityUrl("apikeys"),
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  Precog.prototype.createKey = function(grants, success, failure, options) {
    var self = this;

    Util.requireParam(grants, 'grants');
    self.requireConfig('apiKey');

    PrecogHttp.post({
      url:      self.securityUrl("apikeys"),
      content:  grants,
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  Precog.prototype.describeKey = function(apiKey, success, failure, options) {
    var self = this;

    self.requireConfig('apiKey');

    PrecogHttp.get({
      url:      self.securityUrl("apikeys") + "/" + apiKey,
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  Precog.prototype.deleteKey = function(apiKey, success, failure, options) {
    var self = this;

    Util.requireParam(apiKey, 'apiKey');
    self.requireConfig('apiKey');

    PrecogHttp.delete0({
      url:      self.securityUrl("apikeys") + "/" + apiKey,
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  Precog.prototype.retrieveGrants = function(apiKey, success, failure, options) {
    var self = this;

    Util.requireParam(apiKey, 'apiKey');
    self.requireConfig('apiKey');

    PrecogHttp.get({
      url:      self.securityUrl("apikeys") + "/" + apiKey + "/grants/",
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  Precog.prototype.addGrantToKey = function(info, success, failure, options) {
    var self = this;

    Util.requireField(info, 'grant');
    Util.requireField(info, 'apiKey');

    self.requireConfig('apiKey');

    PrecogHttp.post({
      url:      self.securityUrl("apikeys") + "/" + info.apiKey + "/grants/",
      content:  info.grant,
      query:    {apiKey: self.config.apiKey},
      success:  Util.defSuccess(success),
      failure:  Util.defFailure(failure)
    });
  };

  Precog.prototype.removeGrant = function(apiKey, grantId, success, failure, options) {
    var description = 'Remove grant '+grantId+' from key ' + apiKey,
        parameters = { apiKey: (options && options.apiKey) || $.Config.apiKey };

    if(!parameters.apiKey) throw Error("apiKey not specified");
    http.remove(
      Util.actionUrl("security", "apikeys", options) + apiKey + "/grants/" + grantId,
      Util.createCallbacks(success, failure, description),
      parameters
    );
  };

  Precog.prototype.createGrant = function(grant, success, failure, options) {
    var description = 'Create new grant '+JSON.stringify(grant),
        parameters = { apiKey: (options && options.apiKey) || $.Config.apiKey };

    if(!parameters.apiKey) throw Error("apiKey not specified");
    http.post(
      Util.actionUrl("security", "grants", options),
      grant,
      Util.createCallbacks(success, failure, description),
      parameters
    );
  };

  Precog.prototype.describeGrant = function(grantId, success, failure, options) {
    var description = 'Describe grant ' + grantId,
        parameters = { apiKey: (options && options.apiKey) || $.Config.apiKey };

    if(!parameters.apiKey) throw Error("apiKey not specified");
    http.get(
      Util.actionUrl("security", "grants", options) + grantId,
      Util.createCallbacks(success, failure, description),
      parameters
    );
  };

  Precog.prototype.deleteGrant = function(grantId, success, failure, options) {
    var description = 'Delete grant ' + grantId,
        parameters = { apiKey: (options && options.apiKey) || $.Config.apiKey };

    if(!parameters.apiKey) throw Error("apiKey not specified");
    http.remove(
      Util.actionUrl("security", "grants", options) + grantId,
      Util.createCallbacks(success, failure, description),
      parameters
    );
  };

  Precog.prototype.listGrantChildren = function(grantId, success, failure, options) {
    var description = 'List children grant ' + grantId,
        parameters = { apiKey: (options && options.apiKey) || $.Config.apiKey };

    if(!parameters.apiKey) throw Error("apiKey not specified");
    http.get(
      Util.actionUrl("security", "grants", options) + grantId + "/children/",
      Util.createCallbacks(success, failure, description),
      parameters
    );
  };

  Precog.prototype.createGrantChild = function(grantId, child, success, failure, options) {
    var description = 'Create child grant '+JSON.stringify(child)+" for "+grantId,
        parameters = { apiKey: (options && options.apiKey) || $.Config.apiKey };

    if(!parameters.apiKey) throw Error("apiKey not specified");
    http.post(
      Util.actionUrl("security", "grants", options)+grantId+"/children/",
      child,
      Util.createCallbacks(success, failure, description),
      parameters
    );
  };

})(Precog);