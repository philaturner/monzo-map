var xhr = new XMLHttpRequest()
var mapSpend;

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
        }
      }
    }
    console.log('Data parsed');
    user.locations = mainArr;
    user.transTotal = (totalAmount/100);
    user.totalTransaction = totalTransaction;
    user.topMerch = [topMerchant.name,penceToPounds(topMerchant.spend/100)];
    mapSpend.setCenter(calculateMapCentre(user.locations));

    let mData = createMapboxJSON(user.locations);
    if (mData != undefined) mapSpend.getSource('purchases').setData(mData);
    addHeatmap();
    addCircles();
    if (mData != undefined) mapSpend.getSource('heatspends').setData(mData);
    if (mData != undefined) mapSpend.getSource('dynamic-circles').setData(mData);
    //console.log(mapSpend);
    user.geojson = mData;
    populateStatsDOM();
  }
}

function preload(){
  mapboxgl.accessToken = 'pk.eyJ1IjoicGhpbGF0dXJuZXIiLCJhIjoiY2oyMzl2bmg1MDAxbDJ3bXVzdTQ2YzFwNCJ9.DYG613tp1aT7jYZdPCbUQw';
  noCanvas();
}

function intialCall(){
  let atoken = select('#atoken');
  let uacc = select('#uacc');
  user.access_token = atoken.value();
  user.acc_id = uacc.value();
  console.log('Getting Data');
  user.getData();
}

function setup(){
  var button = select('#btnsubmit');
  button.mousePressed(intialCall);

  mapSpend = new mapboxgl.Map({
    container: 'map', // container id
    style: 'mapbox://styles/mapbox/dark-v9', // map style
    center: [-2.2, 53.48], // default position [lng, lat]
    zoom: 5.8
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
  //addHeatmap();
  });

  mapSpend.on('click', 'purchases', function (e) {
    new mapboxgl.Popup()
        .setLngLat(e.features[0].geometry.coordinates)
        .setHTML(e.features[0].properties.description)
        .addTo(mapSpend);
  });

  mapSpend.on('click', 'dynamic-circles', function (e) {
    new mapboxgl.Popup()
        .setLngLat(e.features[0].geometry.coordinates)
        .setHTML(e.features[0].properties.description)
        .addTo(mapSpend);
  });

  var toggleableLayerLabels = [ 'markers', 'heatmap', 'circles'];
  var toggleableLayerIds = [ 'purchases', 'heatmap', 'dynamic-circles'];

  for (var i = 0; i < toggleableLayerIds.length; i++) {
      var id = toggleableLayerIds[i];
      var label = toggleableLayerLabels[i];
      var clusters = ['cluster-0', 'cluster-1', 'cluster-2'] //add clusters


      var link = document.createElement('a');
      link.href = '#';
      //only make circles active
      if (id == 'dynamic-circles') {
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
  let amount = select('#value');
  let transTot = select('#trans');
  let topMerc = select('#merchant');
  amount.elt.innerText = user.transTotal;
  transTot.elt.innerText = user.totalTransaction;
  let mercString = ' ' + user.topMerch[0] + ' (£' + user.topMerch[1] + ')';
  topMerc.elt.innerText = mercString;
  let statBox = select('#stat-text');
  statBox.style('visibility', 'visible');
  let loginForm = select('#login-form');
  loginForm.style('visibility', 'hidden');
  let menu = select('#menu');
  menu.style('visibility', 'visible');
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
function createMapboxJSON(data){
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
    childObject.properties.description = buildPopupDesc(data[key].name, data[key].spend, data[key].google, data[key].trans);
    childObject.properties.trans = data[key].trans;
    childObject.geometry.coordinates = [data[key].long,data[key].lat];
    childObject.geometry.type = 'Point';

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

    mainObject.features.push(childObject);
  }

  console.log('Marking the map!');
  //let myJSON = JSON.stringify(mainObject);
  //console.log(mainObject);
  return mainObject
}

function buildPopupDesc (name, spend, image, trans){
  let value = penceToPounds((spend/100));
  let spendPerc = ((spend/100) / user.transTotal) * 100
  return "<strong><font color = #4CAFF0><img src ='" + image + "'width=12/> " + name + "</font></strong><p>You have spent £" + value + " here<br>This is " + spendPerc.toFixed(2) + "% out of all spends<br>"+ trans +" transaction(s) at this location</p>"
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
  let g = 1 ;
  let o = user.totalTransaction/2;
  let r = floor(user.totalTransaction*0.8);

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
                ['bottom', '#789E73'],
                ['lower', '#C0E7D2'],
                ['mid', '#F6BD5B'],
                ['upper', '#F08C5E'],
                ['top', '#B24130']]
        }
    }
  });
}
