
var Precog = {};

(function(Precog) {
  Precog.GrantTypes = {
    Append:   "append",
    Replace:  "replace",
    Execute:  "execute",
    Mount:    "mount",
    Create:   "create",
    Explore:  "explore"
  };

  function error(msg) {
    if (typeof console != 'undefined') {
      console.error(msg);
    }
    throw new Error(msg);
  }

  /**
   * Creates a new account with the specified email and password. In order for 
   * this function to succeed, there must exist no account with the specified
   * email.
   *
   * @example
   * Precog.createAccount({email: "jdoe@foo.com", password: "abc123"});
   */
  Precog.createAccount = function(account, success, failure, options) {
    if (account.email == null) error("Email must be specified for account creation");
    if (account.password == null) error("Password must be specified for account creation");

    http.post(
      Util.actionUrl("accounts","accounts", options),
      account,
      Util.createCallbacks(success, failure, description),
      null
    );
  };

  Precog.requestResetPassword = function(email, success, failure, options) {
    Precog.findAccount(email, function(accountId) {
      http.post(
        Util.actionUrl("accounts","accounts", options) + accountId + "/password/reset",
        { "email" : email },
        Util.createCallbacks(success, failure, description),
        null
      );
    }, failure);
  };

  Precog.lookupAccountId = function(email, success, failure, options) {
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

  Precog.describeAccount = function(email, password, accountId, success, failure, options) {
    http.get(
      Util.actionUrl("accounts", "accounts",options) + accountId,
      Util.createCallbacks(success, failure, description),
      null,
      { "Authorization" : Util.makeBaseAuth(email, password) }
    );
  };

})(Precog);