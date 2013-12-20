#!/usr/bin/env node

/*
 * Check out http://freeradical.me for my adventures in running, cooking and
 * life outside work.
 */
var fs = require('fs');
var sprintf = require('sprintf-js').sprintf;
var vsprintf = require('sprintf-js').vsprintf;
var _ = require('underscore');
var colors = require('colors');

if (process.argv.length < 3) {
  console.log("Usage: stravit.js <json|gpx>");
  return;
}

var fname = process.argv[2];
var file;
try {
  file = fs.readFileSync(fname);
} catch (e) {
  console.log("Unable to load " + fname);
  return;
}

var data;
try {
  data = JSON.parse(file);
} catch (e) {
    console.log("Unable to parse " + fname);
}

Number.prototype.toFeet = function() {
  return this * 3.2808399;
};

Number.prototype.ppFeet = function() {
  return this.toFeet().toFixed(2) + 'ft';
};

Number.prototype.toMile = function() {
  return this * 0.00062137119;
};

Number.prototype.ppMile = function() {
  return 'mile ' + this.toMile().toFixed(2);
};

Number.prototype.ppMiles = function() {
  return this.toMile().toFixed(2) + ' miles';
};

Number.prototype.ppGrade = function() {
  return this.toFixed(2) + '% grade';
};

/*
   The Strava JSON captured from Chrome looks like this:
   data: { time: [], data.altitude: [], data.distance: [] }

                x--------------x-----------+
                |<..... 2 .....>        
    x-----------+<............ 3 ..........>
    1

    1 Each segment has the altitude (of the starting point)
    2 The start|end distances are from the points that make up the segment
    3 Span includes distance from the last point to the first of the next segment
    4 Gain/loss distance is from the last point to the first of the next segment
 */
function stravit(data) {
  // Compute flat stretches - a segment is either a single point or successive
  // points that have the same altitude
  var points = [];
  var segments = [];
  _.each(data.altitude, function(e, i) {
    points.push({ x: data.distance[i], y: e });
    var ls = _.last(segments);
    if (segments.length === 0 || ls.altitude !== e) {
      segments.push({ 
        altitude: e, 
        count: 1, 
        start_index: i, 
        start_distance: data.distance[i],
        end_index: i,
        end_distance: data.distance[i]
      });
    } else {
      ls.count++;
      ls.end_index++;
      ls.end_distance = data.distance[ls.end_index];
    }
  });
  
  // Elevation difference between points
  _.each(points, function(e, i) {
      var en = points[i+1];
      if (en) {
        e.ydiff = en.y - e.y;
      } else {
        e.ydiff = 0;
      }
  });

  // And distance span of each flat segment 
  _.each(segments, function(e, i) {
    var en = segments[i+1];
    if (en) {
      e.xspan = en.start_distance - e.start_distance;
      e.ydiff = en.altitude - e.altitude;
    } else {
      e.xspan = 0;
      e.ydiff = 0;
    }
  });

  // Metrics about the run
  var sd = { points: points, segments: segments };
  sd.min_elevation = _.min(sd.segments, function(e) { 
    return e.altitude; 
  }).altitude;

  sd.max_elevation = _.max(sd.segments, function(e) { 
    return e.altitude; 
  }).altitude;

  // up
  sd.up_segments = _.filter(sd.segments, function(e) {
    return e.ydiff > 0;
  });
  sd.total_up_distance = _.reduce(sd.up_segments, function(memo, obj) {
    if (obj.count === 1) {
      return memo + obj.xspan;
    } else {
      return memo + obj.xspan - (obj.end_distance - obj.start_distance);
    }
  }, 0);
  sd.total_elevation_gain = _.reduce(sd.up_segments, function(memo, obj) {
    return memo + obj.ydiff;
  }, 0);

  // down
  sd.down_segments = _.filter(sd.segments, function(e) {
    return e.ydiff < 0;
  });
  sd.total_down_distance = _.reduce(sd.down_segments, function(memo, obj) {
    if (obj.count === 1) {
      return memo + obj.xspan;
    } else {
      return memo + obj.xspan - (obj.end_distance - obj.start_distance);
    }
  }, 0);
  sd.total_elevation_loss = _.reduce(sd.down_segments, function(memo, obj) {
    return memo + obj.ydiff;
  }, 0);

  // flats
  sd.longest_flat_segment = _.max(sd.segments, function(e) {
    return e.count > 1 ? e.end_distance - e.start_distance : 0;
  });
  sd.total_flat_distance = _.reduce(sd.segments, function(memo, obj) {
    return memo + (obj.count > 1 ? obj.end_distance - obj.start_distance : 0);
  }, 0);

  // gain_loss_per_mile (array) - should give an indication of rolling
  var glpm = [];
  _.each(points, function(e) {
    if (glpm.length === 0 || e.x.toMile() > glpm.length) {
      glpm.push({ gain: 0, loss: 0, streak: 0 });
    } 

    var last = _.last(glpm);
    if (e.ydiff > 0) {
      last.gain += e.ydiff.toFeet();
    } else if (e.ydiff < 0) {
      last.loss += e.ydiff.toFeet();
    }
  });

  // Look for successive ascents or descents
  _.each(glpm, function(e, i) {
    var ep = glpm[i-1];
    if (ep) {
      var epnet = ep.gain + ep.loss;
      var enet = e.gain + e.loss;
      if (epnet > 0 && enet > 0) {
        ep.streak = 1;
        e.streak = 1;
      } else if (epnet < 0 && enet < 0) {
        ep.streak = -1;
        e.streak = -1;
      }
    }
  });

  sd.gain_loss_per_mile = glpm;
  return sd;
}

var sd = stravit(data);
var m;

function println(fmt) {
  var args = Array.prototype.slice.call(arguments);
  console.log(vsprintf(args[0], args.slice(1)));
}

println("%20s: %s", "total distance", _.last(data.distance).ppMiles());

var d = _.reduce(sd.segments, function(memo, obj) {
  return memo + obj.xspan;
}, 0);
println("%20s: %s", "total distance2", d.ppMiles());

_.each([ 
  'min_elevation', 'max_elevation', 'total_elevation_gain',
  'total_elevation_loss'
  ], function(e) {
    println("%20s: %s", e, sd[e].ppFeet());
});

m = sd.longest_flat_segment;
println("%20s: %s @ %s", 'longest flat segment', m.xspan.ppFeet(),
    m.start_distance.ppMile());

m = sd.total_flat_distance;
println("%20s: %s", 'flat distance', m.ppMiles());

m = sd.up_segments;
println("%20s: %s @ %s ft/mile", 'up distance', 
  sd.total_up_distance.ppMiles(), 
  (sd.total_elevation_gain.toFeet()/sd.total_up_distance.toMile()).toFixed(2));

m = sd.down_segments;
println("%20s: %s @ %s ft/mile", 'down distance', 
  sd.total_down_distance.ppMiles(), 
  (sd.total_elevation_loss.toFeet()/sd.total_down_distance.toMile()).toFixed(2));

console.log(sprintf("%20s  %-7s %-7s %-7s", "", "gain", "loss", "net").bold);
_.each(sd.gain_loss_per_mile, function(e, i) {
  var net = e.gain + e.loss;
  var str = sprintf("%20s: %7.2f %7.2f %s%-7.2f", "mile " + i,
    e.gain, e.loss, net > 0 ? '+' : net < 0 ? '-' : ' ', Math.abs(net));
  if (e.streak > 0) {
    str = str.red;
  } else if (e.streak < 0) {
    str = str.green;
  }
  console.log(str);
});
