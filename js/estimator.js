// Copyright © ThroughPuter, Inc. Patents issued and pending.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


// JavaScript API to utilize the ThroughPuter Estimator microservice.

// An object interfacing with an Estimator microservice.
class Estimator extends fpgaServer {

  // Constructor.
  // Params:
  //   websocket_url: The URL of the 1st CLaaS websocket to which to connect.
  //   cb: A callback for Estimates returned by Estimator.sendObjects(..) of the form cb(estimate, info),
  //       where:
  //          estimate: The Estimate response from the Estimator of the form....TBD.
  //          info: As provided in sendObjects(..).
  //   ready_cb: (opt) Callback for websocket ready or set of callbacks as in fpgaServer constructor (without onmessage).
  constructor(websocket_url, cb, ready_cb) {
    super();
    this.wsCb = cb;

    // A structure of pending Objects (sent but not received) indexed by `${object.cnt}:${object.prob}:${object.rid}`.
    this.pendingObjects = {};

    // To support sendObjects(xx, xx, false) (non-batched sends), this structure is used to re-batchify data.
    // {<lot_cnt>: {num_objects: #,         // The number of objects in this lot.
    //              response_data: [..]},   // The accumulated response data from the Estimator.
    //  ...}
    this.lot_cnt = 0;
    this.lot = {};

    // If ready_cb is a raw function, bundle it as an object of callbacks (either form is permitted as input).
    function isFunction(functionToCheck) {
      return functionToCheck && {}.toString.call(functionToCheck) === '[object Function]';
    }
    if (isFunction(ready_cb)) {
      ready_cb = {onopen: ready_cb};
    }

    // Provide onmessage callback.
    ready_cb.onmessage = (msg) => {
      try {
        let data = JSON.parse(msg.data);
        if (data.hasOwnProperty('type')) {
          console.log(`Received message: ${data.type}`);
        } else {
          // Response.

          let last_obj = data[data.length - 1]
          // Look up pendingObjects.
          let obj_index = '';
          try {
            obj_index = `${last_obj.cnt}:${last_obj.prob}:${last_obj.rid}`;
          } catch (e) {
            console.log("Estimator response Object does not contain proper properties.");
            debugger;
          }
          let orig_obj = this.pendingObjects[obj_index];
          if (typeof orig_obj === "undefined") {
            console.log(`Estimator response Object (${obj_index}) is not pending.`);
            debugger;
          } else {
            let lot_info = this.lot[orig_obj.lot_cnt];
            // Accumulate payload data (necessary for non-batch sending mode).
            // I expect non-batch sending will remain ordered, but, if it isn't, these
            // their out-of-orderness will be reflected in response_data array.
            lot_info.response_data.push(...data);
            if (lot_info.response_data.length >= lot_info.num_objects) {
              // Last (or most likely only) response of the lot.
              // Include all accumulated data and callback.
              this.wsCb(lot_info.response_data, orig_obj.info);
            } else {
              // There are objects remaining in this lot.
            }
          }
          delete this.pendingObjects[obj_index];
        }
      } catch(err) {
        console.log(`Failed to parse returned json string: ${msg.data}`);
      }

    }

    // Create websocket.
    this.connectURL(websocket_url, ready_cb);
  }

  // Send objects to the estimator.
  // Params:
  //   objects: The Objects to send to the estimator, to be converted to JSON and passed to the microservice in the "payload" property.
  //   info: (opt) Additional information associated with these objects passed to callback.
  //   batch: (opt) Send objects as a single batch or as individual objects (single-object batches). If false, there can be intervening
  //          traffic from other sources affecting the Estimator model state.
  sendObjects(objects, info, batch=true) {

    let send = (objects) => {
      // Record this batch of objects as pending.
      //
      let obj_index = '';
      try {
        let last_obj = objects[objects.length - 1];
        obj_index = `${last_obj.cnt}:${last_obj.prob}:${last_obj.rid}`;
      } catch (e) {
        console.log("Objects for sendObjects(..) must contain properties: 'cnt' (0-65535), 'prob' (true/false), and 'rid' (0-127). Cannot send.");
        debugger;
      }
      if (typeof this.pendingObjects[obj_index] !== "undefined") {
        console.log(`Sending an object that conflicts with the pending object: ${obj_index}`);
        debugger;
      }
      this.pendingObjects[obj_index] = {info, lot_cnt: this.lot_cnt};
      this.send("OBJECT", objects);
    }
    // Send to Estimator microservice.
    if (batch) {
      send(objects);
    } else {
      // Non-batch (abnormal use model).
      for (var i = 0; i < objects.length; i++) {
        var object_array = [];
        object_array.push(objects[i]);
        send(object_array);
      }
    }
    this.lot[this.lot_cnt] = {num_objects: objects.length, response_data: []};
    this.lot_cnt++;
  }

}
