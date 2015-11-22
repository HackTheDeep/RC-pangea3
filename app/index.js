import 'styles/style.scss';
import Api from './api';
import Points from './points';
import GeologicIntervals from 'json!json/geologic_intervals';
import topojsons from './geojson';
import worlds from './geojson';
import map from 'file!json/map';
import d3 from 'd3';
import _ from 'lodash';

let RECORDS = {};

Api.getInterval('Holocene').then((data)=> {
    console.log(data);
    const recs = getRecords(data.records);
    drawMap(recs);
});

function getRecords(records) {
    const data = {};
    for (let record of records) {
        if (!record || !('oid' in record)) {
            continue;
        }

        const oid = record.oid;
        if (data[oid]) {
            data[oid].push(record);
        } else {
            data[oid] = [record];
        }
    }

    return data;
}

function findDuplicates(records) {
    for (let oid in records) {
        const record = records[oid];
        if (record.length > 1) {
            const latlng = record.map((r, i) => {
                return `${r.lat}, ${r.lng}`;
            });
            console.log(latlng);
        }
    }
}

function drawMap(records) {
    const width = window.innerWidth, height = window.innerHeight - 150;
    let isRotating = false;
    let mousePos = [];

    const lambda = d3.scale.linear()
        .domain([0, width])
        .range([-360, 360]);

    const phi = d3.scale.linear()
        .domain([0, height])
        .range([180, -180]);

    const projection = d3.geo.orthographic()
        .scale(240)
        .translate([width / 2, height / 2])
        .clipAngle(90);

    const path = d3.geo.path()
        .projection(projection);

    projection.rotate([82, -44]);

    const mapMouseMove = () => {
        if (isRotating) {
            const [x, y] = [d3.event.pageX, d3.event.pageY];

            //console.log(lambda(x),phi(y))
            projection.rotate([lambda(x), phi(y)]);
            svg.selectAll('path.feature').attr('d', path);
            svg.selectAll('path.fossil').attr('d', function(d) {
                console.log(path(d)); return path(d);
            });
        }
    };

    const mapMouseDown = () => {
        d3.event.preventDefault();
        isRotating = true;
    };

    const mapMouseUp = () => {
        d3.event.preventDefault();
        isRotating = false;
    };

    // create map svg
    var svg = d3.select('#map').append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('id', 'svgmap')
        .on('mousedown', mapMouseDown)
        .on('mousemove', mapMouseMove)
        .on('mouseup', mapMouseUp);

    svg = d3.select('#svgmap')
        .attr('width', width)
        .attr('height', height);

    // create tooltip
    const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'map-tooltip')
        .style('position', 'absolute')
        .style('z-index', '10')
        .style('visibility', 'hidden')
        .style('left', '20px')
        .style('top', '20px')
        .text('a simple tooltip');

    let start;
    let year = 0;
    let locked = false;

    const yearContainer = document.getElementById('year');
    const geoIntervalContainer = document.getElementById('geo-interval');

    window.foo = (givenYear, records) => {
        if (!givenYear) {
            givenYear = year++;

        }

        if (givenYear < worlds.length) {
            render(worlds[givenYear], path, svg, tooltip, projection, (year) => {
                yearContainer.innerHTML = year;
            });
            const geojson = Points.generateGeoJson(records);
            Points.plotPoints(svg, path, projection, geojson);
        }
    };

    // setInterval(window.foo, 100)
    window.foo(0, records);

    const slider = document.getElementById('mya');
    slider.max = worlds.length;
    slider.addEventListener('input', (e)=> {
        const year = parseInt(e.target.value);
        const geoInterval = findGeoInterval(year);
        geoIntervalContainer.innerHTML = `${geoInterval}`;
        Api.getInterval(geoInterval).then((data)=> {
            console.log(data);
            const recs = getRecords(data.records);
            window.foo(year, recs);
        });

    });

}

let patch_cache = false;
const patch_fix = (geojson) => {

    geojson.features = _.filter(geojson.features, f => {
        return f.properties['NAME'] !== 'East Antarctica';
    });
    return geojson;
};

function findGeoInterval(year) {
    for (let interval of GeologicIntervals) {
        if (year >= interval.lag && year <= interval.eag) {

            console.log(interval);
            return interval.nam;
        }
    }
}

function render(mapUrl, path, svg, tooltip, projection, callback) {
    d3.json(mapUrl, function(error, world) {

        world = patch_fix(world);

        // remove all features
        d3.selectAll('path.feature').remove();

        const data = svg.selectAll('path.feature')
            .data(world.features);

        //plot map
        data.enter()
            .append('path')
            .attr('class', 'feature')
            .style('fill', 'rgba(100,100,100,0.1)')
            .style('stroke', 'grey')
            .attr('d', path)
            .attr('name', path)
            .on('mouseover', (d) => {
                const rect = d3.event.target.getBoundingClientRect();
                tooltip.text(d.properties['NAME'])
                    .style('top', `${Math.floor(rect.top + rect.height / 2)}px`)
                    .style('left', `${Math.floor(rect.left + rect.width / 2)}px`)
                    .style('visibility', 'visible');
            })
            .on('mouseout', (d) => {
                tooltip.style('visibility', 'hidden');
            });

        //plot points
        // svg.select('g.fossils').node()
        const fossil_points = svg.select('g.fossils').node();
        svg.node().removeChild(fossil_points);
        svg.node().appendChild(fossil_points);

        let year = world.features[0].properties.TIME;
        callback(year);
    });

}
