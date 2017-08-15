var xhr = new XMLHttpRequest()
var mapSpend;

var currency = {
  'codes': currcodes,
  getCurrencySymbol: function(code){
    for (var key in this.codes){
      if (key == code) return this.codes[key]
    }
  }
}

var user = {
  'acc_string': '&account_id=',
  'acc_id': '',
  'access_token': '',
  'who': '/ping/whoami?',
  'getAccount': '/accounts?',
  'getBalance': '/balance?',
  'getBasicTrans': '/transactions?',
  'getAdvTrans': '/transactions?expand[]=merchant',
  getData: function(){
    monzoapi.makeCall(this.getAdvTrans);
  }
}

var monzoapi = {
  'api_url': 'https://api.monzo.com',
  makeCall: function(type){
    const endpoint = this.api_url + type + user.acc_string + user.acc_id;
    xhr.open("GET", endpoint, true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + user.access_token);
    xhr.send();
    xhr.onpgrogess = type;
  }
}

xhr.onload = function (e) {
  if (xhr.readyState === 4) {
    if (xhr.status === 200) {
      console.log('Data fetched');
      callbackHandler(xhr.responseText, xhr.onpgrogess);
    }
    else {
      console.log('Error;', xhr.responseText);
      let errorBox = select('#login-error');
      errorBox.style('visibility', 'visible');
      setInterval(function(){ errorBox.style('visibility', 'hidden'); }, 4000);
    }
  }
};

function callbackHandler(reponse, type){
  if (type == '/transactions?expand[]=merchant'){
    let mainArr = {};
    let totalAmount = 0;
    let totalTransaction = 0;
    let topMerchant = {'name' : 'Intial', 'spend': 0};
    user.data = JSON.parse(reponse);
    //loop through and add labels to object
    for (i = 0; i < user.data.transactions.length; i++){
      if (user.data.transactions[i].amount < 0 && user.data.transactions[i].include_in_spending == true && user.data.transactions[i].merchant != null){
        totalAmount += (user.data.transactions[i].amount*-1);
        totalTransaction++;
        let key = user.data.transactions[i].merchant.id;
        mainArr[key] = {
          'name': user.data.transactions[i].merchant.name,
          'long': user.data.transactions[i].merchant.address.longitude,
          'lat': user.data.transactions[i].merchant.address.latitude,
          'google': user.data.transactions[i].merchant.metadata.google_places_icon,
          'category': user.data.transactions[i].category,
          'currency': user.data.transactions[i].currency,
          'country': user.data.transactions[i].merchant.address.country,
          'spend': 0,
          'trans': 0,
        }
      }
    }
    //add spends to object & trans
    for (i = 0; i < user.data.transactions.length; i++){
      if (user.data.transactions[i].amount < 0 && user.data.transactions[i].include_in_spending == true && user.data.transactions[i].merchant != null){
        let key = user.data.transactions[i].merchant.id;
        mainArr[key].spend = mainArr[key].spend + (user.data.transactions[i].amount * -1);
        mainArr[key].trans += 1;
        //test and assign top merchant
        if (mainArr[key].spend > topMerchant.spend){
          topMerchant.name = mainArr[key].name;
          topMerchant.spend = mainArr[key].spend;
          topMerchant.geo = {'lng': mainArr[key].long, 'lat': mainArr[key].lat};  //{lng: -2.21850099, lat: 53.839239}
          topMerchant.trans = mainArr[key].trans;
          topMerchant.country = mainArr[key].country;
          user.currency = mainArr[key].currency;
        }
      }
    }
    console.log('Data parsed');
    user.locations = mainArr;
    user.transTotal = (totalAmount/100);
    user.totalTransaction = totalTransaction;
    user.topMerch = [topMerchant.name,penceToPounds(topMerchant.spend/100),topMerchant.geo,topMerchant.trans];
    let len = user.data.transactions.length;
    user.dates = {
      'first': user.data.transactions[0].created,
      'last': user.data.transactions[len-1].created,
      'spend': {},
      'max_spend': 0,
      'spend_array': [],
      difference: function(){
        return dayDifference(this.first, this.last)
      },
      spendByDate: function(){
        let diff = this.difference(this.first,this.last)
        //loop through all dates and set 0 values
        for (i = 0; i < diff; i++){
          let baseDate = new Date(this.first);
          let newDate = new Date(baseDate.getTime() );
          newDate.setDate(newDate.getDate() + i);
          let key = newDate.toDateString();
          this.spend[key] = 0;
        }
        //loop through transactions and add values to dates
        for (i = 0; i < user.data.transactions.length; i++){
          if (user.data.transactions[i].include_in_spending){
            let tempDate = new Date(user.data.transactions[i].created);
            let key = tempDate.toDateString();
            this.spend[key] =+ user.data.transactions[i].amount * -1;
          }
        }
        //add max daily spend to user object
        for (var key in this.spend){
          if (this.spend[key] > this.max_spend) this.max_spend = this.spend[key];
        }
        return this.spend
      }
    }

    //define where to load after login
    //mapSpend.setCenter(calculateMapCentre(user.locations));
    mapSpend.setCenter(pickRandomPoint(user.locations));
    //flyToRandom(pickRandomPoint(user.locations)); //flies to random point after login

    let mData = createMapboxJSON(user.locations, 'Point');
    let pData = createMapboxJSON(user.locations, 'Polygon');
    if (mData != undefined) mapSpend.getSource('purchases').setData(mData);
    addHeatmap();
    addCircles();
    if (mData != undefined) mapSpend.getSource('heatspends').setData(mData);
    if (mData != undefined) mapSpend.getSource('dynamic-circles').setData(mData);
    if (pData != undefined) mapSpend.getSource('room-extrusion').setData(pData);
    //console.log(mapSpend);
    user.geojson = mData;
    user.polyjson = pData;
    buildCategoryFeed();
    user.dates.spendByDate();
    populateStatsDOM();
  }
}

function preload(){
  mapboxgl.accessToken = 'pk.eyJ1IjoicGhpbGF0dXJuZXIiLCJhIjoiY2oyMzl2bmg1MDAxbDJ3bXVzdTQ2YzFwNCJ9.DYG613tp1aT7jYZdPCbUQw';
  //noCanvas();
}

function intialCall(sampledata){
  console.log('Getting Data');
  if(!sampledata){
    let atoken = select('#atoken');
    let uacc = select('#uacc');
    user.access_token = atoken.value();
    user.acc_id = uacc.value();
    user.getData();
  } else {
    console.log('Using sample data');
    loadJSON('data/sample-data.json', gotData);
  }
}

function gotData(data){
  let dataStr = JSON.stringify(data);
  callbackHandler(dataStr,user.getAdvTrans);
}

function setup(){
  //button event listeners
  document.getElementById("btnsubmit").addEventListener("click", function(){
    intialCall(false);
  });
  document.getElementById("samplesubmit").addEventListener("click", function(){
    intialCall(true);
  });

  document.getElementById('fly').addEventListener('click', function() {
    console.log('Button Click');
    flyToRandom(user.topMerch[2]); //fly to top trans
  });

  mapSpend = new mapboxgl.Map({
    container: 'map', // container id
    style: 'mapbox://styles/mapbox/dark-v9', // map style
    center: [-2.2, 53.48], // default position [lng, lat]
    //zoom: 8
    zoom: 15.2,
    pitch: 40
    //bearing: 20
     // starting zoom
  });
  mapSpend.on('load', function () {
      //addHeatmap();
      mapSpend.addSource('purchases', { type: 'geojson', data: null });  //load with null data until we populate
      mapSpend.addLayer({
          "id": "purchases",
          "type": "symbol",
          "source": "purchases",
          "layout": {
              "visibility": "none",
               "icon-image": "marker-15",
          }
      });

      //3d building layer
      // mapSpend.addLayer({
      //   'id': '3d-buildings',
      //   'source': 'composite',
      //   'source-layer': 'building',
      //   'filter': ['==', 'extrude', 'true'],
      //   'type': 'fill-extrusion',
      //   'minzoom': 10,
      //   'paint': {
      //     'fill-extrusion-color': '#9a9a9a',
      //     'fill-extrusion-height': {
      //       'type': 'identity',
      //       'property': 'height'
      //     },
      //     'fill-extrusion-base': {
      //       'type': 'identity',
      //       'property': 'min_height'
      //     },
      //     'fill-extrusion-opacity': 0.4
      //   }
      // });
  //addHeatmap();
  });

  // mapSpend.on('click', 'dynamic-circles', function (e) {
  //   new mapboxgl.Popup()
  //       .setLngLat(e.features[0].geometry.coordinates)
  //       .setHTML(e.features[0].properties.description)
  //       .addTo(mapSpend);
  // });

  //TODO Fix console error spam
  var markerHeight = 50, markerRadius = 10, linearOffset = 25;
  var popupOffsets = {
   'top': [0, 0],
   'top-left': [markerHeight/3,markerHeight/3],
   'top-right': [0,0],
   'bottom': [0, -markerHeight],
   'bottom-left': [linearOffset, (markerHeight - markerRadius + linearOffset) * -1],
   'bottom-right': [-linearOffset, (markerHeight - markerRadius + linearOffset) * -1],
   'left': [markerRadius, (markerHeight - markerRadius) * -1],
   'right': [-markerRadius, (markerHeight - markerRadius) * -1]
  };

    var div = window.document.createElement('tooltip');
    //div.innerHTML = buildPopupDesc()
    var popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: popupOffsets,
      anchor: 'top-left'
    })

    var div1 = document.getElementById("tooltip");

    mapSpend.on('click', 'purchases', function (e) {
      div1.innerHTML = e.features[0].properties.c;
      new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: true,
        offset: popupOffsets,
        anchor: 'top-left'
      })
          .setLngLat(e.features[0].geometry.coordinates)
          .setDOMContent(div1)
          .addTo(mapSpend);
    });

    mapSpend.on('mouseenter', 'dynamic-circles', function(e) {
      mapSpend.getCanvas().style.cursor = 'pointer';
      div1.innerHTML = e.features[0].properties.c;
      popup.setLngLat(e.features[0].geometry.coordinates)
          .setDOMContent(div1)
          .addTo(mapSpend);
    });

    mapSpend.on('mouseleave', 'dynamic-circles', function() {
      mapSpend.getCanvas().style.cursor = '';
      popup.remove();
    });

    //increase the opacity of the block on mouse hover
    mapSpend.on('mouseenter', 'room-extrusion', function(e) {
      mapSpend.setPaintProperty('room-extrusion', 'fill-extrusion-opacity', 1);
    });

    mapSpend.on('mouseleave', 'room-extrusion', function() {
      mapSpend.setPaintProperty('room-extrusion', 'fill-extrusion-opacity', 0.5);
    });

    mapSpend.on('moveend', function() {
      if (mapSpend.getZoom() < 3.5){
        console.log('show something');
      }
    });

  var toggleableLayerLabels = ['towers', 'circles', 'markers', 'heatmap'];
  var toggleableLayerIds = ['room-extrusion', 'dynamic-circles','purchases', 'heatmap'];

  for (var i = 0; i < toggleableLayerIds.length; i++) {
      var id = toggleableLayerIds[i];
      var label = toggleableLayerLabels[i];
      var clusters = ['cluster-0', 'cluster-1', 'cluster-2'] //add clusters


      var link = document.createElement('a');
      link.href = '#';
      //only make circles active
      if (id == 'dynamic-circles' || id == 'room-extrusion') {
        link.className = 'active';
      } else {
        link.className = '';
      }
      link.textContent = label;
      link.idContent = id;


      link.onclick = function (e) {
          var clickedLayer = this.idContent;
          e.preventDefault();
          e.stopPropagation();

          var visibility = mapSpend.getLayoutProperty(clickedLayer, 'visibility');

          if (visibility === 'visible') {
              mapSpend.setLayoutProperty(clickedLayer, 'visibility', 'none');
              this.className = '';
              //check for heatmap and turn off clusters
              if (this.idContent == 'heatmap'){
                for (i = 0; i < clusters.length; i++){
                  let clusterLayer = clusters[i];
                  mapSpend.setLayoutProperty(clusterLayer, 'visibility', 'none');
                }
              }

          } else {
              this.className = 'active';
              mapSpend.setLayoutProperty(clickedLayer, 'visibility', 'visible');
              //check for heatmap and turn on clusters
              if (this.idContent == 'heatmap'){
                for (i = 0; i < clusters.length; i++){
                  let clusterLayer = clusters[i];
                  mapSpend.setLayoutProperty(clusterLayer, 'visibility', 'visible');
                }
              }
          }
      };

      var layers = document.getElementById('menu');
      layers.appendChild(link);
  }
}

function populateStatsDOM(){
  console.log('Adding stats to DOM');
  // let statBox = select('#stat-text');
  // statBox.style('visibility', 'visible');
  let amount = select('#value');
  let transTot = select('#trans');
  let topMerc = select('#merchant');
  amount.elt.innerText = user.transTotal;
  transTot.elt.innerText = user.totalTransaction;
  let mercString = ' ' + user.topMerch[0] + ' (' + currency.getCurrencySymbol(user.currency) + user.topMerch[1] + ')';
  topMerc.elt.innerText = mercString;

  let loginForm = select('#login-form');
  loginForm.style('visibility', 'hidden');
  let menu = select('#menu');
  menu.style('visibility', 'visible');
  let feed = select('#feed');
  feed.style('visibility', 'visible');
  let tooltips = select('#tooltip');
  tooltips.style('visibility', 'visible');
  let flyButton = select('#fly');
  flyButton.style('visibility', 'visible');

  let graphBlock = select('#graph-container');
  graphBlock.style('display', 'block');

  let mapBox = select('#map');
  mapBox.style('height', 'calc(100vh - 150px')  //min-height: calc(100vh - 100px);

  graphLine.firstRun();
  graphLine.loop();
}

function pickRandomPoint(geoCoordinates){
  console.log('Picking random point');
  let result;
    let count = 0;
    for (var prop in geoCoordinates)
        if (Math.random() < 1/++count)
           result = prop;
    //console.log(result);
    return {lng: geoCoordinates[result].long, lat: geoCoordinates[result].lat}
}

function calculateMapCentre(geoCoordinates){
  console.log('Calculating Centre');
  let cLon, cLat;
  if (geoCoordinates == undefined) {
    return [-2.2, 53.48] //[lng, lat] - default centre Manchester
  }
  if (Object.keys(geoCoordinates).length == 1) {
    return geoCoordinates[0]
  }

  var x = y = z = 0;

  for (var key in geoCoordinates) {
    var latitude = geoCoordinates[key].lat * Math.PI / 180;
    var longitude = geoCoordinates[key].long * Math.PI / 180;
    x += Math.cos(latitude) * Math.cos(longitude);
    y += Math.cos(latitude) * Math.sin(longitude);
    z += Math.sin(latitude);
  }

  var total = Object.keys(geoCoordinates).length;

  x = x / total;
  y = y / total;
  z = z / total;

  var centralLongitude = Math.atan2(y, x);
  var centralSquareRoot = Math.sqrt(x * x + y * y);
  var centralLatitude = Math.atan2(z, centralSquareRoot);

  cLat = centralLatitude * 180 / Math.PI;
  cLon = centralLongitude * 180 / Math.PI;
  console.log('Centre is:',{lng: cLon, lat: cLat});
  return {lng: cLon, lat: cLat}  //{lng: 10,lat: 10}
}

//creates Mapbox JSON based on Monzo data
function createMapboxJSON(data, type){
  console.log('Transactions:',data);
  var mainObject = {};

  //set up mainObject
  mainObject.features = [];
  mainObject.type = 'FeatureCollection';

  //loop through data and build JSON
  for (var key in data) {
    let childObject = {};

    childObject.type = 'Features';
    childObject.properties = {};
    childObject.geometry = {};

    childObject.properties.title = key;
    childObject.properties.c = buildPopupDesc(data[key].name, data[key].spend, data[key].google, data[key].trans, data[key].category, 'tooltip');
    childObject.properties.trans = data[key].trans;
    childObject.properties.category = data[key].category;

    if (type == 'Point') childObject.geometry.coordinates = [data[key].long,data[key].lat];

    //add type based on input i.e Point or Polygon
    childObject.geometry.type = type;

    //define spend group and add to object
    let x = data[key].spend/100;
    let perc = floor((x / user.transTotal) * 100); //Calculate spend percentage
    //console.log(x);
      switch (true) {
        case (perc < 4):
          childObject.properties.spendgroup = 'bottom';
          break;
        case (perc > 3 && perc < 8):
          childObject.properties.spendgroup = 'lower';
          break;
        case (perc > 7 && perc < 16):
          childObject.properties.spendgroup = 'mid';
          break;
        case (perc > 15 && perc < 31):
          childObject.properties.spendgroup = 'upper';
          break;
        default:
          childObject.properties.spendgroup = 'top';
          break;
        }

      if (type == 'Polygon') {
        childObject.geometry.coordinates = createPolygonCoords([data[key].long,data[key].lat], 1);
        childObject.properties.height = perc * 50; //add tower to be based on percentage spend * 100 per %
        childObject.properties.base_height = 0;
        childObject.properties.color = getColour(childObject.properties.spendgroup);
        childObject.properties.level = 1;
      }

    mainObject.features.push(childObject);
  }

  console.log('Marking the map!');
  //let myJSON = JSON.stringify(mainObject);
  //console.log(mainObject);
  return mainObject
}

function buildPopupDesc (name, spend, image, trans, category, type){
  let value = penceToPounds((spend/100));
  let spendPerc = ((spend/100) / user.transTotal) * 100;
  let wholeSpend = floor(spend/100);
  let catName = category.replace(/_/g, " ").replace(/^./, function(str){ return str.toUpperCase(); });

  if (type == 'tooltip'){
    return "<style>#" + type + "{z-index: 6;}</style><div id='logo'><img src='assets/icons/" + category + ".png' width=50/></div><div id='content'><p class='title'>" + name + "</p><p>(" + catName + ")</p><p>" + trans + " Transaction(s)</p></div><div id='spend'>"+ currency.getCurrencySymbol(user.currency) + wholeSpend + "</div>";
  } else {
    return "<style>#" + type + "{z-index: 6;} #content{margin-top: 5px;}</style><div id='logo'><img src='assets/icons/" + category + ".png' width=50/></div><div id='content'><p class='title'>" + name + "</p><p>" + trans + " Transaction(s)</p></div><div id='spend'>"+ currency.getCurrencySymbol(user.currency) + wholeSpend + "</div>";
  }
}

function penceToPounds(value){
    return ((Number(value)||0).toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,"));
}

function addHeatmap(){
  console.log('Adding heatmap');
  mapSpend.addSource("heatspends", {
    type: "geojson",
    data: null,
    cluster: true,
    clusterMaxZoom: 20, // Max zoom to cluster points on
    clusterRadius: 25 // Use small cluster radius for the heatmap look
  });

  //calculate point density based on total transactions
  let g = 1;
  let o = floor(user.totalTransaction*0.2);
  let r = floor(user.totalTransaction*0.55);

  //each point range gets a different fill color.
  var layers = [
    [g, 'green'],
    [o, 'orange'],
    [r, 'red']
  ];

  //console.log(layers);
  layers.forEach(function (layer, i) {
    mapSpend.addLayer({
        "id": "cluster-" + i,
        "type": "circle",
        "source": "heatspends",
        "layout": {
            "visibility": "none"
        },
        "paint": {
            "circle-color": layer[1],
            "circle-radius": 45,
            "circle-blur": 1.3 // blur the circles to get a heatmap look
        },
        "filter": i === layers.length - 1 ?
            [">=", "point_count", layer[0]] :
            ["all",
                [">=", "point_count", layer[0]],
                ["<", "point_count", layers[i + 1][0]]]
    }, 'waterway-label');
  });

  mapSpend.addLayer({
    "id": "heatmap",
    "type": "circle",
    "source": "heatspends",
    "layout": {
        "visibility": "none"
    },
    "paint": {
        "circle-color": 'rgba(0,255,0,0.5)',
        "circle-radius": 45,
        "circle-blur": 1.3
    },
    "filter": ["!=", "cluster", true]
  }, 'waterway-label');
  //mapSpend.setLayoutProperty(this, 'visibility', 'none');
}

function addCircles(){
  console.log('Adding circles');
  mapSpend.addSource("dynamic-circles", {
    type: "geojson",
    data: null,
  });
  mapSpend.addLayer({
    'id': 'dynamic-circles',
    'type': 'circle',
    "source": "dynamic-circles",
    'paint': {
        // make circles larger as the user zooms from z12 to z22
        'circle-radius': {
            'base': 4,
            'stops': [[12, 7], [22, 180]]
        },
        // color circles by ethnicity, using data-driven styles
        'circle-color': {
            property: 'spendgroup',
            type: 'categorical',
            stops: [
                ['bottom', app_info.spend_level_colours.bottom],
                ['lower', app_info.spend_level_colours.lower],
                ['mid', app_info.spend_level_colours.mid],
                ['upper', app_info.spend_level_colours.upper],
                ['top', app_info.spend_level_colours.top]]
        }
    }
  });
  mapSpend.addLayer({
    'id': 'room-extrusion',
    'type': 'fill-extrusion',
    'source': {
            // Geojson Data source used in vector tiles, documented at
            // https://gist.github.com/ryanbaumann/a7d970386ce59d11c16278b90dde094d
            'type': 'geojson',
            'data': null
            //'data': 'indoor-3d-map.geojson'
        },
    'paint': {
        // See the Mapbox Style Spec for details on property functions
        // https://www.mapbox.com/mapbox-gl-style-spec/#types-function
        'fill-extrusion-color': {
            // Get the fill-extrusion-color from the source 'color' property.
            'property': 'color',
            'type': 'identity'
        },
        'fill-extrusion-height': {
            // Get fill-extrusion-height from the source 'height' property.
            'property': 'height',
            'type': 'identity'
        },
        'fill-extrusion-base': {
            // Get fill-extrusion-base from the source 'base_height' property.
            'property': 'base_height',
            'type': 'identity'
        },
        // Make extrusions slightly opaque for see through indoor walls.
        'fill-extrusion-opacity': 0.6
        //mapSpend.setPaintProperty(room-extrusion, 'fill-extrusion-opacity', 1);
    }
});
}

function createPolygonCoords(centre, radius){
  tempArr = [];
  mainArr = [];

  //create 5 polygon coords based on centre
  let units = radius/10000;
  tempArr.push([centre[0] + units, centre[1]]);
  tempArr.push([centre[0], centre[1] + units]);
  tempArr.push([centre[0] - units, centre[1]]);
  tempArr.push([centre[0], centre[1] - units]);
  tempArr.push([centre[0] + units, centre[1]]);

  mainArr.push(tempArr);
  //console.log(mainArr);
  return mainArr;
}

function getColour(group){
  var objects = {
    'bottom': '#789E73',
    'lower': '#C0E7D2',
    'mid': '#F6BD5B',
    'upper': '#F08C5E',
    'top': '#B24130'
  }
  //console.log(group);
  for(key in objects) {
    if (key == group) return objects[key]
  }
}

function flyToRandom(end){  //start, end, atStart
  console.log('Lets fly!');
  let start = mapSpend.getCenter();
  let atStart = true;

  let target = atStart ? end : start;

  atStart = !atStart;

  mapSpend.flyTo({
    center: target,
    zoom: 15.5,
    speed: 0.5, // make the flying slow
    curve: 1, // change the speed at which it zooms out

    // This can be any easing function: it takes a number between
    // 0 and 1 and returns another number between 0 and 1.
    easing: function (t) {
        return t;
    }
  });
}

function buildCategoryFeed(){
  tempArr = {};
  for (var key in user.locations) {
    let newKey = user.locations[key].category
    tempArr[newKey] = {
      'spend' : 0,
      'transactions' : 0
    }
  }
  for (var key in user.locations) {
    let newKey = user.locations[key].category
    tempArr[newKey].spend += user.locations[key].spend
    tempArr[newKey].transactions ++;
  }

  let topMerchant = {
    'name': user.topMerch[0],
    'spend': user.topMerch[1],
    'transactions': user.topMerch[3]
  }

  //loop through feed and create feed items
  for (var key in tempArr) {
    let id = key;
    let label = key.replace(/_/g, " ").replace(/^./, function(str){ return str.toUpperCase(); });;
    let spend = tempArr[key].spend;
    let cat = key;
    let trans = tempArr[key].transactions;


    let link = document.createElement('a');
    link.href = '#';
    link.className = '';
    link.idContent = id;
    link.innerHTML = buildPopupDesc (label, spend, 'hello', trans, cat, 'feed');
    user.lastClickedCat = '';

    link.onclick = function (e) {
      var clicked = this.idContent;
      if (clicked == user.lastClickedCat){
        //console.log(mapSpend.getStyle().layers);
        for (i = 0; i < app_info.map.layers.length; i++){
          mapSpend.setFilter(app_info.map.layers[i], null);
        }
        this.className = '';
        user.lastClickedCat = '';
        return
      }
      user.lastClickedCat = clicked;
      e.preventDefault();
      e.stopPropagation();

      //loop through map layers and apply filters
      for (i = 0; i < app_info.map.layers.length; i++){
        setMapFilter(app_info.map.layers[i],clicked);
      }

      this.className = 'active';

      //loop through other children and remove class name
      if (feedLayer){
        feedChildren = feedLayer.childNodes;
        for (var i = 0; i < feedChildren.length; i++) {
          if (feedChildren[i].idContent != this.idContent){
            feedChildren[i].className = '';
          }
        }
      }

    }

    let feedLayer = document.getElementById('feed');
    feedLayer.appendChild(link);
  }
}

//dayDifference('2017-07-20T14:54:57.687Z','2017-07-30T14:54:57.687Z');
function dayDifference(date1, date2){
  var oneDay = 24*60*60*1000; // hours*minutes*seconds*milliseconds

  //make string a date
  var firstDate = new Date(date1);
  var secondDate = new Date(date2);

  return Math.round(Math.abs((firstDate.getTime() - secondDate.getTime())/(oneDay)));
}

function setMapFilter(layer_name,filter_name){
  mapSpend.setFilter(layer_name, ['in', 'category', filter_name]);
}
