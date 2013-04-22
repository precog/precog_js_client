var analyticsService = 'https://devapi.precog.com';

var user = {
  email: 'dotnettest' + new Date().valueOf() + '@precog.com',
  password: Math.random().toString()
};

var anonApi = new Precog.api({analyticsService: analyticsService});

var account$ = anonApi.createAccount(user, function(account) {
  return anonApi.describeAccount(user);
});

QUnit.asyncTest("describe account", 1, function(test) {
  account$.then(function(account) {
    test.equal(account.email, user.email, 'Email returned from describeAccount is same');
  });
});

/*
asyncTest("current plan", 1, function() {
  anonApi.currentPlan(user, function(plan) {
    equal(plan.type, 'Free', 'Created plan should be Free');
    start();
  });
});

asyncTest("change plan", 1, function() {
  anonApi.changePlan({email: user.email, password: user.password, plan: 'bronze'}, function(response) {
    ok(true, 'Change plan should return non-error HTTP code');

    asyncTest("delete plan", 1, function() {
      anonApi.deletePlan(user, function(plan) {
        equal(plan.type, 'bronze', 'Deleted plan should be bronze');
        start();
      });
    });

    start();
  });
});

var api$ = account$.then(function(account) {
  return new Precog.api({
    analyticsService: analyticsService,
    apiKey: account.apiKey
  });
});

asyncTest("decribe API key", 1, function() {
  var description$ = account$.then(function(account) {
    return api$.then(function(api) {
      return api.describeApiKey(account.apiKey);
    });
  });

  Future.every(description$, account$).then(function(results) {
    equal(results[0].apiKey, results[1].apiKey, 'Returned API key should match account');
    start();
  });
});

asyncTest("create API key", 2, function() {
  api$.then(function(api) {
    api.createApiKey({
      grants: []
    }).then(function(created) {
      deepEqual(created.grants, [], 'Grants must be empty');
      notEqual(created.apiKey, undefined, 'apiKey must be defined');

      asyncTest("list API keys", 2, function() {
        api.listApiKeys(function(list) {
          equal(list.length, 1, 'One API key must have been created');
          equal(created.apiKey, list[0].apiKey, 'Listed key must be API key that was just created');

          asyncTest("delete API key", 1, function() {
            api.deleteApiKey(created.apiKey).then(function(result) {
              ok(true, 'Delete API key should return non-error HTTP code');
              start();
            });
          });

          start();
        });
      });

      start();
    });
  });
});

asyncTest("list API key grants", 2, function() {
  account$.then(function(account) {
    api$.then(function(api) {
      return api.retrieveApiKeyGrants(account.apiKey);
    }).then(function(grants) {
      equal(grants.length, 1, 'Must be one grant');
      notEqual(grants[0].grantId, undefined, 'grantId must be defined');
      start();
    });
  });
});

asyncTest("upload file", 6, function() {
  account$.then(function(account) {
    var uploadPathRoot = '/' + account.accountId;
    var uploadPath = uploadPathRoot + '/' + 'test';

    api$.then(function(api) {
      return api.uploadFile({
        path: uploadPath,
        contents: '{"name": "John", "email": "john@precog.com"}\n{"name": "Brian", "email": "brian@precog.com"}',
        type: 'application/json'
      }, function(report) {
        deepEqual(report.errors, [], 'No errors should be returned');
        equal(report.failed, 0, 'None should fail');
        equal(report.skipped, 0, 'None should be skipped');
        equal(report.total, 2, 'Should have uploaded two items');
        equal(report.ingested, 2, 'Should have ingested two items');
        notEqual(report.ingestId, undefined, 'Should have an ingest ID');

        asyncTest('listing children', 2, function() {
          api.listChildren(uploadPathRoot, function(children) {
            equal(children.length, 1, 'Children must have size');
            equal(children[0], 'test/', 'Child must equal uploaded file');

            asyncTest('metadata', 3, function() {
              api.retrieveMetadata(uploadPath, function(metadata) {
                console.log(metadata);
                notEqual(metadata.size, undefined, 'Metadata must have size');
                notEqual(metadata.children, undefined, 'Metadata must have children');
                notEqual(metadata.structure, undefined, 'Metadata must have structure');

                asyncTest("delete path", 1, function() {
                  api.delete0(uploadPath, function(deleted) {
                    ok(true, 'Delete path should return non-error HTTP code');
                    start();
                  });
                });

                //start();
              });

              start();
            });

            start();
          });
        });

        start();
      });
    });
  });
});

asyncTest("execute simple", 1, function() {
  api$.then(function(api) {
    return api.execute({
      path: "",
      query: "1 + 2"
    });
  }).then(function(results) {
    deepEqual(results, [3], '1 + 2 should return 3');
    start();
  });
});

asyncTest("query async", 1, function() {
  account$.then(function(account) {
    api$.then(function(api) {
      api.asyncQuery({
        query: "1 + 2"
      }, function(query) {
        notEqual(query.jobId, undefined, 'jobId must be defined');

        asyncTest("async results", 3, function() {
          api.asyncQueryResults(query.jobId, function(results) {
            equal(results.errors.length, 0, 'Errors must be empty');
            equal(results.warnings.length, 0, 'Warnings must be empty');
            deepEqual(results.data, [3], 'Data must only contain three');

            start();
          });
        });

        start();
      });
    });
  });
});

asyncTest('create grant', function() {
  account$.then(function(account) {
    var grantName = 'testgrant';
    var childGrantName = 'testchildgrant';

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
        equal(grant.name, grantName, 'Returned grant should have correct name');

        asyncTest('add grant to API key', 1, function() {
          api.addGrantToApiKey({
            grant: grant,
            apiKey: account.apiKey
          }, function(added) {
            ok(true, 'Adding grant to API key must return non-error HTTP code');

            asyncTest('create grant child', 1, function() {
              api.createGrantChild({
                parentGrantId: grant.grantId,
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
                notEqual(childGrant.grantId, undefined, 'grantId must be defined');

                asyncTest('list grant children', function() {
                  api.listGrantChildren(grant.grantId, function(children) {
                    equal(children.length, 1, 'Grant must have one child');
                    equal(children[0].grantId, childGrant.grantId, 'Listed child grantId must be created child grantId');

                    asyncTest('remove grant from API key', 1, function() {
                      api.removeGrantFromApiKey({
                        grantId: grant.grantId,
                        apiKey: account.apiKey
                      }, function(removed) {
                        ok(true, 'Remove grant from API key must return non-error HTTP code');

                        asyncTest('add grant to account', 1, function() {
                          api.addGrantToAccount({
                            grantId: grant.grantId,
                            accountId: account.accountId
                          }, function(added) {
                            ok(true, 'Adding grant to account must return non-error HTTP code');

                            asyncTest('describe grant', 1, function() {
                              api.describeGrant(grant.grantId, function(grant) {
                                equal(grant.name, grantName, 'Described grant name should be original name');

                                asyncTest('delete grant', 1, function() {
                                  api.deleteGrant(grant.grantId, function(deleted) {
                                    ok(true, 'Delete grant must return non-error HTTP code');
                                    start();
                                  });
                                });

                                start();
                              });
                            });

                            start();
                          });
                        });

                        start();
                      });
                    });

                    start();
                  });
                });

                start();
              });
            });

            start();
          });
        });

        start();
      });
    });
  });
});

// Not tested:

// requestPasswordReset
*/