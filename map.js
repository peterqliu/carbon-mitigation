mapboxgl.accessToken = 'pk.eyJ1IjoicGV0ZXJxbGl1IiwiYSI6ImNrbmdoM2d0cDBjeXAydnBjcTFvcDV4YWIifQ._dh1WoYUQQxa8qzjNXEPRQ';
var map = new mapboxgl.Map({
    container: 'map', // container id
    style: 'mapbox://styles/peterqliu/ckoox661f9qim17lj6qddz0yf', // style URL
    center: [-100, 40], // starting position [lng, lat]
    zoom: 4 // starting zoom
});

var tooltip = new mapboxgl.Popup({ closeButton: false, closeOnClick:false, anchor:'left', offset:10 })
    .addTo(map)
    const updateVis = category => {

        // toggling view between national and county
        if (category === 'view') {

            d3.select('body')
                .attr('mode', state.view);

            const nationalView = state.view === 'national'
            var [s, c] = state.countyData.location.split('_');

            map
                .setFilter('counties', ['all', ['==', 's', 'none'], ['==', 'c', c]])
                .setPaintProperty(
                    'counties', 
                    'fill-color', 
                    nationalView ? 'white' : '#eff0f0' 
                )
                .setPaintProperty(
                    'states-9kg7xn', 
                    'fill-color', 
                    nationalView ? '#eff0f0' : '#c2cdd6'
                )
                .setLayoutProperty('stat-label', 'visibility', nationalView ? 'visible' : 'none')

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
                    .forEach((l,i)=>map.setLayoutProperty(l, 'visibility', l ==='counties' ? 'visible' : 'none'))
                return
            }
        }

        // toggling stranded data vis scheme
        else if (category === 'visualize') {

            const index = constants.visualizes.indexOf(state.visualize);

            constants.layerModes
                .forEach((l,i)=>map.setLayoutProperty(l, 'visibility', i===index ? 'visible' : 'none'))
            map.easeTo({pitch: index === 2 ? 60 : 0})
            return
        }

        // toggling county stat to visualize (without changing county)
        else if (category === 'statistic') {
            updateBarGraphLayers();
            // map.setPaintProperty('counties', 'fill-opacity', 0)
            return
        }

        // toggling scenario and products
        const prop = `${state.product}${state.scenario}`;
        const onlyWithLoss = ['>', prop, 0.005];

        const colorRamp = [
            "interpolate",
            ["linear"],["get", prop],
            0,"#ffd84d",
            1,"#dd2727"
        ]
        map
        .setFilter(
            'counties', 
            onlyWithLoss
        )
        .setPaintProperty(
            'counties',
            'fill-color',
            colorRamp
        )
        .setFilter(
            'stranded-volume-circle', 
            onlyWithLoss
        )
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
        .setFilter(
            'stranded-volume', 
            onlyWithLoss
        )
        .setPaintProperty(
            'stranded-volume', 
            'fill-extrusion-height',
            [ 
                "/", 
                ["*",["get",`${prop}Vol`],1000000],
                100
            ]
        )
        .setPaintProperty(
            'stranded-volume', 
            'fill-extrusion-color',
            colorRamp
        )

        console.log(prop)
        // tooltip.remove()

    }


    map.on('load', ()=> {

        updateVis(); 
        updateVis('visualize');
        setupBarGraphLayers();

        d3.json('data/countyData.json', (e,r) => {

            const countyData = processCountyData(r);
            map.on('click', e => {

                tooltip.remove();

                const h = map.queryRenderedFeatures(e.point, {layers:['county-hittest']});

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

                    const barGeometry = generateBarGeometry(
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

                const h = map.queryRenderedFeatures(e.point, {layers:['county-hittest']});

                if (h[0]) {

                    const props = h[0].properties;
                    const stat = Math.round(props[state.product+state.scenario])
                    
                    tooltip
                        .setHTML(`${countyAppend(props)} ${props.s}`)
                        .setLngLat(map.unproject(e.point))
                        .addTo(map)   
                }

                else tooltip.remove()
            
            }
        })  

    })
  