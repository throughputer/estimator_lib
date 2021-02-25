# ThroughPuter, Inc. Estimator API

*Copyright © ThroughPuter, Inc. Patents issued and pending. All rights reserved.*

## Introduction

The ThroughPuter Estimator is a hardware-accelerated machine-learning microservice capable of making classifications etc. predictions in a changing environment in real time. It is sent a stream of feature vectors characterizing known objects or events and learns to classify (or predict properties for) unknown ones.

This document specifies the interfaces provided to the ThroughPuter Estimator microservice in various forms:
  - as a WebSocket-based microservice
  - as a JavaScript "Estimator" class (where the Estimator class calls the microservice)
  - as a JavaScript "Prediction" class (where the Prediction derives from the Estimator class) providing a single-value-data-stream use model.

## Terminology

  - **Estimator**: The microservice making predictions/estimations.
  - **Estimator Model**: The state of the Estimator, characterizing the current environment.
  - **Object**: An entity used to train the Estimator Model or to be estimated by the Estimator, characterized by a set of values.
  - **Training Object**: An Object presented to train the Estimator.
  - **Non-training Object**: An Object presented to be estimated.
  - **Training Value**: The correct characterization of a Training Object, presented to the Estimator along with the Training Object.
  - **Feature Vector**: A set of values characterizing an object, included with both Training and Non-Training Objects.
  - **Estimate**: The resulting characterization from the Estimator for an Object.
  - **Estimate Value Range**: The range of values supported by the Estimator (depending on the specific hardware implementation). (The API supports 0..255, but the implementation may be more limited.)
  - **Numeric Object**: An Object for which the Training Values in the dataset are numeric.
  - **Labeled Object**: An Object for which the Training Values in the dataset are label strings.
  - **Probabilistic Object**: \[*Note that Probabilistic Objects are not supported in the current Estimator but can be [requested](mailto:tech@throughputer.com)*\] An Object for which to produce not just a single-value estimate, but several most-probable values with a Probability for each.
  It is typical for Numeric Objects to be Non-Probabilistic, and Labeled Objects can be Probabilistic.
  - **Probability**: For Probabilistic Objects, the likelihood of a given Label being the correct one.
  - **Batch Estimate**: A bundle of one or more Objects sent and received as a single WebSocket message and processed atomically
  (without intervening objects) by the Estimator.

## Use Models

Common use models include:
  - **Streaming Mode**: A dedicated Estimator microservice is continuously trained with real-time data and continually makes estimates based on its model state.
  - **Batch Mode**: The Estimator is not relied upon the retain its state between Batch Estimates. The first Object in the Batch resets the Estimator Model.
  A recent history of objects is stored externally and provided in the Batch to initialize the Estimator Model to reflect this history. The Batch then contains one
  or more Non-training Objects to estimate.


## General API

The section describes the communication from application to Estimator in general terms, applicable to all APIs.

### Objects

An Object sent to the Estimator contains the following fields (with given [bit-range] <value-range>):

  - **Feature Vector [7:0] <0-255>** (up to the max supported by the kernel implementation)  
  - **Training Value [7:0] <0-255>** (limited by the Estimator Value Range)
  - **Tag [31:0]**: An identifier for the object. The Estimator forms this tag by combining the following values:
    - **FirstObject [0:0] <0/1>**: A value of 1 resets the Estimator model.
    - **UID [7:0] <0-127>**: An identifier for the user (currently assigned by the client, but this may be assigned by the server in the future).
    - **RID [7:0] <0-127>**: A run ID. This has no functional impact, but can be convenient for client bookkeeping.
    - **Probabilistic <true/false>**
    - **Count [15:0] <0-65535>**: A running count within the run.

The kernel relies on the Tag value for functional behavior only in that:
  - FirstObject or a UID value different than that of the previous object notifies the kernel that an object stream independent from the previous stream has begun, causing the kernel to reset its object models.
  - Probabilistic objects report the top three most likely estimate values along with their Probabilities; otherwise, the kernel will identify just the single most likely estimate value without probabilities.

### Estimates

An Estimate returned from the Estimator to the application contains different fields for Non-Probabilistic and Probabilistic Objects.

#### Non-Probabilistic Objects:

  - **Tag [31:0]**: Object’s tag, as sent.
  - **Value [7:0] <0-255>**: The estimated value.

#### Probabilistic Objects:

\[*Note that Probabilistic Objects are not supported in the current Estimator but can be [requested](mailto:tech@throughputer.com)*\]

  - **Tag [31:0]**: Object’s tag, as sent
  - **Values[2:0] <0-255>**: Top 3 predicted Labels
  - **Numerators[2:0] <0-255>**: Numerator of the Probabilities
  - **Denominators[2:0] <0-255>**: Denominators of the Probabilities



## WebSocket Microservice API

Applications written in any programming language can communicate with the Estimator via a WebSocket. The application
sends Objects to the Estimator via the WebSocket as JSON strings representing object fields as:

```
{
  “type”: “OBJECT”,
  “payload”: {
    “vars”: [<0-255>, ...], // The Feature Vector.
    "train“: <0-255>, // (opt) Training data if this is a Training Object.
    "reset“: <0/1>, // (opt, default=0) A 1 value indicates a FirstObject to reset the Estimator models.
    "uid“: <0-127>,
    "rid“: <0-127>,
    "prob“: <true/false>,
    “cnt”: <0-65535>
  }
}
```

The Estimator microservice responds with WebSocket Estimate messages in one of the following two forms:

For Non-Probabilistic Objects:

```
{
  "uid“: <0-127>,
  "rid“: <0-127>,
  "prob“: <true/false>,
  “cnt”: <0-65535>,
  “est”: <0-255>
}
```

For Probabilistic Objects:

```
{
  "uid“: <0-127>,
  "rid“: <0-127>,
  "prob“: <true/false>,
  “cnt”: <0-65535>,
  "ests“: [{est: <0-255>, num: <0-255>, denom: <0-255>},
           {est: <0-255>, num: <0-255>, denom: <0-255>},
           {est: <0-255>, num: <0-255>, denom: <0-255>}]
}
```


## JavaScript Estimator API

The file `estimator.js` provides the `Estimator` class for interfacing with the Estimator microservice:

`new Estimator(websocket_url, cb, ready_cb)`

  - `websocket_url`: The URL of the WebSocket of the Estimator microservice.
  - `cb`: A callback for Estimates returned by `Estimator.sendObjects(..)` of the form cb(estimate, info), where:
    - `estimate`: The Estimate response from the Estimator as a JavaScript object corresponding to the JSON `est` value returned by the WebSocket for Non-Probablistic Objects or the `ests` array value for Probablistic Objects.
    - `info`: As provided in `sendObjects(..)`.
  - `ready_cb`: (opt) A callback for WebSocket.onopen, or an object of (optional) WebSocket callbacks of the form: `{onopen: function(), onclose: function(), onerror: function()}`.

`Estimator.sendObjects(objects, info)`

  - `objects`: The Objects to send to the estimator, to be converted to JSON and passed to the microservice in the "payload" property.
  - `info`: (opt) Additional information associated with the objects passed to callback.


## JavaScript Prediction API

The file `prediction.js` provides the `Prediction` class. This class derives from the `Estimator` class. It provides a simpler
interface for a restricted use model where the Estimator is predicting new next value in a sequence based on a very recent
history of values.

`new Prediction(depth, prob, websocket_url, cb, ready_cb)`

  - `depth`: Number of values of history to use for the next prediction.
  - `prob`: `[true/false]` Make probabilistic predictions.
  - `websocket_url`, `cb`, `ready_cb`: As in `Estimator`'s constructor, above.

`Prediction.pushValue(val)`: Push an actual value into the history and train the Estimator based on it if there is enough history to do so.
`predict()`: Predict the next value. Return `true` if an object was sent, or `false` if there is not enough history.
