

async function sha256(message){

const msgBuffer =
new TextEncoder().encode(message);

const hashBuffer =
await crypto.subtle.digest(
'SHA-256',
msgBuffer
);

const hashArray =
Array.from(
new Uint8Array(hashBuffer)
);

const hashHex =
hashArray
.map(b =>
b.toString(16).padStart(2,'0')
)
.join('');

return hashHex;

}



function formatTime12Hour(timeValue){

if(!timeValue){
return "--";
}

const parts =
timeValue.split(":");

let hours =
parseInt(parts[0],10);

const minutes =
parts[1];

const ampm =
hours >= 12 ? "PM" : "AM";

hours =
hours % 12;

if(hours === 0){
hours = 12;
}

return hours + ":" + minutes + " " + ampm;

}

async function getServiceWindow(){

try{

if(!firebase || !firebase.database){
return null;
}

const serviceWindowPromise =
firebase.database()
.ref("settings/serviceWindow")
.once("value");

const timeoutPromise =
new Promise(function(resolve){
setTimeout(function(){ resolve(null); }, 10000);
});

const snapshot =
await Promise.race([serviceWindowPromise, timeoutPromise]);

if(!snapshot || !snapshot.exists || !snapshot.exists()){
return null;
}

return snapshot.val();

}
catch(error){

console.error(
"Service window fetch failed:",
error
);

return null;

}

}

async function updateServiceNotice(){

const data =
await getServiceWindow();

const loginNotice =
document.getElementById("serviceNotice");

const dashboardNotice =
document.getElementById("dashboardServiceNotice");

let message =
"Unable to load buggy service timings. Please refresh the page.";

if(data && data.start && data.end){

const availableNow = await isServiceAvailableFromData(data);
message =
(availableNow ? "Buggy service is available now. " : "Buggy services are not available now. ") +
"Service hours: " +
formatTime12Hour(data.start) +
" to " +
formatTime12Hour(data.end) +
".";

}

if(data && data.bookingEnabled === false){

message =
"Buggy booking is currently disabled by the administrator.";

}

if(loginNotice){
loginNotice.innerText = message;
}

if(dashboardNotice){
dashboardNotice.innerText = message;
}

}

function isServiceAvailableFromData(data){

if(!data){
return true;
}

if(data.enabled === false || data.bookingEnabled === false){
return false;
}

if(!data.start || !data.end){
return true;
}

const now = new Date();
const currentMinutes = (now.getHours() * 60) + now.getMinutes();
const startParts = data.start.split(":").map(Number);
const endParts = data.end.split(":").map(Number);
const startMinutes = (startParts[0] * 60) + startParts[1];
const endMinutes = (endParts[0] * 60) + endParts[1];

if(startMinutes <= endMinutes){
return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

return currentMinutes >= startMinutes || currentMinutes <= endMinutes;

}

async function isServiceAvailable(){

try{
const data = await getServiceWindow();
return isServiceAvailableFromData(data);
}
catch(error){
console.error("Service availability check failed:",error);
return true;
}

}

function setLoginEnabled(enabled){

const loginBtn =
document.getElementById("facultyLoginBtn");

if(!loginBtn){
return;
}

loginBtn.disabled = !enabled;
loginBtn.style.opacity = enabled ? 1 : 0.5;
loginBtn.style.cursor = enabled ? "pointer" : "not-allowed";

}

function getServiceUnavailableMessage(){

const notice = document.getElementById("serviceNotice");
const timingText = notice && notice.innerText ? notice.innerText : "Please try during service hours.";

return "Buggy services are not available now. " + timingText;

}

function disableLogin(){

setLoginEnabled(false);

const loginStatus = document.getElementById("loginStatus");
if(loginStatus){
loginStatus.innerText = getServiceUnavailableMessage();
}

}

function enableLogin(){

setLoginEnabled(true);

const loginStatus =
document.getElementById("loginStatus");

if(loginStatus &&
(loginStatus.innerText.indexOf("Buggy services are not available now") === 0 ||
 loginStatus.innerText === "Buggy service is currently unavailable.")){

loginStatus.innerText = "";

}

}

async function refreshLoginAvailability(){

await updateServiceNotice();

const available = await isServiceAvailable();

if(available){
enableLogin();
}
else{
disableLogin();
}

return available;

}


window.onload = function(){

/* Show admin-defined timing before login and block faculty login outside service hours. */
refreshLoginAvailability();
if(firebase && firebase.database){
firebase.database().ref("settings/serviceWindow").on("value",function(snapshot){
var data = snapshot && snapshot.exists && snapshot.exists() ? snapshot.val() : null;
var loginNotice = document.getElementById("serviceNotice");
var dashboardNotice = document.getElementById("dashboardServiceNotice");
var msg = "Unable to load buggy service timings. Please refresh the page.";
if(data && data.start && data.end){
var availableNow = isServiceAvailableFromData(data);
msg = (availableNow ? "Buggy service is available now. " : "Buggy services are not available now. ") +
"Service hours: " + formatTime12Hour(data.start) + " to " + formatTime12Hour(data.end) + ".";
}
if(data && data.bookingEnabled === false){
msg = "Buggy booking is currently disabled by the administrator.";
}
if(loginNotice){ loginNotice.innerText = msg; }
if(dashboardNotice){ dashboardNotice.innerText = msg; }
refreshLoginAvailability();
});
}

firebase.auth().onAuthStateChanged(async function(user){

if(user){

const available = await refreshLoginAvailability();

if(!available){

firebase.auth().signOut();
localStorage.clear();
return;

}

const email = user.email || "";
const facultyId = email.split("@")[0];

currentFacultyId =
facultyId;

isAuthenticated =
true;

localStorage.setItem(
"facultyId",
facultyId
);

localStorage.setItem(
"facultyAuthenticated",
"true"
);

showDashboard(facultyId);

}

});

};

async function loginFaculty(){

const serviceAvailable = await refreshLoginAvailability();

if(!serviceAvailable){

const status = document.getElementById("loginStatus");
if(status){
status.innerText = getServiceUnavailableMessage();
}

return;

}

const facultyId =
document.getElementById("facultyIdInput")
.value
.trim();

const pin =
document.getElementById("facultyPinInput")
.value
.trim();

if(!facultyId || !pin){

document.getElementById("loginStatus")
.innerText =
"Enter Employee ID and PIN";

return;

}

const email = facultyId + "@mobility.local";
const password = "SRM@" + pin;

document.getElementById("loginStatus")
.innerText =
"Checking credentials...";

firebase.auth()
.signInWithEmailAndPassword(email,password)
.then(function(){

localStorage.setItem(
"facultyId",
facultyId
);

localStorage.setItem(
"facultyAuthenticated",
"true"
);

currentFacultyId =
facultyId;

isAuthenticated =
true;

showDashboard(facultyId);

})
.catch(function(error){

console.error(error);

document.getElementById("loginStatus")
.innerText =
"Invalid Employee ID or PIN";

});

}

function showDashboard(facultyId){

document.getElementById("loginContainer")
.style.display = "none";

document.getElementById("mainDashboard")
.style.display = "block";

document.getElementById("facultyDisplay")
.innerText =
"Logged in as Employee ID: " +
facultyId;

updateServiceNotice();

refreshCooldownUI();

startFacultyStopRangeWatch();

if(facultyLoginSessionTimer){ clearTimeout(facultyLoginSessionTimer); }
facultyLoginSessionTimer = setTimeout(function(){
const status = document.getElementById("requestStatus");
if(status){ status.innerText = "Faculty session expired after 10 minutes. Please login again."; }
logoutFaculty();
},FACULTY_SESSION_TIMEOUT_MS);

setTimeout(function(){

initializeMap();

setTimeout(function(){

if(map){

map.invalidateSize(true);

updateMap();

}

},1000);

},300);

}

function logoutFaculty(){

if(facultyLoginSessionTimer){ clearTimeout(facultyLoginSessionTimer); facultyLoginSessionTimer = null; }
if(activeRequestWatchId !== null && navigator.geolocation){ navigator.geolocation.clearWatch(activeRequestWatchId); activeRequestWatchId = null; }
activeRequestBlock = null;
stopFacultyStopRangeWatch();

firebase.auth().signOut().then(function(){

localStorage.clear();

window.location.reload();

}).catch(function(error){

console.error("Logout error:",error);

localStorage.clear();

window.location.reload();

});

}


const REQUEST_COOLDOWN_MS = 600000;
const FACULTY_SESSION_TIMEOUT_MS = 600000;

let cooldownInterval = null;
let facultyLoginSessionTimer = null;
let activeRequestBlock = null;
let activeRequestWatchId = null;

const STOP_ALLOWED_RADIUS_M = 40;
const STOP_CANCEL_RADIUS_M = 50;
const MAX_ACCEPTABLE_LOCATION_ACCURACY_M = 60;

const STOP_LOCATIONS = {
ADMIN:{lat:16.4645,lng:80.5080},
X_LAB:{lat:16.4636,lng:80.5071},
SR_BLOCK_ENTRANCE:{lat:16.4631,lng:80.5067},
STUDENT_COUNCIL:{lat:16.4625,lng:80.5069},
CV_RAMAN:{lat:16.4620,lng:80.5063},
GATE3:{lat:16.4601,lng:80.5070},
GATE6:{lat:16.4598,lng:80.5049}
};

function getCurrentPositionPromise(){

return new Promise(function(resolve,reject){

if(!navigator.geolocation){
reject(new Error("Geolocation is not supported on this device/browser."));
return;
}

navigator.geolocation.getCurrentPosition(
function(position){ resolve(position); },
function(error){ reject(error); },
{
enableHighAccuracy:true,
timeout:15000,
maximumAge:0
}
);

});

}

function distanceBetweenMetres(lat1,lng1,lat2,lng2){
const R = 6371000;
const p1 = lat1 * Math.PI / 180;
const p2 = lat2 * Math.PI / 180;
const dp = (lat2 - lat1) * Math.PI / 180;
const dl = (lng2 - lng1) * Math.PI / 180;
const a = Math.sin(dp/2) * Math.sin(dp/2) +
Math.cos(p1) * Math.cos(p2) *
Math.sin(dl/2) * Math.sin(dl/2);
return R * 2 * Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function validateFacultyNearStop(block,coords,limitM){

const stop = STOP_LOCATIONS[block];
const allowedLimit = limitM || STOP_ALLOWED_RADIUS_M;

if(!stop){
return { ok:false, message:"Selected stop location is not configured." };
}

const distanceM = distanceBetweenMetres(coords.latitude,coords.longitude,stop.lat,stop.lng);
const accuracy = coords.accuracy || 9999;

if(accuracy > MAX_ACCEPTABLE_LOCATION_ACCURACY_M){
return {
ok:false,
distanceM:distanceM,
accuracy:accuracy,
message:"GPS accuracy is low. Move to an open area near the stop."
};
}

if(distanceM <= allowedLimit){
return {
ok:true,
distanceM:distanceM,
accuracy:accuracy
};
}

return {
ok:false,
distanceM:distanceM,
accuracy:accuracy,
message:"Please come closer to a buggy stop to place the request."
};

}

function validateFacultyNearAnyStop(coords,limitM){

const allowedLimit = limitM || STOP_ALLOWED_RADIUS_M;
let nearest = null;

Object.keys(STOP_LOCATIONS).forEach(function(key){
const stop = STOP_LOCATIONS[key];
const d = distanceBetweenMetres(coords.latitude,coords.longitude,stop.lat,stop.lng);
if(!nearest || d < nearest.distanceM){
nearest = { block:key, distanceM:d, lat:stop.lat, lng:stop.lng };
}
});

const accuracy = coords.accuracy || 9999;

if(accuracy > MAX_ACCEPTABLE_LOCATION_ACCURACY_M){
return { ok:false, nearestBlock:nearest ? nearest.block : null, distanceM:nearest ? nearest.distanceM : null, accuracy:accuracy, message:"GPS accuracy is low. Move to an open area near the stop." };
}

if(nearest && nearest.distanceM <= allowedLimit){
return { ok:true, nearestBlock:nearest.block, distanceM:nearest.distanceM, accuracy:accuracy };
}

return { ok:false, nearestBlock:nearest ? nearest.block : null, distanceM:nearest ? nearest.distanceM : null, accuracy:accuracy, message:"You are not within " + allowedLimit + " m of any buggy stop. Please come closer to a buggy stop to place the request." };

}

function setRequestButtonsEnabled(enabled){
const btns = document.querySelectorAll(".requestGrid .reqBtn");
btns.forEach(function(b){
b.disabled = !enabled;
b.style.opacity = enabled ? 1 : 0.5;
b.style.cursor = enabled ? "pointer" : "not-allowed";
});
}

let facultyRangeWatchId = null;
let facultyInsideAnyStop = false;

function startFacultyStopRangeWatch(){

if(!navigator.geolocation){
setRequestButtonsEnabled(false);
const status = document.getElementById("locationGateStatus");
if(status){ status.innerText = "Location access is required to enable buggy requests."; }
return;
}

if(facultyRangeWatchId !== null){
navigator.geolocation.clearWatch(facultyRangeWatchId);
}

setRequestButtonsEnabled(false);
const status = document.getElementById("locationGateStatus");
if(status){ status.innerText = "Allow location access when prompted."; }

facultyRangeWatchId = navigator.geolocation.watchPosition(
function(position){
const validation = validateFacultyNearAnyStop(position.coords,STOP_ALLOWED_RADIUS_M);
facultyInsideAnyStop = validation.ok;
setRequestButtonsEnabled(validation.ok);
const s = document.getElementById("locationGateStatus");
if(s){
if(validation.ok){
s.innerText = "You are within " + Math.round(validation.distanceM) + " m of " + validation.nearestBlock.replaceAll("_"," ") + ". Buggy request is enabled.";
}
else{
s.innerText = validation.message + (validation.distanceM !== null ? " Nearest stop is about " + Math.round(validation.distanceM) + " m away." : "");
}
}
},
function(error){
facultyInsideAnyStop = false;
setRequestButtonsEnabled(false);
const s = document.getElementById("locationGateStatus");
if(s){ s.innerText = "Location permission is needed to book a buggy."; }
console.warn("Faculty range check failed:",error);
},
{ enableHighAccuracy:true, timeout:15000, maximumAge:0 }
);

}

function stopFacultyStopRangeWatch(){
if(facultyRangeWatchId !== null && navigator.geolocation){
navigator.geolocation.clearWatch(facultyRangeWatchId);
facultyRangeWatchId = null;
}
facultyInsideAnyStop = false;
}

function cancelActiveFacultyRequest(reason){

if(!activeRequestBlock || !currentFacultyId){ return; }

const block = activeRequestBlock;
activeRequestBlock = null;

if(activeRequestWatchId !== null && navigator.geolocation){
navigator.geolocation.clearWatch(activeRequestWatchId);
activeRequestWatchId = null;
}

requestsRef.child(block).transaction(function(data){
if(!data){ return data; }
const newCount = Math.max((data.count || 1) - 1,0);
if(newCount <= 0){ return null; }
data.count = newCount;
data.time = Date.now();
data.locationVerified = true;
data.locationCancelledBy = currentFacultyId;
data.locationCancelledAt = Date.now();
data.locationCancelReason = reason || "faculty_moved_away_from_stop";
return data;
});

const status = document.getElementById("requestStatus");
if(status){
status.innerText = "Your buggy request was cancelled because you moved more than " + STOP_CANCEL_RADIUS_M + " m away from the selected stop.";
}

}

function startActiveRequestLocationWatch(block){

if(!navigator.geolocation){ return; }

if(activeRequestWatchId !== null){
navigator.geolocation.clearWatch(activeRequestWatchId);
activeRequestWatchId = null;
}

activeRequestBlock = block;

activeRequestWatchId = navigator.geolocation.watchPosition(
function(position){
const validation = validateFacultyNearAnyStop(position.coords,STOP_CANCEL_RADIUS_M);
if(!validation.ok && validation.distanceM > STOP_CANCEL_RADIUS_M){
cancelActiveFacultyRequest("faculty_moved_" + Math.round(validation.distanceM) + "m_from_stop");
}
},
function(error){
console.warn("Live faculty location check failed:",error);
},
{
enableHighAccuracy:true,
timeout:15000,
maximumAge:0
}
);

}

function getCooldownRemaining(){

if(!currentFacultyId){
return 0;
}

const last =
localStorage.getItem(
"lastBuggyRequest_" + currentFacultyId
);

if(!last){
return 0;
}

const remaining =
REQUEST_COOLDOWN_MS -
(Date.now() - parseInt(last));

return remaining > 0 ? remaining : 0;

}

function refreshCooldownUI(){

const remaining = getCooldownRemaining();

const btns =
document.querySelectorAll(".requestGrid .reqBtn");

const timer =
document.getElementById("cooldownTimer");

if(remaining > 0){

btns.forEach(function(b){
b.disabled = true;
b.style.opacity = 0.5;
b.style.cursor = "not-allowed";
});

const secs = Math.ceil(remaining / 1000);
const m = Math.floor(secs / 60);
const s = secs % 60;

if(timer){
timer.innerText =
"You can request again in " +
m + "m " + (s < 10 ? "0" : "") + s + "s";
}

if(!cooldownInterval){
cooldownInterval =
setInterval(refreshCooldownUI, 1000);
}

}
else{

btns.forEach(function(b){
const enabledByLocation = !!facultyInsideAnyStop;
b.disabled = !enabledByLocation;
b.style.opacity = enabledByLocation ? 1 : 0.5;
b.style.cursor = enabledByLocation ? "pointer" : "not-allowed";
});

if(timer){
timer.innerText = "";
}

if(cooldownInterval){
clearInterval(cooldownInterval);
cooldownInterval = null;
}

}

}

async function sendRequest(block){

if(!isAuthenticated){

document.getElementById("requestStatus")
.innerText =
"Employee authentication required.";

return;

}

await updateServiceNotice();

const available =
await isServiceAvailable();

if(!available){

document.getElementById("requestStatus")
.innerText =
"Buggy service is currently unavailable as per the displayed timings. Please try during service hours.";

return;

}

if(getCooldownRemaining() > 0){

refreshCooldownUI();

return;

}

const status = document.getElementById("requestStatus");

if(status){
status.innerText = "Allow location access when prompted.";
}

try{

const position = await getCurrentPositionPromise();
const validation = validateFacultyNearAnyStop(position.coords,STOP_ALLOWED_RADIUS_M);

if(!validation.ok){
if(status){ status.innerText = validation.message; }
setRequestButtonsEnabled(false);
return;
}

requestBuggy(block,{
lat:position.coords.latitude,
lng:position.coords.longitude,
accuracy:position.coords.accuracy,
validatedAt:Date.now(),
validationType:"within_any_stop_radius",
nearestStop:validation.nearestBlock,
allowedRadiusM:STOP_ALLOWED_RADIUS_M,
cancelRadiusM:STOP_CANCEL_RADIUS_M,
distanceM:validation.distanceM
});

startActiveRequestLocationWatch(block);

localStorage.setItem(
"lastBuggyRequest_" + currentFacultyId,
Date.now()
);

refreshCooldownUI();

if(status){
status.innerText =
"Request sent from " +
block.replaceAll("_"," ") +
". Location verified within 40 m of " + validation.nearestBlock.replaceAll("_"," ") + ". Please stay near a stop; the request will cancel if you move more than 50 m away.";
}

}
catch(error){
console.error(error);
if(status){
status.innerText = "Location permission is needed to book a buggy.";
}
}

}


setInterval(async function(){

const available = await refreshLoginAvailability();

if(!available && isAuthenticated){

const status = document.getElementById("requestStatus");
if(status){
status.innerText = "Buggy services are not available now. You have been logged out.";
}

logoutFaculty();

}

},60000);

window.onpageshow =
function(event){

if(event.persisted){

window.location.reload();

}

};

if('serviceWorker' in navigator){

navigator.serviceWorker
.register('service-worker.js')
.then(function(){

console.log("PWA enabled");

});

}

