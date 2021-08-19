const setupBarGraphLayers = () => {

    const rows = constants.graphRows.State;

    map.addSource('barGraph', {
        type: 'geojson',
        data:{
            "type": "FeatureCollection",
            "features": []
        }
    })

    iterateBarLayers((r,i,t)=> {

        map.addLayer({
            id: r+t,
            type: 'fill-extrusion', 
            filter:['==', 'bar', i*rows.length + t],
            source:'barGraph',
            paint:{

                'fill-extrusion-color': constants.graphColors[i],
                'fill-extrusion-height': 0,
                'fill-extrusion-opacity': 0,
                'fill-extrusion-vertical-gradient': false,
                'fill-extrusion-color-transition': {
                    duration:100, 
                    delay:0
                }

            }
        })

    })


    map
    .addLayer({
            id: 'boundingWalls',
            type: 'fill-extrusion', 
            filter:['==', 'wall', true],
            source:'barGraph',
            paint:{
                'fill-extrusion-color': 'white',
                'fill-extrusion-base': ['*', [ '-', ["get",`index`], 1], constants.chart.altitude/5],

                'fill-extrusion-height': ['-',['*', ["get",`index`], constants.chart.altitude/5], constants.chart.altitude/200],
                'fill-extrusion-opacity': 0.75,
                'fill-extrusion-vertical-gradient': false            
            }
        })
    .addLayer({
        id:'graphLabels',
        type:'symbol',
        source: 'barGraph',
        filter:['!=', 'maxValue', 'true'],
        paint: {
            'text-color': '#44647e'
        },
        layout: {
            'text-field':'{text}',
            'text-anchor':{
                type: 'identity',
                property:'align'
            },
            // 'text-rotate': constants.barGraphAngle,
            'text-allow-overlap': true,
            'text-rotation-alignment': 'map',
            'text-pitch-alignment': 'map'
        }
    })
    .addLayer({
        id: 'custom', 
        type: 'custom',
        render: (a,b)=>state.cameraMatrix = b
    })
    .on('move', () => {

        if(!state.maxLabelMercator) return
        updateMaxLabel()

    })
}

const updateMaxLabel = () => {

    const ndc = applyMatrix4(state.maxLabelMercator, state.cameraMatrix);

    d3.select('#mark')
        .style('left', 50 + ndc.x * 50 + 'vw')
        .style('top', 50 - ndc.y * 50 + 'vh');

}

const countyAppend = props => props.s === 'Offshore' || props.s === 'Alaska' ? props.c : props.c + ' County, '

const iterateBarLayers = fn => {

    const rows = constants.graphRows.State;

    rows.forEach((row, rowIndex)=>{
        for (var t = 0; t<3; t++) fn(row, rowIndex, t)
    })

}

// change extrusion colors when highlighting
// if no input params, restore to default
const updateBarGraphColors = (scenario, decade) => {

    iterateBarLayers( (s, sI, t) => {

        const keepColor = s === scenario || !scenario;
        const barVisible = state.econData[state.level][state.currentLocation][state.statistic][s];

        map.setPaintProperty(
            s+t,
            'fill-extrusion-color',
            keepColor ? constants.graphColors[sI] : `#fff`
        )
        .setPaintProperty(
            s+t,
            'fill-extrusion-opacity',
            barVisible ? (keepColor ? 1 : 0.75) : 0
        )
    })
}

// change extrusion heights/baseline visibility with new statistics
const updateBarGraphLayers = clear => {

    const data = state.econData[state.level][state.currentLocation][state.statistic];

    const maxValue = Math.max(
        ...Object.entries(data)
            .map(d=>Math.max(...d[1]))
    ) || 1

    const graphMax = formatStatistic.getMax(maxValue);


    Object.entries(data)
        .forEach(([scenario, stats])=>{

            stats.forEach((n, i)=>{

                if (state.level === 'County') map.setPaintProperty('HighEV'+i, 'fill-extrusion-opacity', 0)

                map.setPaintProperty(
                    scenario+i, 
                    'fill-extrusion-height', 
                    clear ? 0 : 100 + constants.chart.altitude * n / graphMax
                )
                .setPaintProperty(
                    scenario+i, 
                    'fill-extrusion-opacity', 
                    data[scenario] ? 1 : 0
                )
                
            })
        })

    d3.select('#mark')
        .text(formatStatistic[state.statistic](graphMax).replace('.00',''))
};

const processCountyData = r => {

    var output = {}

    var countyStats = ['production', 'expenditure', 'tax', 'jobs'];
    r.forEach(d => {

        // first two columns are state and county
        var currentColumnIndex = 2;

        var sds = [0, 1, 2];
        var ssp4 = [3, 4, 5];
        var stps = [6, 7, 8];
        var baseline = [9, 10, 11];

        var countyEntry = {};

        countyStats.forEach(s=>{

            countyEntry[s] = {
                SDS: sds.map(index =>d[index+ currentColumnIndex]), 
                SSP4: ssp4.map(index =>d[index+ currentColumnIndex]),
                STPS: stps.map(index =>d[index+ currentColumnIndex]),   
                baseline: baseline.map(index =>d[index+ currentColumnIndex])
            }


            currentColumnIndex+=12

        })

        output[`${d[0]}_${d[1]}`] = countyEntry

    })

    return output
}

const processStateData = r => {

    var output = {}

    var countyStats = ['production', 'expenditure', 'tax', 'jobs'];
    r.forEach(d => {

        // first two columns are state and county
        var currentColumnIndex = 1;

        var sds = [0, 1, 2];
        var highEV = [3, 4, 5];
        var ssp4 = [6, 7, 8];
        var stps = [9, 10, 11];
        var baseline = [12, 13, 14];

        var countyEntry = {};

        countyStats.forEach(s=>{

            countyEntry[s] = {
                SDS: sds.map(index => d[ index + currentColumnIndex]), 
                HighEV: highEV.map(index => d[ index + currentColumnIndex]),
                SSP4: ssp4.map(index => d[ index + currentColumnIndex]),
                STPS: stps.map(index => d[ index + currentColumnIndex]),   
                baseline: baseline.map(index => d[ index + currentColumnIndex])
            }

            currentColumnIndex += 15

        })

        output[`${d[0]}_`] = countyEntry

    })

    return output
}


const generateBarGeometry = (center, barWidth, data) => {

    var fc = {
        "type": "FeatureCollection",
        "features": []
    }

    if (data) {

        center.lat -= 10;
        const [rows, columns] = [constants.graphRows.State.length, 3];
        const barHeight = barWidth/2;
        const middle = [center.lng, center.lat]
        center.lng -= barWidth * (columns-1);
        center.lat += barHeight * rows/2;

        // wall corners
        const west = center.lng - barWidth * 0.5;
        const east = center.lng + barWidth * 5.5;

        const wall = [
            [east, center.lat],
            [west, center.lat],
            [west, center.lat - barHeight * (rows+0.5)]
        ];

        for (var w=1; w<6; w++) {

            const boundingWalls = {
                "type": "Feature",
                "properties": {
                    wall: true,
                    index: w
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [east, center.lat],
                        [west, center.lat],
                        [west, center.lat - barHeight * (rows+0.5)]
                    ]
                }
            }

            fc.features.push(boundingWalls)
        }

        // floor
        fc.features.push({
            "type": "Feature",
            "properties": {
                wall: true,
                index: 0
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [wall.concat([
                    [east, center.lat - barHeight * (rows+0.5)],
                    [east, center.lat]
                ])]
            }
        })

        // building bars
        for (var r = 0; r<rows; r++) {

            var lat = center.lat - barHeight * r;
            if (state.level === 'County') lat -= barHeight

            for (var c = 0; c<columns; c++) {

                const lng = center.lng + c * barWidth * 2;
                const ring = [
                    [lng, lat],
                    [lng+barWidth, lat],
                    [lng+barWidth, lat - barHeight],
                    [lng, lat - barHeight],
                    [lng, lat]
                ]

                const polygon = {
                    "type": "Feature",
                    "properties": {
                        bar: r * rows + c
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [ring]
                    }
                }

                fc.features.push(polygon)

                // add text per column
                if (r === rows-1 ) {

                    const pt = {
                        "type": "Feature",
                        "properties": {
                            text: constants.decades[c],
                            align: 'center'
                        },
                        "geometry": {
                            "type": "Point",
                            "coordinates": [lng+barWidth/2, lat - barHeight*(state.level === 'State' ? 3 : 2)]
                        }
                    }

                    fc.features.push(pt)

                    if (c === 0) {
                        state.maxLabelMercator = mapboxgl.MercatorCoordinate.fromLngLat(
                            [lng - barHeight/2 - 1, lat + barHeight/2],
                            constants.chart.altitude+400000
                        );

                        updateMaxLabel()
                    }

                }


            }

            // vertical labels (scenarios)
            const lng = center.lng + (columns+1.75) * barWidth;
            const pt = {
                "type": "Feature",
                "properties": {
                    text: constants.graphRows[state.level][r],
                    align: 'left'
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [lng+barWidth, lat- barHeight/2]
                }
            }

            fc.features.push(pt)
        }

        turf.transformRotate(fc, constants.barGraphAngle, {
            mutate:true, 
            pivot:middle
        })
    }


    map.getSource('barGraph')
        .setData(fc)
}

const applyMatrix4 = ( v3, e) => {

    const x = v3.x, y = v3.y, z = v3.z;

    const w = 1 / ( e[ 3 ] * x + e[ 7 ] * y + e[ 11 ] * z + e[ 15 ] );

    return {
        x: ( e[ 0 ] * x + e[ 4 ] * y + e[ 8 ] * z + e[ 12 ] ) * w,
        y: ( e[ 1 ] * x + e[ 5 ] * y + e[ 9 ] * z + e[ 13 ] ) * w,
        z: ( e[ 2 ] * x + e[ 6 ] * y + e[ 10 ] * z + e[ 14 ] ) * w
    }

}

const formatStatistic = {

    order: n => {
        if (n<=9999) return n
        else if (n<1000000) return formatStatistic.conditionalDecimal(n/1000) + 'k'
        else if (n<1000000000) return formatStatistic.conditionalDecimal(n/1000000) + 'M'
        else return formatStatistic.conditionalDecimal(n/1000000000) + 'B'
    },
    conditionalDecimal: n => n % 1 ? n.toFixed(2) : Math.floor(n),
    production: n => formatStatistic.order(n * 1000000)+' mmboe/yr',
    expenditure: n => '$'+formatStatistic.order(n * 1000000)+'/yr',
    tax: n => '$'+formatStatistic.order(n * 1000000)+'/yr',
    jobs: n => formatStatistic.order(n)+' jobs',
    getMax: n => {
        const power = parseFloat(n.toExponential().split('e')[1]);

        const reduced = n/Math.pow(10,power);
        if (reduced<1.25) return Math.ceil(reduced/0.1) * 0.1 * Math.pow(10, power)
        return (Math.ceil(reduced/0.5) * 0.5 * Math.pow(10, power)).toFixed(2)

    }
}

const getBounds = polygon => {
    const coords = polygon.geometry.coordinates[0];
    var bounds = coords.reduce(
        function (bounds, coord) {
            return bounds.extend(coord);
        }, 
        new mapboxgl.LngLatBounds(coords[0], coords[0])
    );
    return bounds
}