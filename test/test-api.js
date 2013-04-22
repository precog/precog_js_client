var analyticsService = 'https://devapi.precog.com';

var user = {
  email: 'dotnettest' + new Date().valueOf() + '@precog.com',
  password: Math.random().toString()
};

var anonApi = new Precog.api({analyticsService: analyticsService});

var account$ = anonApi.createAccount(user, function(account) {
  return anonApi.describeAccount(user);
});

AUnit.asyncTest("describe account", 1, function(test) {
  account$.then(function(account) {
    test.equal(account.email, user.email, 'Email returned from describeAccount is same');
  });
});


AUnit.asyncTest("current plan", 1, function(test) {
  anonApi.currentPlan(user, function(plan) {
    test.equal(plan, 'Free', 'Created plan should be Free');
  });
});


AUnit.asyncTest("change plan", 1, function(test) {
  anonApi.changePlan({email: user.email, password: user.password, plan: 'bronze'}, function(response) {
    test.ok(true, 'Change plan should return non-error HTTP code');

    test.asyncTest("delete plan", 1, function(test) {
      anonApi.deletePlan(user, function(plan) {
        test.equal(plan, 'bronze', 'Deleted plan should be bronze');
      });
    });
  });
});


var api$ = account$.then(function(account) {
  return new Precog.api({
    analyticsService: analyticsService,
    apiKey: account.apiKey
  });
});

AUnit.asyncTest("decribe API key", 1, function(test) {
  var description$ = account$.then(function(account) {
    return api$.then(function(api) {
      return api.describeApiKey(account.apiKey);
    });
  });

  Future.every(description$, account$).then(function(results) {
    test.equal(results[0].apiKey, results[1].apiKey, 'Returned API key should match account');
  });
});

AUnit.asyncTest("create API key", 2, function(test) {
  api$.then(function(api) {
    api.createApiKey({
      grants: []
    }).then(function(created) {
      test.deepEqual(created.grants, [], 'Grants must be empty');
      test.notEqual(created.apiKey, undefined, 'apiKey must be defined');

      test.asyncTest("list API keys", 2, function(test) {
        api.listApiKeys(function(list) {
          test.equal(list.length, 1, 'One API key must have been created');
          test.equal(created.apiKey, list[0].apiKey, 'Listed key must be API key that was just created');

          test.asyncTest("delete API key", 1, function(test) {
            api.deleteApiKey(created.apiKey).then(function(result) {
              test.ok(true, 'Delete API key should return non-error HTTP code');
            });
          });
        });
      });
    });
  });
});

AUnit.asyncTest("list API key grants", 2, function(test) {
  account$.then(function(account) {
    api$.then(function(api) {
      return api.retrieveApiKeyGrants(account.apiKey);
    }).then(function(grants) {
      test.equal(grants.length, 1, 'Must be one grant');
      test.notEqual(grants[0].grantId, undefined, 'grantId must be defined');
    });
  });
});

AUnit.asyncTest("upload file", 6, function(test) {
  account$.then(function(account) {
    var uploadPathRoot = '/' + account.accountId;
    var uploadPath = uploadPathRoot + '/' + 'test';

    api$.then(function(api) {
      return api.uploadFile({
        path: uploadPath,
        contents: '{"name": "John", "email": "john@precog.com"}\n{"name": "Brian", "email": "brian@precog.com"}',
        type: 'application/json'
      }, function(report) {
        test.deepEqual(report.errors, [], 'No errors should be returned');
        test.equal(report.failed, 0, 'None should fail');
        test.equal(report.skipped, 0, 'None should be skipped');
        test.equal(report.total, 2, 'Should have uploaded two items');
        test.equal(report.ingested, 2, 'Should have ingested two items');
        test.notEqual(report.ingestId, undefined, 'Should have an ingest ID');

        test.asyncTest('listing children', 2, function(test) {
          api.listChildren(uploadPathRoot, function(children) {
            test.equal(children.length, 1, 'Children must have size');
            test.equal(children[0], 'test/', 'Child must equal uploaded file');

            test.asyncTest('metadata', 3, function(test) {
              api.retrieveMetadata(uploadPath, function(metadata) {
                test.notEqual(metadata.size, undefined, 'Metadata must have size');
                test.notEqual(metadata.children, undefined, 'Metadata must have children');
                test.notEqual(metadata.structure, undefined, 'Metadata must have structure');

                test.asyncTest("delete path", 1, function(test) {
                  api.delete0(uploadPath, function(deleted) {
                    test.ok(true, 'Delete path should return non-error HTTP code');
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

AUnit.asyncTest("execute simple", 1, function(test) {
  api$.then(function(api) {
    return api.execute({
      path: "",
      query: "1 + 2"
    });
  }).then(function(results) {
    test.deepEqual(results, [3], '1 + 2 should return 3');
  });
});

AUnit.asyncTest("query async", 1, function(test) {
  account$.then(function(account) {
    api$.then(function(api) {
      api.asyncQuery({
        query: "1 + 2"
      }, function(query) {
        test.notEqual(query.jobId, undefined, 'jobId must be defined');

        test.asyncTest("async results", 3, function(test) {
          api.asyncQueryResults(query.jobId, function(results) {
            test.equal(results.errors.length, 0, 'Errors must be empty');
            test.equal(results.warnings.length, 0, 'Warnings must be empty');
            test.deepEqual(results.data, [3], 'Data must only contain three');
          });
        });
      });
    });
  });
});

AUnit.asyncTest('create grant', 1, function(test) {
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
        test.equal(grant.name, grantName, 'Returned grant should have correct name');

        test.asyncTest('add grant to API key', 1, function(test) {
          api.addGrantToApiKey({
            grant: grant,
            apiKey: account.apiKey
          }, function(added) {
            test.ok(true, 'Adding grant to API key must return non-error HTTP code');

            test.asyncTest('create grant child', 1, function(test) {
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
                test.notEqual(childGrant.grantId, undefined, 'grantId must be defined');

                test.asyncTest('list grant children', 2, function(test) {
                  api.listGrantChildren(grant.grantId, function(children) {
                    test.equal(children.length, 1, 'Grant must have one child');
                    test.equal(children[0].grantId, childGrant.grantId, 'Listed child grantId must be created child grantId');

                    test.asyncTest('remove grant from API key', 1, function(test) {
                      api.removeGrantFromApiKey({
                        grantId: grant.grantId,
                        apiKey: account.apiKey
                      }, function(removed) {
                        test.ok(true, 'Remove grant from API key must return non-error HTTP code');

                        test.asyncTest('add grant to account', 1, function(test) {
                          api.addGrantToAccount({
                            grantId: grant.grantId,
                            accountId: account.accountId
                          }, function(added) {
                            test.ok(true, 'Adding grant to account must return non-error HTTP code');

                            test.asyncTest('describe grant', 1, function(test) {
                              api.describeGrant(grant.grantId, function(grant) {
                                test.equal(grant.name, grantName, 'Described grant name should be original name');

                                test.asyncTest('delete grant', 1, function(test) {
                                  api.deleteGrant(grant.grantId, function(deleted) {
                                    test.ok(true, 'Delete grant must return non-error HTTP code');
                                  });
                                });
                              });
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

// Not tested:

// requestPasswordReset
