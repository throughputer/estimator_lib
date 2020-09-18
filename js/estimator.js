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
  //   ready_cb: A callback for WebSocket.onopen.
  constructor(websocket_url, cb, ready_cb) {
    super();
    this.wsCb = cb;

    // A structure of pending Objects (sent but not received) indexed by `${object.cnt}:${object.prob}:${object.rid}`.
    this.pendingObjects = {};

    // Create websocket.
    this.ws = new WebSocket(websocket_url);
    this.ws.onmessage = (msg) => {
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
          }
          this.wsCb(data, orig_obj);
        }
      } catch(err) {
        console.log(`Failed to parse returned json string: ${msg.data}`);
      }

    }
    this.ws.onopen = ready_cb;
    this.ws.onerror = function (err) {
      console.log(`Websocket error: ${err}`);
      debugger;
    }
  }

  // Send objects to the estimator.
  // Params:
  //   objects: The Objects to send to the estimator, to be converted to JSON and passed to the microservice in the "payload" property.
  //   info: (opt) Additional information associated with these objects passed to callback.
  sendObjects(objects, info) {

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
    this.pendingObjects[obj_index] = info;

    // Send to Estimator microservice.
    this.send("OBJECT", objects);
  }

}
