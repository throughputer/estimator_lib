# ThroughPuter, Inc. Estimator Microservice User JavaScript Library

JavaScript Library functions for using the ThroughPuter, Inc. Estimator microservice.

## APIs

Two APIs are provided.

### Estimator API

The file `estimator.js` can be used for direct access to the Estimator microservice.

Methods are documented within `estimator.js`.

### Premonition API

The file `premonition.js` utilizes `estimator.js` to provide a simpler API for using the Estimator in a mode where the input variables are values from a history.

Methods are documented within `premonition.js`.

# Connecting the Estimator Microservice

You're [Estimator microservice(s)](https://www.estimatorlab.com) are controlled via your [Estimator Dashboard](https://www.estimatorlab.com). You're application must be connects to a microservice via a WebSocket. The URL for this WebSocket contains a access key that you can obtain via your dashboard. The WebSocket URL containing your access key is a parameter of the Estimator and Promonition JavaScript classes.

## Demos

[Demo applications](https://github.com/throughputer/estimator_demos) are available to demonstrate the use of these libraries.
