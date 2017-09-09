module.exports = {
  cometSeries: function (tasks, alldone) {
    tasks[0](function (err, result) {
      console.log(err, result)
      tasks[1](function (err, result) {
        console.log(err, result)
        console.log('all done')
        alldone()
      })
    })
  }
}
