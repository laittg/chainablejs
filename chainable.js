module.exports = Chainable

var $chainables = []

/**
 * An object with chainable methods
 *
 * @param {string} apiName - api name
 */
function Chainable (apiName) {
  var chainable = this
  var parentId = indexChainable(chainable)
  chainable[apiName] = new Chains(parentId, apiName)
}

// CHAINS API
// =======================================================================

function Chains (parentId, apiName) {
  this.private = {
    parentId: parentId,
    name: apiName,
    methods: {}, // private collection of method functions
    tasks: [], // queue of tasks created from chainable method calls;
                   // tasks will call real functions in methods {}
    results: [], // results from chained methods call
    executing: false, // chain execution status
    onError: 'fn',
    onFinished: 'fn'
  }
}

/**
 * Results operations
 */
Chains.prototype.results = function () {
  return this.private.results
}

Chains.prototype.addResult = function (r) {
  var results = this.private.results
  results[results.length] = r
}

Chains.prototype.lastResult = function () {
  var results = this.private.results
  return results[results.length - 1]
}

Chains.prototype.clearResults = function () {
  this.private.results = []
}

/**
 * Run the first queued task with a done() callback.
 * Splice the [0] task if splice === true
 */
Chains.prototype.runTask = function (splice, done) {
  var tasks = this.private.tasks

  if (splice) tasks.splice(0, 1)
  if (tasks.length === 0) return false

  tasks[0](done)
  return true
}

/**
 * Queue an async function or a method call with arguments.
 * By calling internally, fnOrMethod is guaranteed
 * to be a valid methodName or an async function
 * TODO: make this a private function
 */
Chains.prototype.queueTask = function (fnOrMethod, args) {
  var chainable = this.parent()
  var methods = this.private.methods
  var tasks = this.private.tasks

  var fn = fnOrMethod.constructor === String
    ? methods[fnOrMethod]
    : fnOrMethod

  tasks[tasks.length] = function (done) {
    args[args.length] = done
    fn.apply(chainable, args) // fn(...params, done)
  }

  this.exec()
}

Chains.prototype.clearTasks = function () {
  this.private.tasks = []
}

/**
 * Api to register a chainable method,
 * fn is an async function with done(err, result) callback
 */
Chains.prototype.chainable = function (methodName, fn) {
  var chainable = this.parent()
  var methods = this.private.methods

  // check if method name is a string and not a reserved keyword
  if (!methodName || methodName.constructor !== String) throw new Error('Method name must be a string')
  if (methodName === this.name || methodName.match(/^then$/)) throw new Error('Reserved keyword: ' + methodName)

  // add fn method to private collection methods{}
  checkAsync(fn, 'Method', true)
  methods[methodName] = fn

  // create a public chainable method
  chainableMethod.call(chainable, methodName)

  // enable usage of .chainable().chainable()
  return this
}

/**
 * Execute the chain of queued methods
 */
Chains.prototype.exec = function () {
  var chains = this
  if (chains.private.executing) return
  chains.private.executing = true
  chains.private.results = []
  exec.call(this)
}

/**
 * Handle chains execution error
 * Usage: chainable.chains.catch(function (err, results) {})
 */
Chains.prototype.catch = function (fn) {
  checkAsync(fn, 'Error handler')
  this.private.onError = fn
  return this
}

/**
 * Handle when chains execution finished successfully
 * Usage: chainable.chains.done(function (results) {})
 */
Chains.prototype.done = function (fn) {
  checkAsync(fn, 'Done handler')
  this.private.onFinished = fn
  return this
}

/**
 * Returns access to parent chainable object when working with chains api
 */
Chains.prototype.parent = function () {
  var parentId = this.private.parentId
  return $chainables[parentId]
}

// CHAINABLE PROTOTYPE
// =======================================================================

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
Chainable.prototype.then = function (fn, params) {
  var chains = this[api]

  // check if fn is an async function
  checkAsync(fn, 'Then handler')

  // prepare args[] to apply to real methods[methodName]
  var args = []
  for (var arg in arguments) {
    if (arg > 0) args[args.length] = arguments[arg]
  }

  // if params are passed by a single array
  if (args.length === 1 && args[0] && args[0].constructor === Array) args = args[0]

  // queue the custom function call
  chains.queueTask(fn, args)

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
      args[args.length] = arguments[arg]
    }
    // queue the method call
    chains.queueTask(methodName, args)
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

function indexChainable (chainable) {
  var id = $chainables.length
  $chainables[id] = chainable
  return id
}
