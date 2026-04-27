/**
 * MouseTracker.js
 * Translated from the Python RealTimeProcessor implementation provided by the research paper.
 * Processes mouse events and calculates metrics like flips, velocity, and acceleration to detect fake mouse movements.
 */

class RealTimeProcessor {
  calculateAllMetrics(events) {
    if (events.length < 2) return {};

    const totalDist = this._calculateDistance(events);
    
    let xDist = 0;
    let yDist = 0;
    for (let i = 0; i < events.length - 1; i++) {
      xDist += Math.abs(events[i + 1].x - events[i].x);
      yDist += Math.abs(events[i + 1].y - events[i].y);
    }

    // timestamps in JS are milliseconds. Convert to seconds.
    const timeSpan = (events[events.length - 1].timestamp - events[0].timestamp) / 1000.0;
    const duration = timeSpan;

    const { xFlips, yFlips } = this._calculateFlipsPaper(events);
    const velocityMetrics = this._calculateVelocityPaper(events);
    const accelerationMetrics = this._calculateAccelerationPaper(events);

    return {
      total_events: events.length,
      total_moves: events.length,
      distance_ui: totalDist,
      x_axis_distance_ui: xDist,
      y_axis_distance_ui: yDist,
      movement_time_span_ui: timeSpan,
      duration_ui: duration,
      x_flips_ui: xFlips,
      y_flips_ui: yFlips,
      ...velocityMetrics,
      ...accelerationMetrics
    };
  }

  _calculateDistance(events) {
    let sum = 0;
    for (let i = 0; i < events.length - 1; i++) {
      const dx = events[i + 1].x - events[i].x;
      const dy = events[i + 1].y - events[i].y;
      sum += Math.sqrt(dx * dx + dy * dy);
    }
    return sum;
  }

  _calculateFlipsPaper(events) {
    if (events.length < 3) return { xFlips: 0, yFlips: 0 };

    let xFlips = 0;
    let yFlips = 0;
    let prevDirX = 0;
    let prevDirY = 0;

    for (let i = 1; i < events.length; i++) {
      let dirX = 0;
      if (events[i].x > events[i - 1].x) dirX = 1;
      else if (events[i].x < events[i - 1].x) dirX = -1;

      let dirY = 0;
      if (events[i].y > events[i - 1].y) dirY = 1;
      else if (events[i].y < events[i - 1].y) dirY = -1;

      if (i > 1) {
        if ((prevDirX === 1 && dirX === -1) || (prevDirX === -1 && dirX === 1)) {
          xFlips++;
        }
        if ((prevDirY === 1 && dirY === -1) || (prevDirY === -1 && dirY === 1)) {
          yFlips++;
        }
      }

      prevDirX = dirX;
      prevDirY = dirY;
    }

    return { xFlips, yFlips };
  }

  _calculateVelocityPaper(events) {
    if (events.length < 2) {
      return { velocity_ui: 0, x_axis_velocity_ui: 0, y_axis_velocity_ui: 0 };
    }

    const totalDistance = this._calculateDistance(events);
    
    let xDistance = 0;
    let yDistance = 0;
    for (let i = 0; i < events.length - 1; i++) {
      xDistance += Math.abs(events[i + 1].x - events[i].x);
      yDistance += Math.abs(events[i + 1].y - events[i].y);
    }

    const movementTimeSpan = (events[events.length - 1].timestamp - events[0].timestamp) / 1000.0;

    if (movementTimeSpan <= 0) {
      return { velocity_ui: 0, x_axis_velocity_ui: 0, y_axis_velocity_ui: 0 };
    }

    return {
      velocity_ui: totalDistance / movementTimeSpan,
      x_axis_velocity_ui: xDistance / movementTimeSpan,
      y_axis_velocity_ui: yDistance / movementTimeSpan
    };
  }

  _calculateAccelerationPaper(events) {
    if (events.length < 3) {
      return { acceleration_ui: 0, x_axis_acceleration_ui: 0, y_axis_acceleration_ui: 0 };
    }

    const midIdx = Math.floor(events.length / 2);
    const firstHalf = events.slice(0, midIdx + 1);
    const secondHalf = events.slice(midIdx);

    const v1Metrics = this._calculateVelocityPaper(firstHalf);
    const v2Metrics = this._calculateVelocityPaper(secondHalf);

    const timeFirst = (firstHalf[firstHalf.length - 1].timestamp - firstHalf[0].timestamp) / 1000.0;
    const timeSecond = (secondHalf[secondHalf.length - 1].timestamp - secondHalf[0].timestamp) / 1000.0;
    const avgTime = (timeFirst + timeSecond) / 2;

    if (avgTime <= 0) {
      return { acceleration_ui: 0, x_axis_acceleration_ui: 0, y_axis_acceleration_ui: 0 };
    }

    return {
      acceleration_ui: Math.abs((v2Metrics.velocity_ui - v1Metrics.velocity_ui) / avgTime),
      x_axis_acceleration_ui: Math.abs((v2Metrics.x_axis_velocity_ui - v1Metrics.x_axis_velocity_ui) / avgTime),
      y_axis_acceleration_ui: Math.abs((v2Metrics.y_axis_velocity_ui - v1Metrics.y_axis_velocity_ui) / avgTime)
    };
  }
}

// Attach to window so content.js can use it
window.PowerSightRealTimeProcessor = RealTimeProcessor;
