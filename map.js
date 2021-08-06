mapboxgl.accessToken = 'pk.eyJ1IjoicGV0ZXJxbGl1IiwiYSI6ImNrbmdoM2d0cDBjeXAydnBjcTFvcDV4YWIifQ._dh1WoYUQQxa8qzjNXEPRQ';
var map = new mapboxgl.Map({
    container: 'map', // container id
    style: 'mapbox://styles/peterqliu/ckqioet7944wh17la7jhd24pa/draft', // style URL
    center: [-100, 40], // starting position [lng, lat]
    zoom: 4 // starting zoom
});

var tooltip = new mapboxgl.Popup({ 
    closeButton: false, 
    closeOnClick:false, 
    anchor:'left', 
    offset:10 
})
.addTo(map);

const updateVis = category => {

    if (category === 'level') {

        const stateLevel = state.level === 'State';
        map
            .setLayoutProperty('stat-label', 'visibility', stateLevel ? 'none': 'visible')
            .setLayoutProperty('counties-white-bg', 'visibility', stateLevel ? 'none': 'visible')
            .setLayoutProperty('states-white-bg', 'visibility', stateLevel ? 'visible': 'none')
        
        d3.select('#scenario')
            .attr('level', state.level)

            if (state.level === 'County' && state.scenario === 'HighEV'){
                console.log('mark')
                d3
                .select('#scenario')
                .attr('level', state.level)

                .selectAll('.toggle-container input')
                .attr('checked', (d,i)=> {
                    if (state.level === 'County' && state.scenario === 'HighEV') {
                        state.scenario = 'SDS';
                        return i === 0 ? 'checked' : null;
                    }

                    // else return d === state.scenario ? 'checked' : null;
                })
            }

        updateVis('visualize')
    }

    // toggling view between national and county
    else if (category === 'view') {

        d3.select('body')
            .attr('mode', state.view);

        const nationalView = state.view === 'national'
        var [s, c] = state.countyData.location.split('_');
        const visibility = nationalView ? 'visible' : 'none';
        map
            .setLayoutProperty(
                'counties-white-bg', 
                'visibility', 
                visibility
            )
            .setLayoutProperty(
                'counties-white-bg offshore', 
                'visibility', 
                visibility
            )
            .setLayoutProperty(
                'stat-label', 
                'visibility', 
                visibility
            )
            .setLayoutProperty(
                'counties', 
                'visibility', 
                visibility
            )
            .setLayoutProperty(
                'counties-offshore', 
                'visibility', 
                visibility
            )
            .setPaintProperty(
                'state-bg',
                'fill-opacity',
                nationalView ? 0.5 : 0
            )

        if (nationalView) {

            updateVis('visualize')

            generateBarGeometry() // clear geometry
            updateBarGraphLayers(true)
            map.easeTo({
                pitch:0, 
                zoom:4, 
                bearing:0,
                duration:200
            });
        }

        else {
            constants.layerModes
                .forEach((l,i)=>l.forEach(layer =>map.setLayoutProperty(layer, 'visibility', 'none')))
            return
        }
    }

    // toggling stranded data vis scheme
    else if (category === 'visualize') {

        const index = constants.visualizes.indexOf(state.visualize) + constants.levels.indexOf(state.level)*2;
        console.log(index)
        constants.layerModes
            .forEach((l,i)=>l.forEach(layer =>map.setLayoutProperty(layer, 'visibility', i===index ? 'visible' : 'none')))
        // map.easeTo({pitch: index === 2 ? 60 : 0})
        return
    }

    // toggling county stat to visualize (without changing county)
    else if (category === 'statistic') {
        updateBarGraphLayers();
        return
    }

    else if (category === 'scenario') console.log(state.scenario)
    // toggling scenario and products

    const prop = `${state.product}${state.scenario}`;
    const onlyWithLoss = ['all', ['has', prop]];
    const colorRamp = [
        "interpolate",
        ["linear"],['get', prop],
        0, '#eff0f0',
        0.001, "#ffd84d",
        1,"#dd2727"
    ]
    map
    // .setFilter(
    //     'counties', 
    //     onlyWithLoss
    // )
    .setPaintProperty(
        'counties',
        'fill-opacity',
        ['case', ['boolean', ['has', prop], true], 0.7, 0]
    )
    .setPaintProperty(
        'states',
        'fill-opacity',
        ['case', ['boolean', ['has', prop], true], 0.7, 0]
    )    

    // update filters to show only areas with loss
    .setFilter('states', onlyWithLoss)
    .setFilter(
        'counties-offshore', 
        onlyWithLoss
    )
    .setFilter(
        'stat-label', 
        onlyWithLoss
    )
    .setFilter(
        'stranded-volume-circle', 
        onlyWithLoss
    )
    .setFilter(
        'states-volume-circle', 
        onlyWithLoss
    )
    // update color ramps to visualize loss percentage

    // county fills
    .setPaintProperty(
        'counties',
        'fill-color',
        colorRamp
    )
    .setPaintProperty(
        'counties',
        'fill-outline-color',
        colorRamp
    )

    // state fills
    .setPaintProperty(
        'states',
        'fill-outline-color',
        colorRamp
    )
    .setPaintProperty(
        'states',
        'fill-color',
        colorRamp
    )
    .setPaintProperty(
        'counties-offshore',
        'circle-color',
        colorRamp
    )

    // county circle fills
    .setPaintProperty(
        'stranded-volume-circle',
        'circle-color',
        colorRamp
    )
    .setPaintProperty(
        'stranded-volume-circle',
        'circle-stroke-color',
        colorRamp
    )

    // state circle fills
    .setPaintProperty(
        'states-volume-circle',
        'circle-color',
        colorRamp
    )

    .setPaintProperty(
        'states-volume-circle',
        'circle-stroke-color',
        colorRamp
    )

    // county circle radius
    .setPaintProperty(
        'stranded-volume-circle', 
        'circle-radius', 
        // ["get",`${prop}Vol`],
        [
            'interpolate', ['exponential', 2], ['zoom'],
            4, ['*', ["sqrt",["get",`${prop}Vol`]], 1],
            22, ['*', ["sqrt",["get",`${prop}Vol`]], 160000],
        ]
        
    )

    // state circle radius
    .setPaintProperty(
        'states-volume-circle', 
        'circle-radius', 
        [
            'interpolate', ['exponential', 2], ['zoom'],
            4, ['*', ["sqrt",["get",`${prop}Vol`]], 0.5],
            22, ['*', ["sqrt",["get",`${prop}Vol`]], 160000],
        ]
        
    )
    .setLayoutProperty(
        'stat-label',
        'text-field',
        ["concat",
            ["get", 'c'], 
            // ' ',
            // prop+'Vol',
            ' ', 
            ["to-string",
                ["round",
                    ["*",
                        ["get", prop],100
                    ]
                ]
            ],"% ",
            // ["to-string",["get", `${prop}Vol`]],

        ]
    )

}


map.on('load', ()=> {

    updateVis(); 
    updateVis('visualize');
    setupBarGraphLayers();

    d3.json('countyData.json', (e,r) => {

        const countyData = processCountyData(r);
        map.on('click', e => {

            tooltip.remove();

            const h = map.queryRenderedFeatures(e.point, {layers:['counties-white-bg']});

            if (h[0]) {

                const props = h[0].properties;
                const pole = JSON.parse(props.pole).map(s=>parseFloat(s));

                map.easeTo({
                    // center:[pole[0], pole[1]+0.05], 
                    duration:200, 
                    zoom: 4, 
                    pitch: 60,
                    easing:t=>t
                });

                d3.select('#countyLabel')
                    .text(countyAppend(props))

                d3.select('#stateLabel')
                    .text(props.s)
                const location = `${props.s}_${props.c}`;
                state.countyData = countyData[location];
                state.countyData.location = location;

                generateBarGeometry(
                    map.getCenter(), 
                    4, 
                    state.countyData
                );

                state.view = 'county';
                updateVis('view');

                map.once('moveend', ()=> {
                    updateBarGraphLayers(); 
                    setTimeout(()=>updateMaxLabel(), 1); 
                })

            }

        })
    })

    map.on('mousemove', e => {

        if (state.view === 'county') {

            const h = map.queryRenderedFeatures(e.point);
            const bar = h.find(l=>l.layer.type ==='fill-extrusion' && l.layer.id !=='boundingWalls');

            if (!bar || isNaN(bar.properties.bar)) {
                tooltip.remove();
                if (state.currentBarIndex>=0){
                    state.currentBarIndex = undefined;
                    updateBarGraphColors()
                }
                return
            }

            tooltip
                .setLngLat(map.unproject(e.point));

            const barIndex = bar.properties.bar;

            // exit if same highlight as before
            if (barIndex === state.currentBarIndex) return
            tooltip
                .addTo(map)

            state.currentBarIndex = barIndex;

            const scenario = constants.graphRows[Math.floor(barIndex/constants.graphRows.length)];
            const decade = barIndex % constants.graphRows.length
            const number = state.countyData[state.statistic][scenario][decade]
            tooltip.setHTML(`<div class="txt-h5">${formatStatistic[state.statistic](number)}</div>`)

            updateBarGraphColors(scenario, decade)
        }

        else {

            const h = map.queryRenderedFeatures(e.point, {layers:['counties-white-bg', 'states-white-bg']});

            if (h[0]) {

                const props = h[0].properties;
                const stat = props[state.product+state.scenario]
                const strandedStatement = Math.round(stat*100)+ '% stranded in '+ state.scenario;
                tooltip
                    .setHTML(`<b>${state.level === 'County' ? countyAppend(props) : ''} ${props.s}</b>
                        <br>${strandedStatement}<br>
                        <i>Click to view economic projections</i>`)
                    .setLngLat(map.unproject(e.point))
                    .addTo(map)   
            }

            else tooltip.remove()
        
        }
    })  

})
  