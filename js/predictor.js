// A variant of the Estimator with an API appropriate for making predictions for a next value based on previous values.
// In other words, the X values are previous Y values.


class Predictor extends Estimator {
  // Args:
  //   depth: Number of values of history to use for the next prediction.
  //   prob: [true/false] Make probabilistic predictions.
  //   websocket_url: URL for websocket connection to Estimator microservice.
  //   cb: Callback function for predictions returning from estimator with args:
  //         estimate: the predicted value (0-255)
  //         info: as passed to the send call
  //   ready_cb: Callback for websocket ready.
  constructor(depth, prob, websocket_url, cb, ready_cb) {
    super(websocket_url,
          function (estimates, info) {
            if (estimates.length != 1) {
              throw("Received malformed estimate (1).");
            }
            let resp = estimates[0];
            // Ignore the result of a training call.
            //if (! resp.train) {      // TODO: Not getting a .train indication back.
            if ((resp.cnt % 2) == 0) { //       Odd counts are for training.
              let est = resp.prob ? resp.ests : resp.est;
              if (est === undefined) {
                throw("Received malformed estimate (2).");
              }
              cb(est, info);
            }
          },
          ready_cb);
    this.DEPTH = depth;
    this.PROB = prob;
    this.MIN_VALUE = 0;   // Mim/max value provided/predicted.
    this.MAX_VALUE = 2;
    // History of past DEPTH values.
    // [0] is earliest.
    this.history = [];
    this.cb = cb;
    this.cnt = 0;
  }

  // An object is sent for both prediction and training, and they are almost the same. This handles both.
  // Return true if an object was sent, or false if there is not enough history.
  _sendObject(train_value) {
    let ret = this.history.length >= this.DEPTH;
    if (ret) {
      if (this.history.length > this.DEPTH) {console.log("Error: Predictor: Too much data in Predictor history."); debugger;}
      // Build object to send.
      let train = Number.isInteger(train_value);
      if (((this.cnt % 2) == 1) != train) {
        console.log("Error: Predictor: Expect the first send to be a prediction, then alternating between training and prediction.");
        debugger;
      }
      // Translate values in history to values that span the available 0..255 space for better use of the Estimator.
      let vars = [];
      this.history.forEach(function(val) {
        let mapped_val =
           val == 0 ? 64 :
           val == 1 ? 128 :
           val == 2 ? 192 :
                      console.log(`History value ${val} is out of range.`);
        vars.push(mapped_val);
      });
      let obj = {
        vars: vars,
        reset: this.cnt == 0,
        uid: 55,   // All have same UID.
        rid: 33,   // All have same RID.
        prob: this.PROB,
        cnt: this.cnt++  // 1st Object is a prediction (non-training) with cnt == 0. Odd cnt's are for training.
      };
      if (train) {
        obj.train = train_value;
      }

      // Now, send it.
      this.sendObjects([obj], null);
    }
    return ret;
  }

  // Push an actual value into the history and train the Estimator based on it if there is enough history to do so.
  // (Making a prediction for the next value based on this one is a separate call.)
  pushValue(val) {
    this._sendObject(val);
    if (this.history.length >= this.DEPTH) {
      this.history.shift();
    }
    this.history.push(val);
  }

  // Predict the next value.
  // Return true if an object was sent, or false if there is not enough history.
  predict() {
    return this._sendObject(null);
  }
}
