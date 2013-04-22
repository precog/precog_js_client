
var QUnit = (function(QUnit, T) {
  T.MaxRetryCount = T.MaxRetryCount || 10;
  T.RetryDelay    = T.RetryDelay || 100;

  var objectValues = function(obj) {
    var key, val,
      vals = QUnit.is( "array", obj ) ? [] : {};
    for (key in obj) {
      if (hasOwn.call(obj, key)) {
        val = obj[key];
        vals[key] = val === Object(val) ? objectValues(val) : val;
      }
    }
    return vals;
  };

  var lift = function(unlifted) {
    return function() {
      var self = this;

      var futureOfArray = Future.every(toFutureList(arguments));

      return futureOfArray.then(function(array) {
        return unlifted.apply(self, array);
      })["catch"](self.catcher);      
    };
  };

  var Test = function(testName, testCount, testBody, tries) {
    this.name     = testName;
    this.count    = testCount;
    this.body     = testBody;
    this.fails    = 0;
    this.succs    = 0;
    this.tries    = tries || 1;
    this.deferred = [];
  };

  Test.prototype.start = function() {
    return this.body(this);
  };

  Test.prototype.catcher = function(reason) {
    var self = this;

    self.markTest(false, function() {
      QUnit.ok(false, reason);
    });

    self.retryOrFail();
  };

  Test.prototype.runQUnit = function() {
    var self = this;

    QUnit.asyncTest(self.name, self.deferred.length, function() {
      QUnit.start();

      // Play back all tests:
      for (var i = 0; i < self.deferred.length; i++) {
        self.deferred(i);
      }

      QUnit.stop();
    });
  };

  Test.prototype.markTest = function(succeeded, qtest) {
    var self = this;

    self.deferred.push(qtest);

    if (succeeded) ++self.succs; else ++self.fails;

    var total = self.succs + self.fails;

    console.log(self);

    if (total >= self.count) {
      // All tests have been run.
      if (self.fails > 0) {
        this.retryOrFail();
      } else {
        // All tests have succeeded!
        self.runQUnit();
      }
    }
  };

  Test.prototype.retryOrFail = function() {
    var self = this;

    // There was one or more failures. See if we can retry:
    if (self.tries < T.MaxRetryCount) {
      var next = new Test(self.name, self.count, self.body, self.tries + 1);

      // Start the next test after waiting a while:
      setTimeout(function(){next.start();}, T.RetryDelay);
    } else {
      // All tests have failed, and no more retries!
      self.runQUnit();
    }
  };

  Test.prototype.ok = lift(function(result0, msg) { 
    this.markTest(!!result0, function(){return QUnit.ok(result0, msg);});
  });

  Test.prototype.equal = lift(function(actual, expected, message) { 
    this.markTest(expected == actual, function(){return QUnit.equal(actual, expected, message);});
  });

  Test.prototype.notEqual = lift(function(actual, expected, message) { 
    this.markTest(expected != actual, function(){return QUnit.notEqual(actual, expected, message);});
  });

  Test.prototype.propEqual = lift(function(actual, expected, message) { 
    actual = objectValues(actual);
    expected = objectValues(expected);
    this.markTest(QUnit.equiv(actual, expected), function(){return QUnit.propEqual(actual, expected, message);});
  });

  Test.prototype.notPropEqual = lift(function(actual, expected, message) { 
    actual = objectValues(actual);
    expected = objectValues(expected);
    this.markTest(!QUnit.equiv(actual, expected), function(){return QUnit.notPropEqual(actual, expected, message);});
  });

  Test.prototype.deepEqual = lift(function(actual, expected, message) { 
    this.markTest(QUnit.equiv(actual, expected), function(){return QUnit.deepEqual(actual, expected, message);}); 
  });

  Test.prototype.notDeepEqual = lift(function(actual, expected, message) { 
    this.markTest(!QUnit.equiv(actual, expected), function(){return QUnit.notDeepEqual(actual, expected, message);}); 
  });

  Test.prototype.strictEqual = lift(function(actual, expected, message) { 
    this.markTest(expected === actual, function(){return QUnit.strictEqual(actual, expected, message);}); 
  });

  Test.prototype.notStrictEqual = lift(function(actual, expected, message) { 
    this.markTest(expected !== actual, function(){return QUnit.notStrictEqual(actual, expected, message);}); 
  });

  Test.prototype["throws"] = lift(function(block, expected, message) { 
    var actual, expectedOutput = expected, ok = false;

    if ( typeof expected === "string" ) {
      message = expected;
      expected = null;
    }

    try {
      block.call(null);
    } catch (e) {
      actual = e;
    }

    if (actual) ok = true;
    else ok = false;

    this.markTest(ok, function(){return QUnit["throws"](block, expected, message);}));
  });

  T.asyncTest = function(name, count, body) {
    (new Test(name, count, body)).start();
  };

  return T;
})(QUnit, {}});
