// evMap2.js - Leaflet Implementation

var map;
var markerClusterGroup;
var allStations = []; // Stores all Station objects
var filteredStations = []; // Stores currently visible stations

// --- Station Class ---
class Station {
    constructor(data) {
        this.sid = data.sid;
        this.snm = data.snm;
        this.lat = Number(data.x); // Assuming x is Lat
        // OpenLayers file used [y, x] for [Lng, Lat] transformation
        // EPSG:4326 is (Lon, Lat). So y=Lon, x=Lat.
        this.lng = Number(data.y);

        this.chgeMange = data.cm || '00'; // Operator ID
        this.utime = data.ut || "";
        this.stat = data.cst; // Status
        this.type = data.ctp; // Connector Type

        // Additional flags
        this.isSmart = data.smt === 'Y';
        this.isTraffic = data.trf === 'Y'; // Traffic accessibility

        // Parsed properties for filtering
        this.typeCode = this.getTypeCode(this.type);
    }

    getTypeCode(ctp) {
        // Mapping based on evMap.js conventions roughly
        // 02: DC ChadeMo (D)
        // 04: DC Combo (B) ? Need to verify mapping.
        // Let's stick to the values used in the HTML checkboxes: B, D, C, A
        // We need a reliable mapping.
        // From evMap.js:
        // ['01', 'B'], ['02', 'D'], ['03', 'BC'], ['04', 'A'], ('05', 'AB'), ('06', 'ABC'), ('07', 'C')
        // Let's implement a simple check.
        if (ctp === '01') return 'B'; // DC CHA
        if (ctp === '02') return 'D'; // DC Combo
        if (ctp === '03') return 'BD'; // DC CHA + DC Combo
        if (ctp === '04') return 'A'; // AC Slow
        if (ctp === '05') return 'AB'; // AC Slow + DC CHA
        if (ctp === '06') return 'ABD'; // AC Slow + DC CHA + DC Combo
        if (ctp === '07') return 'C'; // AC 3-Phase
        return 'UNKNOWN';
    }

    updateFrom(otherData) {
        // Update fields if better data available
        if (otherData.cm && otherData.cm !== '00') {
            this.chgeMange = otherData.cm;
        }
        // Can update other fields if needed
    }
}

// --- Initialization ---
$(document).ready(function () {
    initMap();
    loadData();
});

function initMap() {
    // Center on Korea
    map = L.map('map').setView([36.5, 127.5], 7);

    // Add Tile Layer (OSM)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Initialize Marker Cluster Group
    markerClusterGroup = L.markerClusterGroup({
        chunkedLoading: true, // Performance optimization
        maxClusterRadius: 50,
        disableClusteringAtZoom: 17, // Show individual markers at high zoom
        spiderfyOnMaxZoom: true,
        // Custom cluster styling if needed, but default is fine or we use CSS 
        // We added CSS for .marker-cluster-small/medium/large in HTML
    });

    map.addLayer(markerClusterGroup);

    // Geolocation
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(function (position) {
            var lat = position.coords.latitude;
            var lng = position.coords.longitude;
            map.flyTo([lat, lng], 15);
        }, function () {
            // Default View
        });
    }
}

function loadData() {
    var files = ["evMapList_me.json.gz", "evMapList_etc.json.gz"];

    async function fetchJson(url) {
        try {
            if (url.endsWith('.gz')) {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const blob = await response.blob();
                const ds = new DecompressionStream('gzip');
                const stream = blob.stream().pipeThrough(ds);
                const data = await new Response(stream).json();

                // Optional: Update loading text like in evmap1 logic if desired, 
                // but preserving existing structure mostly.
                return data;
            } else {
                return new Promise((resolve, reject) => {
                    $.getJSON(url, function (data) {
                        resolve(data);
                    }).fail(function () {
                        reject(new Error("Failed to load " + url));
                    });
                });
            }
        } catch (err) {
            console.error("Failed to load " + url + " : " + err);
            return { chargerList: [] }; // Return empty data on failure to keep Promise.all alive
        }
    }

    Promise.all(files.map(fetchJson)).then(function (results) {
        var stationMap = new Map();

        results.forEach(function (data) {
            if (data && data.chargerList) {
                data.chargerList.forEach(function (item) {
                    if (stationMap.has(item.sid)) {
                        // Update existing
                        stationMap.get(item.sid).updateFrom(item);
                    } else {
                        // Create new
                        stationMap.set(item.sid, new Station(item));
                    }
                });
            }
        });

        allStations = Array.from(stationMap.values());
        console.log("Total stations loaded: " + allStations.length);

        $("#loading-overlay").fadeOut();

        // Initial Draw
        reDrawMarkers();

    }).catch(function (err) {
        console.error("Data Load Error:", err);
        $("#loading-text").text("데이터 로드 실패");
    });
}

// --- Rendering & Filtering ---
function reDrawMarkers() {
    if (!markerClusterGroup) return;

    // Clear existing
    markerClusterGroup.clearLayers();

    // Get Filter States
    var checkedTypes = [];
    $('.filterType:checked').each(function () {
        checkedTypes.push($(this).val());
    });

    var f_24h = $('#F_24HOUR1').is(':checked');
    var f_smart = $('#F_SMART_CHRGR1').is(':checked');
    var f_traffic = $('#chktrf').is(':checked');
    var searchVal = $('#station-search').val().trim();

    var markersToAdd = [];
    var visibleCount = 0;

    allStations.forEach(st => {
        // 1. Search Filter
        if (searchVal && st.snm.indexOf(searchVal) === -1) return;

        // 2. 24Hour Filter
        if (f_24h && st.utime !== "24시간 이용가능") return;

        // 3. Smart Charger Filter
        if (f_smart && !st.isSmart) return;

        // 4. Traffic Weak Filter
        if (f_traffic && !st.isTraffic) return;

        // 5. Connector Type Filter
        // Logic: If station supports ANY of the checked types.
        // Station types are complex codes. Simplified check:
        // Does existing logic map cleanly? 
        // Let's use string inclusion for simplicity based on our TypeCode mapping.
        // If 'B' is checked, and station type contains 'B', it's valid?
        // Or strictly strictly?
        // evMap.js was complex. Let's do:
        // If ANY checked type is present in the Station's type mapping capability.
        // e.g. checked 'B' (ChaDeMo). Station '03' (BD) supports it? Yes.

        var typeMatch = false;
        // If no types checked, show nothing? Or everything? Usually nothing effectively filters all.
        // But simplified logic:
        for (var t of checkedTypes) {
            // Our st.typeCode might be 'BD'. Checked might be 'B'.
            // If st.typeCode.includes('B'), then yes.
            // CAREFUL: 'AB' includes 'B'. 'ABC' includes 'C'.
            if (st.typeCode.includes(t)) {
                typeMatch = true;
                break;
            }
        }
        if (!typeMatch) return;

        // Passed All Filters
        // Validation: Check for valid coordinates
        if (isNaN(st.lat) || isNaN(st.lng)) return;

        visibleCount++;
        markersToAdd.push(createMarker(st));
    });

    // Update Counter
    $('#status-count').text(visibleCount);

    // Batch Add (Leaflet.markercluster handles this well)
    if (markersToAdd.length > 0) {
        markerClusterGroup.addLayers(markersToAdd);
    }
}

function createMarker(st) {
    // Determine Color
    let color = '#999';
    if (st.stat == '2') color = '#28a745'; // Available
    else if (st.stat == '3') color = '#fd7e14'; // Charging
    else if (['1', '4', '5'].includes(st.stat)) color = '#dc3545'; // Error

    // Create Custom Icon
    // Use the logic to center the image better (displacement handled via CSS/HTML here)
    // Logo Path
    let logoUrl = 'logo_layer/logo_' + st.chgeMange + '.png';

    // HTML for DivIcon
    // We can use flexbox centering in the HTML string
    // Padding-left on the img can simulate displacement [2, 0]
    let iconHtml = `
        <div style="
            position: relative;
            width: 22px;
            height: 22px;
            background: white;
            border: 2px solid ${color};
            border-radius: 50%;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
        ">
            <img src="${logoUrl}" 
                style="width: 48px; height: 48px; object-fit: contain; transform: translateX(2px);" 
                onerror="this.style.display='none'">
        </div>
    `;

    var icon = L.divIcon({
        html: iconHtml,
        className: 'custom-leaflet-marker', // dummy class to remove default styles if needed
        iconSize: [20, 20],
        iconAnchor: [10, 10], // Center
        popupAnchor: [0, -15]
    });

    var marker = L.marker([st.lat, st.lng], { icon: icon });

    // Popup
    var popupContent = `
        <div style="font-size:14px; font-weight:bold; margin-bottom:5px; border-bottom:1px solid #eee; padding-bottom:5px;">${st.snm}</div>
        <div style="font-size:12px;"><b>운영시간:</b> ${st.utime}</div>
        <div style="font-size:12px;"><b>상태:</b> ${getStatString(st.stat)}</div>
    `;
    marker.bindPopup(popupContent);

    return marker;
}

function getStatString(stat) {
    if (stat == '2') return '<span style="color:green">사용가능</span>';
    if (stat == '3') return '<span style="color:orange">충전중</span>';
    if (['1', '4', '5'].includes(stat)) return '<span style="color:red">운영불가</span>';
    return '<span>알수없음</span>';
}
