var Chainable = require('../chainable.js')

describe('Chainable', function () {
  var defaultAPI = {
    chainable: 'chainable',
    then: 'then',
    done: 'done',
    catch: 'catch',
    results: 'results',
    lastResult: 'lastResult'
  }

  var customAPI = {
    chainable: 'add',
    then: 'do',
    done: 'done',
    catch: 'catch',
    results: 'getResults',
    lastResult: 'getLastResult'
  }

  describe('Initialize', function () {
    it('create a new Chainable with default settings', function () {
      var chain = new Chainable()
      expect(chain.__chainable__.api).toEqual(defaultAPI)
    })

    it('modify an existing object', function () {
      var myObj = {}
      Chainable.call(myObj, customAPI)
      expect(myObj.__chainable__.api).toEqual(customAPI)
      expect(myObj[customAPI.chainable]).toEqual(jasmine.any(Function))
    })
  })

  describe('.chainable()', function () {
    it('throw error if there\'s no callback', function () {
      var chain = new Chainable()
      function thinker () {}
      expect(chain.chainable('think', thinker)).toThrowError('')
      expect(chain.chainable('think', function (done) {})).toThrowError()
    })
  })
})
