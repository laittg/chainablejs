module.exports = Chainable

/**
 * An object with chainable methods
 *
 * @param {string} api - api name
 */
function Chainable (api) {
  if (api && api.constructor !== String) throw new Error('Chainable api should be a string')
  api = api || 'chainable'
  this[api] = Chainable.prototype.__chainable__
  this.__chains__ = new Chains(api)
  if (!(this instanceof Chainable)) extend(this)
}

function extend (chainable) {
  // or use Object.assign
  chainable.then = Chainable.prototype.then
}

Chainable.prototype.then = function () {
  $then(this, arguments)
  return this
}

Chainable.prototype.__chainable__ = function (method, fn) {
  var chainable = this
  if (method !== undefined || fn !== undefined) {
    // check if method name is a string and not a reserved keyword
    if (!method || method.constructor !== String) throw new Error('Method name must be a string')
    if (method === chainable.__chains__._api || method.match(/^then$/)) throw new Error('Reserved keyword: ' + method)

    // add fn method to private collection methods{}
    checkAsync(fn, 'Method', true)
    chainable.__chains__._methods[method] = fn

    // create a public chainable method
    chainable[method] = function (...params) {
      // queue the method call
      queueTask(chainable, method, arguments)
      // return the chain object to make method chaining works
      return this
    }
    // enable usage of .chainable().chainable()
    return chainable
  } else {
    // api: chainable().results()
    return chainable.__chains__
  }
}

/**
 * Api to chain a custom function fn
 * params will be passed to fn by this structure:
 * .then(
 *   function fn (p1, p2, p3, done) {
 *     done(err, result) // callback is optional for .then
 *   },
 *   [p1, p2, p3]
 *       -OR-
 *    p1, p2, p3
 * )
 *
 * Note: if fn(hasOnlyP1, done) and P1 takes an array V1[] as value,
 * then the calling structure must be: .then(fn, [ V1[] ])
 */
function $then (chainable, $arguments) {
  // check if fn is an async function
  var fn = $arguments[0]
  checkAsync(fn, 'Then handler')

  // prepare args[] to apply to real methods[methodName]
  var args, i

  if ($arguments.length === 2 && $arguments[1] && $arguments[1].constructor === Array) {
    // calling .then( fn(p1, p2, p3, done), [v1, v2, v3] )
    // if fn has only one param and it takes an array
    //   call .then( fn(p1, done), [ [v1.1, v1.2, v1.3] ])
    args = $arguments[1]
  } else {
    // calling .then( fn(p1, p2, p3, done), v1, v2, v3)
    args = []
    for (i = 1; i < $arguments.length; i++) {
      args[i - 1] = $arguments[i]
    }
  }

  // queue the custom function call
  queueTask(chainable, fn, args)

  return chainable
}

// CHAINS API
// =======================================================================

function Chains (api) {
  this._api = api
  this._methods = {} // private collection of method functions
  this._tasks = [] // queue of tasks created from chainable method calls
                  // tasks will call real functions in methods {}
  this._results = [] // results from chained methods call
  this._executing = false // chain execution status
  this._onError = 'fn' // error handler
  this._onFinished = 'fn' // done handler
}

/**
 * Results operations
 */
Chains.prototype.results = function () {
  return this._results
}

Chains.prototype.lastResult = function () {
  return this._results[this._results.length - 1]
}

/**
 * Handle chains execution error
 * Usage: chainable.chains.catch(function (err, results) {})
 */
Chains.prototype.catch = function (fn) {
  checkAsync(fn, 'Error handler')
  this._onError = fn
  return this
}

/**
 * Handle when chains execution finished successfully
 * Usage: chainable.chains.done(function (results) {})
 */
Chains.prototype.done = function (fn) {
  checkAsync(fn, 'Done handler')
  this._onFinished = fn
  return this
}

// HELPERS
// =======================================================================

/**
 * Check if fn is an async function
 * - should has at least one parameter which is a callback function
 * - should call the callback function
 *
 * @param {Function} fn - an async function (...params, done)
 * @param {string} desc - description of fn, e.g. Error handler
 * @param {boolean} checkCallback - set to true to check fn source for callback
 */
function checkAsync (fn, desc, checkCallback) {
  if (!fn || fn.constructor !== Function) throw new Error(desc + ' is not a function: ' + fn)
  if (!checkCallback) return

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
  if (!cb.test(src)) throw new Error(lastparam + ' is not a callback, or is not called anywhere inside the function below\n\n' + fn.toString())
}

/**
 * Queue an async function or a method call with arguments.
 * By calling internally, fnOrMethod is guaranteed
 * to be a valid methodName or an async function
 * TODO: make this a private function
 */
function queueTask (chainable, fnOrMethod, args) {
  var fn = fnOrMethod.constructor === String
    ? chainable.__chains__.methods[fnOrMethod]
    : fnOrMethod

  var tasks = chainable.__chains__._tasks
  tasks[tasks.length] = function (done) {
    args[args.length] = done
    fn.apply(chainable, args) // fn(...params, done) // what scope is THIS ?
  }

  exec(chainable.__chains__)
}

/**
 * Execute the chain of queued methods
 */
function exec (chains) {
  if (chains._executing) return
  chains._results = []

  // tasks' done callback
  function _done (err, result) {
    if (result !== undefined) chains._results[chains._results.length] = result
    if (err) {
      chains._tasks = [] // nothing more to do
      if (chains._onError.constructor !== Function) throw new Error(err) // expect error handler
      chains._onError(err, chains._results)
      chains._results = []
      chains._executing = false
    } else if (!_exec() && chains._onFinished.constructor === Function) {
      // if all tasks executed && there's onFinished()
      chains._onFinished(chains._results)
      chains._results = []
    }
    // otherwise: _exec() runs a task, or tasks finished but there's no onFinished() handler
  }

  // tasks runner
  function _exec () {
    chains._executing
      ? chains._tasks.shift()
      : chains._executing = true

    if (chains._tasks.length === 0) {
      chains._executing = false
      return false
    }

    chains._tasks[0](_done)
    return true
  }

  _exec()
}
