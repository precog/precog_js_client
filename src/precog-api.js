
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
      success:  success,
      failure:  failure
    });
  };

  Precog.prototype.requestResetPassword = function(email, success, failure) {
    var self = this;

    self.lookupAccountId(email, function(accountId) {
      PrecogHttp.post({
        url:      self.accountsUrl("accounts/" + accountId + "/password/reset"),
        content:  {email: email},
        success:  success
      });
    }, failure);
  };

  Precog.prototype.lookupAccountId = function(email, success, failure) {
    var self = this;

    PrecogHttp.get({
      url:      self.accountsUrl("accounts/search"),
      content:  {email: email},
      success:  function(result) {
        var accountId = (result.content instanceof Array) ? result.content[0] : result.content;

        success(accountId);
      },
      failure:  failure
    });
  };

  Precog.prototype.describeAccount = function(email, password, accountId, success, failure, options) {
    http.get(
      Util.actionUrl("accounts", "accounts",options) + accountId,
      Util.createCallbacks(success, failure, description),
      null,
      { "Authorization" : Util.makeBaseAuth(email, password) }
    );
  };

})(Precog);