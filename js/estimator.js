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
  // Just for debug:
  async wait(ms) {
    return new Promise( function (resolve) {
      window.setTimeout(resolve, ms);
    })
  }
  
  ws_ready = null;  // A Promise that resolves when the websocket is ready.  
  // Wait for the WebSocket to be ready (if it isn't already).
  async wsReady() {
    return this.ws_ready;
  }

  // Constructor.
  // Params:
  //   websocket_url: The URL of the 1st CLaaS websocket to which to connect.
  //   cb: A callback for Estimates returned by Estimator.sendObjects(..) of the form cb(estimates, info),
  //       where:
  //          estimates: An array of estimate responses from the Estimator of the form....TBD.
  //          info: As provided in sendObjects(..).
  //   ready_cb: (opt) Callback for websocket ready or set of callbacks as in fpgaServer constructor (without onmessage).
  constructor(websocket_url, cb, ready_cb) {
    super();
    this.wsCb = cb;

    // A structure of pending Objects for each batch (sent but not received) indexed by `${object.cnt}:${object.prob}:${object.rid}`
    // of the last object of the batch.
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
    
    // Structure ready_cb as an object of optional callbacks if it is not already, and attach Promises.
    if (isFunction(ready_cb)) {
      ready_cb = {onopen: ready_cb};
    } else if (!ready_cb) {
      ready_cb = {};
    }
    // Set up ws_ready Promise to resolve after onopen callback.
    if (typeof ready_cb.onopen !== 'undefined') {
      let onopen = ready_cb.onopen;
      this.ws_ready = new Promise( (resolve, reject) => {
        ready_cb.onopen = function () {onopen(); resolve();}
      })
    }

    // Provide onmessage callback for a batch response message.
    ready_cb.onmessage = (msg) => {
      try {
        let data = JSON.parse(msg.data);
        if (data.hasOwnProperty('type')) {
           if (typeof window != 'undefined' || data.type != "PING") {
              console.log(`Received message: ${data.type}`);
           }
        } else {
          // Response.

          let last_obj = data[data.length - 1]
          // Look up pendingObjects.
          let last_obj_index = '';
          try {
            last_obj_index = `${last_obj.cnt}:${last_obj.prob}:${last_obj.rid}`;
          } catch (e) {
            console.log("Estimator response Object does not contain proper properties.");
            debugger;
          }
          let orig_obj = this.pendingObjects[last_obj_index];
          if (typeof orig_obj === "undefined") {
            console.log(`Estimator response Object (${last_obj_index}) is not pending.`);
            debugger;
          } else {
            let lot_info = this.lot[orig_obj.lot_cnt];
            // Accumulate payload data (necessary for non-batch sending mode).
            // I expect non-batch sending will remain ordered, but, if it isn't,
            // their out-of-orderness will be reflected in response_data array.
            lot_info.response_data.push(...data);
            if (lot_info.response_data.length >= lot_info.num_objects) {
              // Last (or most likely only) response of the lot.
              // Include all accumulated data and callback.
              this.wsCb(lot_info.response_data, orig_obj.info);
              // Resolve Promise.
              orig_obj.resolve({data: lot_info.response_data, info: orig_obj.info});
            } else {
              // There are objects remaining in this lot.
            }
          }
          delete this.pendingObjects[last_obj_index];
        }
      } catch(err) {
        console.log(`Failed to parse returned json string: ${msg.data}`);
      }

    }

    // Create websocket.
    this.connectURL(websocket_url, ready_cb);
  }

  // Send a "lot" of objects to the estimator.
  // Params:
  //   objects: The Objects to send to the estimator, to be converted to JSON and passed to the microservice in the "payload" property.
  //   info: (opt) Additional information associated with this lot of objects passed to lot response callback.
  //   batch: (opt) Send objects as a single batch or as individual objects (single-object batches). If false, there can be intervening
  //          traffic from other sources affecting the Estimator model state.
  // Return:
  //   A Promise that will resolve with the response.
  sendObjects(objects, info, batch=true) {
    let last_obj_index = '';
    
    let send = (objects) => {
      // Record this batch of objects as pending.
      //
      try {
        let last_obj = objects[objects.length - 1];
        last_obj_index = `${last_obj.cnt}:${last_obj.prob}:${last_obj.rid}`;
      } catch (e) {
        console.log("Objects for sendObjects(..) must contain properties: 'cnt' (0-65535), 'prob' (true/false), and 'rid' (0-127). Cannot send.");
        debugger;
      }
      if (typeof this.pendingObjects[last_obj_index] !== "undefined") {
        console.log(`Sending an object that conflicts with the pending object: ${last_obj_index}`);
        debugger;
      }
      // pendingObjects is the same for every batch of the lot, but only used by the last. (There is one for each lot, just so there's
      // something for onmessage to look up with each batch message.)
      this.pendingObjects[last_obj_index] = {info, lot_cnt: this.lot_cnt};
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
    // Before the response can come, prepare the promise to return and add its resolve function to the last of pendingObjects
    // for resolution in onmessage..
    let promise = new Promise( (resolve) => {
      this.pendingObjects[last_obj_index].resolve = resolve;
    });
    
    this.lot[this.lot_cnt] = {num_objects: objects.length, response_data: []};
    this.lot_cnt++;
    
    return promise;
  }

}
