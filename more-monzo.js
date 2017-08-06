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
    //monzoapi.makeCall(this.getBalance);
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
  //user.data = JSON.parse(reponse);
  //console.log(type, user.data);
  if (type == '/transactions?expand[]=merchant'){
    let mainArr = {};
    let totalAmount = 0;
    user.data = JSON.parse(reponse);
    //loop through and add labels to object
    for (i = 0; i < user.data.transactions.length; i++){
      if (user.data.transactions[i].amount < 0 && user.data.transactions[i].include_in_spending == true && user.data.transactions[i].merchant != null){
        totalAmount += (user.data.transactions[i].amount*-1);
        let key = user.data.transactions[i].merchant.id;
        mainArr[key] = {
          'name': user.data.transactions[i].merchant.name,
          'long': user.data.transactions[i].merchant.address.longitude,
          'lat': user.data.transactions[i].merchant.address.latitude,
          'google': user.data.transactions[i].merchant.metadata.google_places_icon,
          'spend': 0,
          'trans': 0,
        }
        //mainArr[key].spend = mainArr[key].spend + (user.data.transactions[i].amount*-1);
      }
    }
    //add spends to object & trans
    for (i = 0; i < user.data.transactions.length; i++){
      if (user.data.transactions[i].amount < 0 && user.data.transactions[i].include_in_spending == true && user.data.transactions[i].merchant != null){
        let key = user.data.transactions[i].merchant.id;
        mainArr[key].spend = mainArr[key].spend + (user.data.transactions[i].amount * -1);
        mainArr[key].trans += 1;
      }
    }
    console.log('Data parsed');
    user.locations = mainArr;
    user.transTotal = (totalAmount/100);
    mapSpend.setCenter(calculateMapCentre(user.locations));

    let mData = createMapboxJSON(user.locations);
    if (mData != undefined) mapSpend.getSource('purchases').setData(mData);
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
    //center: calculateMapCentre(user.locations),
    zoom: 5.8
     // starting zoom
  });
  //let tempUrl = 'https://wanderdrone.appspot.com/';
  mapSpend.on('load', function () {

      mapSpend.addSource('purchases', { type: 'geojson', data: createMapboxJSON(user.locations) });
      mapSpend.addLayer({
          "id": "purchases",
          "type": "symbol",
          "source": "purchases",
          "layout": {
              "icon-image": "marker-15"
          }
      });
  });

  mapSpend.on('click', 'purchases', function (e) {
    new mapboxgl.Popup()
        .setLngLat(e.features[0].geometry.coordinates)
        .setHTML(e.features[0].properties.description)
        .addTo(mapSpend);
  });
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
  //for (var i = 0; i < Object.keys(geoCoordinates).length; i++) {
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
    childObject.geometry.coordinates = [data[key].long,data[key].lat];
    childObject.geometry.type = 'Point';

    mainObject.features.push(childObject);
  }

  //console.log(mainObject);
  //var json = JSON.stringify(mainObject);
  //console.log(json);
  console.log('Adding transactions to map');
  return mainObject
}

function buildPopupDesc (name, spend, image, trans){
  let value = penceToPounds((spend/100));
  let spendPerc = ((spend/100) / user.transTotal) * 100
  return "<strong><font color = #4CAFF0><img src ='" + image + "'width=12/> " + name + "</font></strong><p>You have spent £" + value + " here<br>This is " + spendPerc.toFixed(2) + "% our of all spends<br>"+ trans +" transaction(s) at this location</p>"
}

function penceToPounds(value){
    return ((Number(value)||0).toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,"));
}
