mapboxgl.accessToken = 'pk.eyJ1IjoiYnJlYWt0aHJvdWdoLW1hcHMiLCJhIjoiY2t0MXhjcjh6MGZrdzJubzJpbXJ6ODczMiJ9.5rvh7Oj4MJOraoG2FcSrxw';
var map = new mapboxgl.Map({
    container: 'map', // container id
    style: 'mapbox://styles/peterqliu/cl98303v9000214mukcsko3r2', // style URL
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

    // visualizing state vs county
    if (category === 'level') {
        console.log('level', state.level)
        const stateLevel = state.level === 'State';
        map
            .setLayoutProperty('stat-label', 'visibility', stateLevel ? 'none': 'visible')
            .setLayoutProperty('county-bg', 'visibility', stateLevel ? 'none': 'visible')
            .setLayoutProperty('county-border', 'visibility', stateLevel ? 'none': 'visible')
  
        d3.select('#scenario')
            .attr('level', state.level)

        if (state.level === 'County' && state.scenario === 'HighEV'){

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

    // toggling view between map and graph
    else if (category === 'view') {

        d3.select('body')
            .attr('mode', state.view);

        const mapView = state.view === 'map'
        const visibility = mapView ? 'visible' : 'none';
        const countiesVisible = mapView && state.level === 'County' ? 'visible' : 'none';

        // toggle map elements
        map
            .setLayoutProperty(
                'county-bg', 
                'visibility', 
                countiesVisible
            )
            .setLayoutProperty(
                'state-bg', 
                'visibility', 
                visibility
            )

            .setLayoutProperty(
                'stat-label', 
                'visibility', 
                countiesVisible
            )


        if (mapView) {

            updateVis('visualize')

            generateBarGeometry() // clear geometry
            updateBarGraphLayers(true)
            map.easeTo({
                pitch:0, 
                zoom:3, 
                bearing:0,
                duration:250
            });

            map.dragPan.enable();

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

    // toggling scenario and products

    const prop = `${state.product}${state.scenario}`;
    const onlyWithLoss = ['all', ['has', prop]];
    const colorRamp = [
        "interpolate",
        ["linear"],['get', prop],
        0, '#e5e6e6',
        0.001, "#ffd84d",
        1,"#dd2727"
    ]
    map
    .setFilter(
        'counties', 
        onlyWithLoss
    )
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
        state.econData.County = countyData;

        map.on('click', e => {

            tooltip.remove();

            const h = map.queryRenderedFeatures(e.point, {layers:[`${state.level.toLowerCase()}-bg`, 'counties-offshore', 'stranded-volume-circle']});

            if (h[0]) {
                console.log(h[0])
                const props = h[0].properties;
                const pole = JSON.parse(props.pole).map(s=>parseFloat(s));

                map.easeTo({
                    center: [-100, 40], 
                    duration:200, 
                    zoom: 3.5, 
                    pitch: 60,
                    easing: t => t
                });

                map.dragPan.disable();

                d3.select('#countyLabel')
                    .text(placeName(props))

                d3.select('#stateLabel')
                    .text(props.s)

                const location = `${props.s}_${props.c || ''}`;
                state.currentLocation = location;

                generateBarGeometry(
                    {lng: -100, lat:40},
                    4, 
                    state.econData[state.level][state.currentLocation]
                );

                state.view = 'graph';
                updateVis('view');

                map.once('moveend', ()=> {
                    updateBarGraphLayers(); 
                    setTimeout(()=>updateMaxLabel(), 1); 
                })

            }

        })
    })

    map.on('mousemove', e => {

        // if looking at bar graph
        if (state.view === 'graph') {

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

            const scenario = constants.graphRows.State[Math.floor(barIndex/constants.graphRows.State.length)];
            const decade = barIndex % constants.graphRows.State.length
            const number = state.econData[state.level][state.currentLocation][state.statistic][scenario][decade]
            const context = `projected annually for ${constants.decades[decade]},<br> given <span class='color-gray-deep'>${scenario}</span> conditions`;
            tooltip.setHTML(
                `<div class="txt-h5" style='color:#44647e'>${formatStatistic[state.statistic](number)}</div>
                <p class='quiet'>${context}</p>`
                )

            updateBarGraphColors(scenario, decade)
        }

        // if viewing map
        else {
    
            const targetLayer = `${state.level.toLowerCase()}-bg`

            const h = map.queryRenderedFeatures(e.point, {layers:[targetLayer, 'counties-offshore', 'stranded-volume-circle']});

            if (h[0]) {

                const props = h[0].properties;
                const stat = props[state.product+state.scenario]
                
                const strandedStatement = stat ? `${Math.round(stat*100)}% ${state.product.toLowerCase()} production stranded in ${state.scenario}`
                : `${state.product} production unaffected under ${state.scenario}`

                tooltip
                    .setHTML(`<div class='txt-h5 txt-nowrap' style='color:#44647e'>${placeName(props)}</div>
                        <p>${strandedStatement}<br>
                        <i class='quiet'>Click for economic projections</i>
                        </p>`)
                    .setLngLat(map.unproject(e.point))
                    .addTo(map)   
            }

            else tooltip.remove()
        
        }
    })  

})

const placeName = props => {

    if (state.level === 'State') return props.s

    else return `${props.c}${props.s === 'Offshore' ? '': ' County'}, ${props.s}`
}
  
