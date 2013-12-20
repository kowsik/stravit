stravit
=======

Quick hack to analyze Strava's data to generate summaries of courses. Wrote
this to better understand my first 50 miler, the Lake Sonoma 50. The input
file (until I add GPX support) is the JSON data extracted from Chrome's
developer console. Here's the
[blog](http://freeradical.me/2014/12/19/hacking-first-50-miler-ultra-marathon-code/) on tackling my first 50 miler with code.

Here's a sample output:

    $ ./stravit.js /tmp/pg.json
          total distance: 9.72 miles
         total distance2: 9.72 miles
           min_elevation: 339.24ft
           max_elevation: 1646.98ft
    total_elevation_gain: 3423.56ft
    total_elevation_loss: -3433.40ft
    longest flat segment: 100.07ft @ mile 7.63
           flat distance: 0.88 miles
             up distance: 4.37 miles @ 784.02 ft/mile
           down distance: 4.47 miles @ -767.57 ft/mile
                      gain    loss    net    
              mile 0:  448.49  -93.18 +355.31 
              mile 1:  370.08 -255.25 +114.83 
              mile 2:  704.72 -419.29 +285.43 
              mile 3:  651.25 -293.64 +357.61 
              mile 4:  325.46 -548.23 -222.77 
              mile 5:  221.78 -476.05 -254.27 
              mile 6:  426.51 -807.09 -380.58 
              mile 7:  104.99 -268.70 -163.71 
              mile 8:  104.33 -202.43 -98.10  
              mile 9:   65.94  -69.55 -3.61   

A segment is either a point or a span of multiple points that have the same
altitude. In the mile-by-mile table, each number is the elevation gain/loss in
feet.
