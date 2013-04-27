nodeunit = typeof nodeunit == 'undefined' ? require('nodeunit') : nodeunit;
Precog = typeof Precog == 'undefined' ? require('..') : Precog;

var state = {};

var analyticsService = 'https://devapi.precog.com';

var user = {
  email: 'jstest' + new Date().valueOf() + '@precog.com',
  password: Math.random().toString()
};

var anonApi = new Precog.api({analyticsService: analyticsService});

var grantName = 'testgrant';
var childGrantName = 'testchildgrant';
var uploadPathRoot;
var originalUploadPath;
var uploadPath;

var account$ = anonApi.createAccount(user, function(account) {
  uploadPathRoot = '/' + account.accountId;
  originalUploadPath = uploadPathRoot + '/' + 'original';
  uploadPath = uploadPathRoot + '/' + 'test';
  return anonApi.describeAccount(user);
});

var api$ = account$.then(function(account) {
  return new Precog.api({
    analyticsService: analyticsService,
    apiKey: account.apiKey
  });
});

function retry(count, f) {
  function appendToAssertions(name, assertions) {
    return function(actual, expected, message) {
      assertions.push({
        method: name,
        actual: actual,
        expected: expected,
        message: message
      });
    };
  }

  function facade(test, assertions) {
    var obj = {};
    var name;

    for(name in nodeunit.assert) {
      obj[name] = appendToAssertions(name, assertions);
    }

    obj.done = function() {
      var failed = false;
      var i;
      var assertion;

      for(i = 0; i < assertions.length; i++) {
        assertion = assertions[i];
        try {
          nodeunit.assert[assertion.method](assertion.actual, assertion.expected, assertion.message);
        } catch(e) {
          failed = true;
          break;
        }
      }

      if(failed) {
        setTimeout(function() {
          retry(count - 1, f)(test);
        }, 250);
        return;
      }

      for(i = 0; i < assertions.length; i++) {
        assertion = assertions[i];
        test[assertion.method](assertion.actual, assertion.expected, assertion.message);
      }

      test.done();
    };

    return obj;
  }

  return function(test) {
    f(count ? facade(test, []) : test);
  };
}

var failure = function(test) {
  return function(results) {
    test.ok(false, 'Unexpected failure: ' + JSON.stringify(test));
    test.done();
  };
};

var testApi = {
  'describe bad account': function(test) {
    anonApi.currentPlan({email: 'no$@"nanemail!!!xyz+a', password: '+'}, function() {
      test.ok(false, 'Bad email and password should not trigger a valid HTTP response');
      test.done();
    }, function(error) {
      test.ok(true, 'Bad email and password should return an error HTTP response');
      test.done();
    });
  },
  'describe account': function(test) {
    account$.then(function(account) {
      test.equal(account.email, user.email, 'Email returned from describeAccount is same');
      test.done();
    }, failure(test));
  },
  'current plan': function(test) {
    account$.then(function() {
      anonApi.currentPlan(user, function(plan) {
        test.equal(plan, 'Free', 'Created plan should be Free');
        test.done();
      }, failure(test));
    }, failure(test));
  },
  'change plan': function(test) {
    account$.then(function(account) {
      anonApi.changePlan({email: user.email, password: user.password, plan: 'bronze'}, function(response) {
        test.ok(true, 'Change plan should return non-error HTTP code');

        test.done();
      }, failure(test));
    }, failure(test));
  },
  'delete plan': function(test) {
    anonApi.deletePlan(user, function(plan) {
      test.equal(plan, 'bronze', 'Deleted plan should be bronze');
      test.done();
    }, failure(test));
  },
  'describe API key': function(test) {
    var description$ = account$.then(function(account) {
      return api$.then(function(api) {
        return api.describeApiKey(account.apiKey);
      }, failure(test));
    }, failure(test));

    Vow.all([description$, account$]).then(function(results) {
      test.equal(results[0].apiKey, results[1].apiKey, 'Returned API key should match account');
      test.done();
    }, failure(test));
  },
  'create API key': function(test) {
    api$.then(function(api) {
      api.createApiKey({
        grants: []
      }).then(function(created) {
        state.created = created;
        test.deepEqual(created.grants, [], 'Grants must be empty');
        test.notEqual(created.apiKey, undefined, 'apiKey must be defined');
        test.done();
      }, failure(test));
    });
  },
  'list API keys': function(test) {
    api$.then(function(api) {
      api.listApiKeys(function(list) {
        test.equal(list.length, 1, 'One API key must have been created');
        test.equal(state.created.apiKey, list[0].apiKey, 'Listed key must be API key that was just created');
        test.done();
      }, failure(test));
    }, failure(test));
  },
  'delete API key': function(test) {
    api$.then(function(api) {
      api.deleteApiKey(state.created.apiKey).then(function(result) {
        test.ok(true, 'Delete API key should return non-error HTTP code');
        test.done();
      }, failure(test));
    }, failure(test));
  },
  'list API key grants': function(test) {
    account$.then(function(account) {
      api$.then(function(api) {
        return api.retrieveApiKeyGrants(account.apiKey);
      }).then(function(grants) {
        test.equal(grants.length, 1, 'Must be one grant');
        test.notEqual(grants[0].grantId, undefined, 'grantId must be defined');
        test.done();
      }, failure(test));
    }, failure(test));
  },
  'upload file': function(test) {
    account$.then(function(account) {
      api$.then(function(api) {
        return api.uploadFile({
          path: originalUploadPath,
          contents: '{"name": "John", "email": "john@precog.com"}\n{"name": "Brian", "email": "brian@precog.com"}',
          type: 'application/json'
        }, function(report) {
          test.deepEqual(report.errors, [], 'No errors should be returned');
          test.equal(report.failed, 0, 'None should fail');
          test.equal(report.skipped, 0, 'None should be skipped');
          test.equal(report.total, 2, 'Should have uploaded two items');
          test.equal(report.ingested, 2, 'Should have ingested two items');
          test.notEqual(report.ingestId, undefined, 'Should have an ingest ID');
          test.done();
        }, failure(test));
      }, failure(test));
    }, failure(test));
  },
  'move file': function(test) {
    api$.then(function(api) {
      api.moveFile({
        source: originalUploadPath,
        dest: uploadPath
      }, function() {
        test.ok(true, 'Move file should return non-error HTTP code');
        test.done();
      }, function() {
        test.ok(false, 'Move file should not return an invalid HTTP code');
        test.done();
      });
    });
  },
  'listing children': retry(10, function(test) {
    api$.then(function(api) {
      api.listChildren(uploadPathRoot, function(children) {
        console.log('CHILDREN:::::');
        console.log(children);

        test.equal(children.length, 1, 'Children must have size');
        test.equal(children[0], 'test/', 'Child must equal uploaded file');
        test.done();
      }, failure(test));
    }, failure(test));
  }),
  'metadata': function(test) {
    api$.then(function(api) {
      api._retrieveMetadata(uploadPath, function(metadata) {
        test.notEqual(metadata.size, undefined, 'Metadata must have size');
        test.notEqual(metadata.children, undefined, 'Metadata must have children');
        test.notEqual(metadata.structure, undefined, 'Metadata must have structure');
        test.done();
      }, failure(test));
    }, failure(test));
  },
  'delete path': function(test) {
    api$.then(function(api) {
      api.delete0(uploadPath, function(deleted) {
        test.ok(true, 'Delete path should return non-error HTTP code');
        test.done();
      }, failure(test));
    }, failure(test));
  },
  'create descendents': function(test) {
    api$.then(function(api) {
      // Create a nested directory of files
      var vows = [];
      for(var i = 0; i < 10; i++) {
        vows.push(api.uploadFile({
          path: uploadPathRoot + '/' + i + '/' + i,
          contents: '{"a": ' + i + '}',
          type: 'application/json'
        }));
      }
      return Vow.all(vows).then(function() {
        return test.done();
      });
    }, failure(test));
  },
  'list descendents': retry(10, function(test) {
    api$.then(function(api) {
      api.listDescendants(uploadPathRoot, function(descendents) {
        test.equal(descendents.length, 20, 'Descendents must have size');
        test.done();
      }, failure(test));
    }, failure(test));
  }),
  'delete directory': function(test) {
    api$.then(function(api) {
      console.log('Deleting: ' + uploadPathRoot + '/0');

      api.deleteAll(uploadPathRoot + '/0', function() {
        api.listDescendants(uploadPathRoot, function(descendents) {
          test.equal(descendents.length, 18, 'Descendents must have smaller size');
          test.done();
        }, failure(test));
      }, failure(test));
    }, failure(test));
  },
  'execute simple': function(test) {
    api$.then(function(api) {
      return api.execute({
        path: "",
        query: "1 + 2"
      });
    }).then(function(results) {
      test.deepEqual(results, [3], '1 + 2 should return 3');
      test.done();
    }, failure(test));
  },
  'query async': function(test) {
    account$.then(function(account) {
      api$.then(function(api) {
        api.asyncQuery({
          query: "1 + 2"
        }, function(query) {
          state.query = query;
          test.notEqual(query.jobId, undefined, 'jobId must be defined');
          test.done();
        }, failure(test));
      }, failure(test));
    }, failure(test));
  },
  'async results': retry(10, function(test) {
    api$.then(function(api) {
      api.asyncQueryResults(state.query.jobId, function(results) {
        test.equal(results.errors.length, 0, 'Errors must be empty');
        test.equal(results.warnings.length, 0, 'Warnings must be empty');
        test.deepEqual(results.data, [3], 'Data must only contain three');
        test.done();
      }, failure(test));
    }, failure(test));
  }),
  'create grant': function(test) {
    account$.then(function(account) {
      api$.then(function(api) {
        api.createGrant({
          name: grantName,
          description: 'Test grant',
          permissions: [{
            accessType: "read",
            path: "/test",
            ownerAccountIds: [account.accountId]
          }]
        }, function(grant) {
          state.grant = grant;
          test.equal(grant.name, grantName, 'Returned grant should have correct name');
          test.done();
        }, failure(test));
      }, failure(test));
    }, failure(test));
  },
  'add grant to API key': function(test) {
    account$.then(function(account) {
      api$.then(function(api) {
        api.addGrantToApiKey({
          grant: state.grant,
          apiKey: account.apiKey
        }, function(added) {
          test.ok(true, 'Adding grant to API key must return non-error HTTP code');
          test.done();
        }, failure(test));
      }, failure(test));
    }, failure(test));
  },
  'create grant child': function(test) {
    account$.then(function(account) {
      api$.then(function(api) {
        api.createGrantChild({
          parentGrantId: state.grant.grantId,
          childGrant: {
            name: childGrantName,
            description: 'Test child grant',
            permissions: [{
              accessType: "read",
              path: "/test/child",
              ownerAccountIds: [account.accountId]
            }]
          }
        }, function(childGrant) {
          state.childGrant = childGrant;
          test.notEqual(childGrant.grantId, undefined, 'grantId must be defined');
          test.done();
        }, failure(test));
      }, failure(test));
    }, failure(test));
  },
  'list grant children': function(test) {
    api$.then(function(api) {
      api.listGrantChildren(state.grant.grantId, function(children) {
        test.equal(children.length, 1, 'Grant must have one child');
        test.equal(children[0].grantId, state.childGrant.grantId, 'Listed child grantId must be created child grantId');
        test.done();
      }, failure(test));
    }, failure(test));
  },
  'remove grant from API key': function(test) {
    account$.then(function(account) {
      api$.then(function(api) {
        api.removeGrantFromApiKey({
          grantId: state.grant.grantId,
          apiKey: account.apiKey
        }, function(removed) {
          test.ok(true, 'Remove grant from API key must return non-error HTTP code');
          test.done();
        }, failure(test));
      }, failure(test));
    }, failure(test));
  },
  'add grant to account': function(test) {
    account$.then(function(account) {
      api$.then(function(api) {
        api.addGrantToAccount({
          grantId: state.grant.grantId,
          accountId: account.accountId
        }, function(added) {
          test.ok(true, 'Adding grant to account must return non-error HTTP code');
          test.done();
        }, failure(test));
      }, failure(test));
    }, failure(test));
  },
  'describe grant': function(test) {
    api$.then(function(api) {
      api.describeGrant(state.grant.grantId, function(grant) {
        test.equal(grant.name, grantName, 'Described grant name should be original name');
        test.done();
      }, failure(test));
    }, failure(test));
  },
  'delete grant': function(test) {
    api$.then(function(api) {
      api.deleteGrant(state.grant.grantId, function(deleted) {
        test.ok(true, 'Delete grant must return non-error HTTP code');
        test.done();
      }, failure(test));
    }, failure(test));
  }
};

if(typeof module == 'object') module.exports = testApi;

// Not tested:

// requestPasswordReset
