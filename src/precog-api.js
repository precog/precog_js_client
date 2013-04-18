
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

  /**
   * Creates a new account with the specified email and password. In order for 
   * this function to succeed, there must exist no account with the specified
   * email.
   *
   * @example
   * Precog.createAccount({email: "jdoe@foo.com", password: "abc123"});
   */
  Precog.prototype.createAccount = function(account, success, failure, options) {
    Util.requireField(account, 'email');
    Util.requireField(account, 'password');

    PrecogHttp.post({
      url:      serviceUrl("accounts", 1, "accounts"),
      content:  account,
      success:  success,
      failure:  failure
    });
  };

  Precog.prototype.requestResetPassword = function(email, success, failure, options) {
    Precog.findAccount(email, function(accountId) {
      http.post(
        Util.actionUrl("accounts","accounts", options) + accountId + "/password/reset",
        { "email" : email },
        Util.createCallbacks(success, failure, description),
        null
      );
    }, failure);
  };

  Precog.prototype.lookupAccountId = function(email, success, failure, options) {
    http.get(
      Util.actionUrl("accounts","accounts", options) + "search",
      Util.createCallbacks(
        function(data) {
          try {
            success(data instanceof Array ? data[0].accountId : data.accountId);
          } catch(e) {
            failure(e);
          }
        },
        failure,
        description
      ),
      { "email" : email }
    );
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