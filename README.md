# ThroughPuter, Inc. Estimator Microservice User JavaScript Library

JavaScript Library functions for using the ThroughPuter, Inc. Estimator microservice.

## APIs

Two JavaScript APIs are provided to communicate with the Estimator microservice WebSocket. It is also possible to use the WebSocket API directly in any programming languages. These APIs are specified in the accompanying [EstimatorAPI.md](https://github.com/throughputer/estimator_lib/blob/master/EstimatorAPI.md), and summarized below.

### Estimator API

The file `estimator.js` can be used for direct access to the Estimator microservice.

### Prediction API

The file `prediction.js` utilizes `estimator.js` to provide a simpler API for using the Estimator in a mode where the input variables are values from a history.

# Connecting the Estimator Microservice

You're [Estimator microservice(s)](https://www.estimatorlab.com) are controlled via your [Estimator Dashboard](https://www.estimatorlab.com). You're application must be connects to a microservice via a WebSocket. The URL for this WebSocket contains a access key that you can obtain via your [Estimator Dashboard](https://www.estimatorlab.com). The WebSocket URL containing your access key is a parameter of the Estimator and Promonition JavaScript classes.

## Demos

[Demo applications](https://github.com/throughputer/estimator_demos) are available to demonstrate the use of these libraries.
