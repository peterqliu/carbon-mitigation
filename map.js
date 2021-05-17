const setupBarGraphLayers = () => {

    const rows = constants.graphRows;

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
                'fill-extrusion-height':0,
                'fill-extrusion-vertical-gradient': false,
                'fill-extrusion-color-transition':{duration:100, delay:0}
            }
        })
    })


    map.addLayer({
        id:'graphLabels',
        type:'symbol',
        source: 'barGraph',
        paint: {
            'text-color': '#44647e'
        },
        layout: {
            'text-field':'{text}',
            'text-anchor':{
                type: 'identity',
                property:'align'
            },
            'text-rotate': constants.barGraphAngle,
            'text-allow-overlap': true,
            'text-rotation-alignment': 'map',
            'text-pitch-alignment': 'map'
        }
    })
}

const countyAppend = props => props.s ==='Offshore' || props.s === 'Alaska' ? props.c : props.c + ' County,' 

const iterateBarLayers = fn => {
    const rows = constants.graphRows;

    rows.forEach((row, rowIndex)=>{
        for (var t = 0; t<3; t++) fn(row, rowIndex, t)
    })
}

// change extrusion colors when highlighting
// if no input params, restore to default
const updateBarGraphColors = (scenario, decade) => {

    iterateBarLayers((s, sI, t)=> {

        const keepColor = s === scenario || !scenario;
        const barVisible = state.countyData[state.statistic][s];

        map.setPaintProperty(
            s+t,
            'fill-extrusion-color',
            keepColor ? constants.graphColors[sI] : `#fff`
        )
        .setPaintProperty(
            s+t,
            'fill-extrusion-opacity',
            barVisible ? (keepColor ? 1 : 0.5) : 0
        )
    })
}
// change extrusion heights/baseline visibility with new statistics
const updateBarGraphLayers = clear => {

    const data = state.countyData[state.statistic];
    const maxValue = Math.max(
        ...Object.entries(data)
            .map(d=>Math.max(...d[1]))
    ) || 1

    Object.entries(data)
        .forEach(([scenario, stats])=>{
            stats.forEach((n, i)=>{
                map.setPaintProperty(
                    scenario+i, 
                    'fill-extrusion-height', 
                    clear ? 0 : n * 15000 / maxValue
                )
                .setPaintProperty(
                    scenario+i, 
                    'fill-extrusion-opacity', 
                    1
                )
            })
        })

    for (var t = 0; t<3; t++) map.setPaintProperty('baseline'+t, 'fill-extrusion-opacity', data.baseline ? 1 : 0 )
    
    map.setFilter('graphLabels', ['!=', 'text', data.baseline ? 'undefined' : 'baseline'])
};

const processCountyData = r => {

	var output = {}

	var countyStats = ['production', 'expenditure', 'tax'];
	r.forEach(d => {

    	var currentColumnIndex = 2;

		var sds = [0, 1, 2];
		var ssp4 = [3, 4, 5];
		var stps = [6, 7, 8];

		var countyEntry = {};

		countyStats.forEach(s=>{

			countyEntry[s] = {
		    	SDS: sds.map(index =>d[index+ currentColumnIndex]),	
		    	SSP4: ssp4.map(index =>d[index+ currentColumnIndex]),
		    	STPS: stps.map(index =>d[index+ currentColumnIndex]),	
		    }

		    if (s === 'production') {

		    	var baseline = [9, 10, 11];
		    	Object.assign(countyEntry.production,{
		    		baseline: baseline.map(index =>d[index+ currentColumnIndex]),
		    	})

		    	currentColumnIndex+=3
		    }

		    currentColumnIndex+=3

		})

		output[`${d[0]}_${d[1]}`] = countyEntry

	})

	return output
}

const generateBarGeometry = (center, barWidth, data) => {

    var fc = {
        "type": "FeatureCollection",
        "features": []
    }

    if (data) {
        const [rows, columns] = [4, 4];

        const barHeight = barWidth/2;
        const middle = [center.lng, center.lat]
        center.lng -= barWidth * (columns-1);
        center.lat += barHeight * rows/2;

        for (var r = 0; r<rows; r++) {

            const lat = center.lat - r * barHeight;

            for (var c = 0; c<columns; c++) {
            
                const lng = center.lng+c*barWidth*2;

                const ring = [
                    [lng, lat],
                    [lng+barWidth, lat],
                    [lng+barWidth, lat -barHeight],
                    [lng, lat -barHeight],
                    [lng, lat]
                ]

                const polygon = {
                    "type": "Feature",
                    "properties": {
                        bar: r*rows + c
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [ring]
                    }
                }

                fc.features.push(polygon)

                if (r === rows-1) {


                    const pt = {
                        "type": "Feature",
                        "properties": {
                            text: constants.decades[c],
                            align: 'center'
                        },
                        "geometry": {
                            "type": "Point",
                            "coordinates": [lng+barWidth/2, lat - barHeight*2]
                        }
                    }

                    fc.features.push(pt)
                }
            }

            // vertical labels (scenarios)
            const lng = center.lng + (columns+1.75) * barWidth;
            const pt = {
                "type": "Feature",
                "properties": {
                    text: constants.graphRows[r],
                    align: 'left'
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [lng-barWidth/2, lat- barHeight/2]
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

const formatStatistic = {

    order: n => {
        if (n<1000000) return n/1000 + 'k'
        else if (n<1000000000) return n/1000000 + ' million'
        else return n/1000000000 + ' billion'
    },
    production: n => formatStatistic.order(n * 1000000)+' bbl/year',
    expenditure: n => '$'+formatStatistic.order(n * 1000000)+'/year',
    tax: n => '$'+formatStatistic.order(n * 1000000)+'/year'

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