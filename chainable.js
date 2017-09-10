module.exports = Chainable

var api = 'chains'
var initialized = false

/**
 * An object with chainable methods
 *
 * @param {string} apiName - api name
 */
function Chainable (apiName) {
  var chainable = this

  setApiName(apiName)

  var methods = {} // private collection of method functions
  var tasks = [] // queue of tasks created from chainable method calls;
                 // tasks will call real functions in methods {}
  var results = [] // results from chained methods call
  var executing // chain execution status

  // chainable api properties and methods
  var chains = chainable[api] = {
    results: function () { return results },
    lastResult: function () { return results[results.length - 1] },
    clearResults: function () { results = [] },
    addResult: function (r) { results[results.length] = r },

    runTask: function (splice, done) {
      if (splice) tasks.splice(0, 1)
      if (tasks.length === 0) return false
      tasks[0](done)
      return true
    },
    clearTasks: function () { tasks = [] },
    queueTask: 'fn',

    chainable: 'fn',
    exec: 'fn',

    onError: 'fn',
    catch: 'fn',

    onFinished: 'fn',
    done: 'fn',

    parent: 'fn'
  }

  /**
   * Queue an async function or a method call with arguments
   */
  chains.queueTask = function (fn, methodName, args) {
    var hasfn = fn && fn.constructor === Function
    var hasmn = methodName && methodName.constructor === String
    if (!hasfn && !hasmn) throw new Error('Must queue a function or a method')

    tasks[tasks.length] = function (done) {
      args[args.length] = done // args = [...params, done]
      hasfn
        ? fn.apply(chainable, args)
        : methods[methodName].apply(chainable, args) // call method(...params, done)
    }

    chains.exec()
  }

  /**
   * Api to register a chainable method,
   * fn is an async function with done(err, result) callback
   */
  chains.chainable = function (methodName, fn) {
    // check if method name is a string and not a reserved keyword
    if (!methodName || methodName.constructor !== String) throw new Error('Method name must be a string')
    if (methodName === api || methodName.match(/^then$/)) throw new Error('Reserved keyword: ' + methodName)

    // add fn method to private collection methods{}
    checkAsync(fn)
    methods[methodName] = fn

    // create a public chainable method
    chainableMethod.call(chainable, methodName)

    // enable usage of .chainable().chainable()
    return this
  }

  /**
   * Execute the chain of queued methods
   */
  chains.exec = function () {
    if (executing) return
    executing = true
    results = []
    exec.call(this)
  }

  /**
   * Handle chains execution error
   * Usage: chainable.chains.catch(function (err, results) {})
   */
  chains.catch = function (fn) {
    if (fn && fn.constructor === Function) chains.onError = fn
    else throw new Error('Error handler is not a function: ' + fn)
    return this
  }

  /**
   * Handle when chains execution finished successfully
   * Usage: chainable.chains.done(function (results) {})
   */
  chains.done = function (fn) {
    if (fn && fn.constructor === Function) chains.onFinished = fn
    else throw new Error('Done handler is not a function: ' + fn)
    return this
  }

  /**
   * Returns access to parent chainable object when working with chains api
   */
  chains.parent = function () {
    return chainable
  }
}

/**
 * Api to chain a custom function fn
 * params will be passed to fn by this structure:
 * .then(
 *   function (p1, p2, p3, done) {
 *     done(err, result)
 *   },
 *   [p1, p2, p3]
 *       -OR-
 *    p1, p2, p3
 * )
 */
Chainable.prototype.then = function (fn, params) {
  var chains = this[api]

  // check if fn is an async function
  checkAsync(fn)

  // prepare args[] to apply to real methods[methodName]
  var args = []
  for (var arg in arguments) {
    if (arg > 0) args[args.length] = arguments[arg]
  }
  // if params are passed by a single array
  if (args.length === 1 && args[0] && args[0].constructor === Array) args = args[0]

  // queue the custom function call
  chains.queueTask(fn, null, args)

  return this
}

// HELPERS
// =======================================================================

/**
 * Set chainable api name
 *
 * @param {string} apiName
 */
function setApiName (apiName) {
  if (apiName === undefined) {
    // default
  } else if (!apiName || apiName.constructor !== String) {
    throw new Error('apiName should be a string')
  } else if (apiName !== api && initialized) {
    throw new Error('Chainable api name can only be customized once for consistency')
  } else {
    api = apiName
  }
  initialized = true
}

/**
 * Check if fn is an async function
 * - should has at least one parameter which is a callback function
 * - should call the callback function
 *
 * @param {Function} fn
 */
function checkAsync (fn) {
  if (!fn || fn.constructor !== Function) throw new Error('Not a function: ' + fn)

  var src = fn.toString().replace(/\/\/.*/g, '')
  var params
  try {
    params = src.match(/^function[^(]*\(([^)]*)\)/)[1].replace(/\s+/g, '').split(',')
  } catch (error) {
    throw error
  }
  if (params[0] === '') throw new Error('There is no callback in the function below\n\n' + fn.toString())

  var lastparam = params[params.length - 1]
  var cb = new RegExp(lastparam + '\\s*\\(')
  if (!cb.test(src)) throw new Error(lastparam + ' is expected to be a callback, but it is not called anywhere inside the function below\n\n' + fn.toString())
}

/**
 * Create a chainable method
 *
 * @param {string} methodName - name of new chainable method
 */
function chainableMethod (methodName) {
  var chainable = this
  var chains = chainable[api]
  chainable[methodName] = function (...params) {
    var args = [] // prepare args[] to apply to real methods[methodName]
    for (var arg in arguments) {
      if (arguments.hasOwnProperty(arg)) {
        args[args.length] = arguments[arg]
      }
    }
    // queue the method call
    chains.queueTask(null, methodName, args)
    // return the chain object to make method chaining works
    return chainable
  }
}

/**
 * Execute queued tasks[0]
 * - then slice item 0
 * - loop until tasks[] empty or an err returned
 */
function exec () {
  var chains = this

  // tasks' done callback
  var done = function (err, result) {
    if (result !== undefined) chains.addResult(result)
    if (err) {
      chains.clearTasks() // nothing more to do
      if (chains.onError.constructor !== Function) throw new Error(err) // expect error handler
      chains.onError(err, chains.results())
      chains.clearResults()
    } else if (!_exec(true) && chains.onFinished.constructor === Function) {
      // if all tasks executed && there's onFinished()
      chains.onFinished(chains.results())
      chains.clearResults()
    }
    // otherwise: _exec() runs a task, or tasks finished but there's no onFinished() handler
  }

  // tasks runner
  var _exec = function (splice) {
    return chains.runTask(splice, done)
  }

  _exec()
}
