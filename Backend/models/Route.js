const mongoose = require('mongoose');

const RouteSchema = new mongoose.Schema({
  originalNodes: [String],
  fleetSize: Number,
  optimizedPaths: mongoose.Schema.Types.Mixed,
  timeSaved: Number,
  calculatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Route', RouteSchema);