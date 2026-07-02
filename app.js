const firebaseConfig = {

apiKey: "AIzaSyDOJRkBNomOOQYB3GiTHZQ61k_Z_yavpso",
authDomain: "srmapintramobility.firebaseapp.com",
databaseURL: "https://srmapintramobility-default-rtdb.asia-southeast1.firebasedatabase.app",
projectId: "srmapintramobility",
storageBucket: "srmapintramobility.firebasestorage.app",
messagingSenderId: "27384147111",
appId: "1:27384147111:web:26d6ddad4d6b5c14093f82"

};


if (!firebase.apps.length) {

firebase.initializeApp(firebaseConfig);

}


let currentFacultyId = null;

let isAuthenticated = false;



const FACULTY_SESSION_TIMEOUT = 600000;

const WARNING_LIMIT = 30000;

const OFFLINE_LIMIT = 40000;



const db = firebase.database();

const driversRef =
db.ref("drivers");

const requestsRef =
db.ref("requests");

let facultySessionTimer = null;

function clearFacultySessionTimer(){
if(facultySessionTimer){
clearTimeout(facultySessionTimer);
facultySessionTimer = null;
}
}

function startFacultySessionTimer(){
clearFacultySessionTimer();
facultySessionTimer = setTimeout(function(){
if(firebase.auth && firebase.auth().currentUser){
firebase.auth().signOut().finally(function(){
localStorage.clear();
window.location.reload();
});
}
else{
localStorage.clear();
window.location.reload();
}
},FACULTY_SESSION_TIMEOUT);
}


if ('serviceWorker' in navigator) {

navigator.serviceWorker
.getRegistrations()
.then(function(registrations){

registrations.forEach(function(registration){

registration.unregister();

});

});

}


function initializeFacultySession(){

if(!firebase.auth){
currentFacultyId = null;
isAuthenticated = false;
return;
}

firebase.auth().onAuthStateChanged(function(user){

if(user){

const email = user.email || "";
const facultyId = email.split("@")[0];

currentFacultyId = facultyId;
isAuthenticated = true;

localStorage.setItem("facultyId",facultyId);
localStorage.setItem("facultyAuthenticated","true");
startFacultySessionTimer();

}
else{

currentFacultyId = null;
isAuthenticated = false;

localStorage.removeItem("facultyId");
localStorage.removeItem("facultyAuthenticated");
clearFacultySessionTimer();

}

});

}

initializeFacultySession();


var map = null;

const markers = {};
const busStopMarkers = {};

const BUS_STOP_LOCATIONS = {
  ADMIN:{label:"Admin",lat:16.4645,lng:80.5080},
  X_LAB:{label:"X Lab",lat:16.4636,lng:80.5071},
  SR_BLOCK_ENTRANCE:{label:"SR Block Entrance",lat:16.4631,lng:80.5067},
  STUDENT_COUNCIL:{label:"Student Council",lat:16.4625,lng:80.5069},
  CV_RAMAN:{label:"CV Raman",lat:16.4620,lng:80.5063},
  GATE3:{label:"Gate 3",lat:16.4601,lng:80.5070},
  GATE6:{label:"Gate 6",lat:16.4598,lng:80.5049}
};

const busStopIcon = L.divIcon({
  className:"bus-stop-marker",
  html:'<div style="width:18px;height:18px;border-radius:50%;background:#1565C0;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);">B</div>',
  iconSize:[18,18],
  iconAnchor:[9,9],
  popupAnchor:[0,-9]
});

function addBusStopMarkers(){
  if(!map){ return; }
  Object.keys(BUS_STOP_LOCATIONS).forEach(function(key){
    const stop = BUS_STOP_LOCATIONS[key];
    if(busStopMarkers[key]){
      busStopMarkers[key].setLatLng([stop.lat, stop.lng]);
      return;
    }
    busStopMarkers[key] = L.marker([stop.lat, stop.lng],{
      icon:busStopIcon,
      interactive:true,
      zIndexOffset:-500
    }).addTo(map).bindPopup("<b>Bus Stop</b><br>" + stop.label);
  });
}


function initializeMap(){

if(map){

return;

}


const mapElement =
document.getElementById("map");


if(!mapElement){

console.error(
"Map container not found"
);

return;

}


/* Create map */

map = L.map("map",{

preferCanvas:true,
zoomControl:true

}).setView(

[16.463261979207143,
80.50698185003442],

16

);


/* OpenStreetMap */

L.tileLayer(

'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',

{

maxZoom:19,
attribution:'© OpenStreetMap'

}

).addTo(map);

addBusStopMarkers();


/* Important fix */

setTimeout(function(){

map.invalidateSize(true);

addBusStopMarkers();
updateMap();

},1000);

}


const greenIcon = L.icon({

iconUrl:
"https://cdn-icons-png.flaticon.com/512/744/744465.png",

iconSize:[38,38],

iconAnchor:[19,19]

});


const redIcon = L.icon({

iconUrl:
"https://cdn-icons-png.flaticon.com/512/744/744467.png",

iconSize:[38,38],

iconAnchor:[19,19]

});


function updateMap(){

const now = new Date();


/* Update time */

const lastUpdateElement =
document.getElementById("lastUpdate");

if(lastUpdateElement){

lastUpdateElement.innerText =

"Last updated: " +

now.toLocaleTimeString("en-IN",{

timeZone:"Asia/Kolkata",
hour:"numeric",
minute:"numeric",
second:"numeric",
hour12:true

});

}


/* Active count */

let activeCount = 0;


/* Get drivers */

driversRef
.once("value")

.then(function(snapshot){


/* Remove old markers */

Object.keys(markers).forEach(function(id){

if(!snapshot.hasChild(id)){

if(markers[id] && map){

map.removeLayer(markers[id]);

}

delete markers[id];

}

});


/* Process drivers */

snapshot.forEach(function(child){

const id = child.key;

const data = child.val();


if(!data){

return;

}


const lat = data.lat;

const lng = data.lng;

const lastTime = data.time;


if(!lat || !lng || !lastTime){

return;

}


const age =
Date.now() - lastTime;


/* Remove offline drivers */

if(age > OFFLINE_LIMIT){

driversRef
.child(id)
.remove();

if(markers[id] && map){

map.removeLayer(markers[id]);

delete markers[id];

}

return;

}


/* Active buggy */

activeCount++;

let icon = greenIcon;


/* Warning */

if(age > WARNING_LIMIT){

icon = redIcon;

}


/* Add marker */

if(map){

if(markers[id]){

markers[id]
.setLatLng([lat,lng]);

markers[id]
.setIcon(icon);

}
else{

markers[id] =

L.marker(
[lat,lng],
{icon:icon}
)

.addTo(map)

.bindPopup(

"<b>" +
id.toUpperCase() +
"</b>"

);

}

}

});


/* Update active buggy count */

const activeElement =
document.getElementById("activeBuggies");

if(activeElement){

activeElement.innerText =

"Active Buggies: " +
activeCount;

}

})

.catch(function(error){

console.error(
"Driver fetch error:",
error
);

});

}


function cleanRequests(){

requestsRef
.once("value")

.then(function(snapshot){

snapshot.forEach(function(child){

const d = child.val();


if(!d){

requestsRef
.child(child.key)
.remove();

return;

}


const count =
d.count || 0;

const assignedTo =
d.assignedTo || null;

const reqTime =
d.time || 0;


/* Remove empty */

if(count <= 0){

requestsRef
.child(child.key)
.remove();

return;

}


if(reqTime){

const age =
Date.now() - reqTime;

if(age > 7200000){

requestsRef
.child(child.key)
.remove();

return;

}

}



if(!reqTime){

requestsRef
.child(child.key)
.remove();

return;

}



if(assignedTo){

driversRef
.child(assignedTo)
.once("value")

.then(function(driverSnap){

const driver =
driverSnap.val();

if(!driver){

requestsRef
.child(child.key)
.child("assignedTo")
.remove();

return;

}


const age =
Date.now() -
(driver.time || 0);


if(age > OFFLINE_LIMIT){

requestsRef
.child(child.key)
.child("assignedTo")
.remove();

}

});

}

});

});

}

cleanRequests();


let activeFacultyRequestListener = null;

function watchFacultyRequestClaim(block){

if(activeFacultyRequestListener){
activeFacultyRequestListener.off();
activeFacultyRequestListener = null;
}

activeFacultyRequestListener =
requestsRef.child(block);

activeFacultyRequestListener.on("value",function(snapshot){

const data = snapshot.val();

if(!data){
return;
}

if(
data.assignedTo &&
data.lastFacultyId &&
data.lastFacultyId === currentFacultyId
){

const statusBox =
document.getElementById("requestStatus");

if(statusBox){

statusBox.innerHTML =
"🚗 Your buggy <b>" +
data.assignedTo.toUpperCase() +
"</b> is on the way.<br>Please remain at the buggy stop.";

}

}

});

}


function verifyFacultyAccess(){

if(!isAuthenticated){

document.getElementById("requestStatus")
.innerText =

"Faculty authentication required.";

return false;

}


if(!currentFacultyId){

document.getElementById("requestStatus")
.innerText =

"Invalid faculty session.";

return false;

}


return true;

}


function requestBuggy(block,locationValidation){

if(!verifyFacultyAccess()){

return;

}


/* Prevent spam */

const lastRequest =

localStorage.getItem(

"lastBuggyRequest_" +
currentFacultyId

);


if(lastRequest){

const diff =

Date.now() -
parseInt(lastRequest);


if(diff < 600000){

document.getElementById("requestStatus")
.innerText =

"You already requested recently.";

return false;

}

}


/* Save request */

requestsRef
.child(block)

.transaction(function(data){

if(data === null){

return {

count:1,
assignedTo:null,
time:Date.now(),
facultyId:currentFacultyId,
lastFacultyId:currentFacultyId,
locationVerified:true,
locationVerifiedAt:Date.now(),
locationValidation:locationValidation || null,
stopDiscipline:"faculty_location_verified_at_stop"

};

}


/* Increment */

return {

count:(data.count || 0) + 1,

assignedTo:
data.assignedTo || null,

time:Date.now(),

facultyId:currentFacultyId,
lastFacultyId:currentFacultyId,
locationVerified:true,
locationVerifiedAt:Date.now(),
locationValidation:locationValidation || null,
stopDiscipline:"faculty_location_verified_at_stop"

};

});


/* Save cooldown */

localStorage.setItem(

"lastBuggyRequest_" +
currentFacultyId,

Date.now()

);


/* Status */

document.getElementById("requestStatus")
.innerText =

"Request sent from " +

block.replaceAll("_"," ") +

". Location verified. Please stay at the stop until the buggy arrives.";

watchFacultyRequestClaim(block);

return true;

}




setInterval(function(){

updateMap();

},5000);




window.onpageshow = function(event){

if(event.persisted){

window.location.reload();

}

};
