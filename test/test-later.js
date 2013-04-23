
var AUnit = (function(QUnit, T) {
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

      var args = Array.prototype.slice.call(arguments, 0);

      var futureOfArray = Future.every.apply(null, args);

      return futureOfArray.then(function(array) {
        return unlifted.apply(self, array);
      })["catch"](function(reason) { 
        return self.catcher(reason);
      });      
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
    this.children = [];
  };

  Test.prototype.start = function() {
    QUnit.stop();

    console.debug('Starting test "' + this.name + '" for attempt #' + this.count);

    return this.body(this);
  };

  Test.prototype.asyncTest = function(testName, testCount, testBody) {
    this.children.push(new Test(testName, testCount, testBody));
  };

  Test.prototype.catcher = function(reason) {
    log.error('Failed "' + this.name + '" for reason: ' + reason);

    var self = this;

    self.markTest(false, function() {
      QUnit.ok(false, reason);
    });

    self.retryOrFail();
  };

  Test.prototype.runQUnit = function() {
    var self = this;

    console.debug('Running all QUnit tests for "' + self.name + '"');

    QUnit.asyncTest(self.name, self.deferred.length, function() {
      QUnit.start();

      // Play back all tests:
      for (var i = 0; i < self.deferred.length; i++) {
        self.deferred[i]();
      }

      QUnit.stop();
    });

    // Start all the sub tests:
    if (this.fails === 0) {
      console.log('Starting all sub tests of "' + this.name + '"');

      for (var i = 0; i < this.children.length; i++) {
        this.children[i].start();
      }
    }
  };

  Test.prototype.markTest = function(succeeded, qtest) {
    console.debug('Marking test as ' + (succeeded ? 'succeeded' : 'failed'));

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
      console.debug('More retries left for test "' + self.name + '", retrying entire test');

      var next = new Test(self.name, self.count, self.body, self.tries + 1);

      // Start the next test after waiting a while:
      setTimeout(function(){next.start();}, T.RetryDelay);
    } else {
      console.error('No more retries for test "' + self.name + '", running QUnit');

      // All tests have failed, and no more retries!
      self.runQUnit();
    }
  };

  Test.prototype.ok = lift(function(result0, msg) { 
    this.markTest(!!result0, function(){return QUnit.ok(result0, msg);});
  });

  Test.prototype.equal = lift(function(actual, expected, message) { 
    console.debug('Checking to see if ' + expected + ' is equal to ' + actual);

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

    this.markTest(ok, function(){return QUnit["throws"](block, expected, message);});
  });

  T.asyncTest = function(name, count, body) {
    console.debug('Starting asynchronous test "' + name + '" with ' + count + ' tests');

    (new Test(name, count, body)).start();
  };

  return T;
})(QUnit, {});