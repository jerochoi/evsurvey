
/**
 * evMapLeaflet.js
 * Adapted from evMap.js for Leaflet compatibility.
 * Handles loading and rendering of charging station data.
 */

class Station {
    constructor(data) {
        // Map JSON fields to properties
        this.sid = data.sid; // Station ID
        this.snm = data.snm; // Station Name

        // Coordinates: x=Lat, y=Lon in the JSON based on value ranges (Korea is 34-38 Lat)
        this.lat = parseFloat(data.x);
        this.lng = parseFloat(data.y);

        // Business ID / Operator Code
        // JSON 'cid' is Charger ID (01, 02...), not Business ID.
        // We default to '00' (Unknown/Default) or map from SID prefix if known.
        // As we don't have the mapping table, "00" is the safest placeholder to use with logo_00.png.
        this.chgeMange = "00";

        this.stat = data.cst; // Status (2: Available, 3: Charging, etc.)
        this.type = data.ctp; // Connector Type
        this.power = data.p || 0; // Power
        this.addr = data.adr || "";
        this.utime = data.ut || "";

        // Determine Mode (Power/Limit) - simplified from evMap.js
        this.mode = "";
        if (this.power >= 200) this.mode = "ultra_fast";
        else if (this.power >= 100) this.mode = "fast";

        // Status Name mapping
        this.statName = this.getStatName(this.stat);
    }

    getStatName(stat) {
        // Adapted from evMap.js
        if (stat == 2) return "사용가능";
        if (stat == 3) return "충전중";
        if (stat == 1) return "통신미연결";
        if (stat == 4) return "운영중지";
        if (stat == 5) return "점검중";
        return "알수없음";
    }

    getStatusColor() {
        // 2: Available (Green), 3: Charging (Orange), Others: Red/Gray
        if (this.stat == 2) return "#28a745"; // Green
        if (this.stat == 3) return "#fd7e14"; // Orange
        if (this.stat == 1 || this.stat == 4 || this.stat == 5) return "#dc3545"; // Red
        return "#6c757d"; // Gray
    }
}

// Marker Cluster Group
let markerClusterGroup = null;

async function loadEvStations(map) {
    console.log("Initializing EV Station Loader...");

    // Initialize Marker Cluster if not exists
    if (!markerClusterGroup) {
        if (L.markerClusterGroup) {
            markerClusterGroup = L.markerClusterGroup({
                maxClusterRadius: 50,
                // Custom Cluster Icon to match aesthetic
                iconCreateFunction: function (cluster) {
                    var childCount = cluster.getChildCount();
                    var c = ' marker-cluster-';
                    if (childCount < 10) {
                        c += 'small';
                    } else if (childCount < 100) {
                        c += 'medium';
                    } else {
                        c += 'large';
                    }

                    return new L.DivIcon({
                        html: '<div><span>' + childCount + '</span></div>',
                        className: 'marker-cluster' + c,
                        iconSize: new L.Point(40, 40)
                    });
                }
            });
            map.addLayer(markerClusterGroup);
        } else {
            console.warn("Leaflet.markercluster not loaded. Markers will be added directly.");
            markerClusterGroup = map; // Fallback to map
        }
    }

    // Load Data
    // We will load 'evMapList_me.json' first as it's smaller. 
    // The path is relative from survey1.html (in survery1/) to data (in evmap1/).
    const files = [
        '../evmap1/evMapList_me.json'
        // '../evmap1/evMapList_etc.json' // Heavy file, commented out for initial performance safety
    ];

    for (const file of files) {
        try {
            console.log(`Fetching ${file}...`);
            const response = await fetch(file);
            if (!response.ok) throw new Error(`Failed to load ${file}`);

            const json = await response.json();
            const list = json.chargerList || [];
            console.log(`Loaded ${list.length} stations from ${file}`);

            const markers = list.map(item => {
                const s = new Station(item);
                if (!s.lat || !s.lng) return null;

                // Create Custom Icon
                // Logo Path: ../evmap1/logo_layer/logo_{chgeMange}.png
                const logoUrl = `../evmap1/logo_layer/logo_${s.chgeMange}.png`;
                const color = s.getStatusColor();

                const iconHtml = `
                    <div style="
                        position: relative;
                        width: 36px;
                        height: 36px;
                        background: white;
                        border: 3px solid ${color};
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                        overflow: hidden;
                    ">
                        <img src="${logoUrl}" onerror="this.style.display='none'" style="width: 24px; height: 24px; object-fit: contain;">
                        <div style="
                            position: absolute;
                            bottom: -2px;
                            right: -2px;
                            width: 12px;
                            height: 12px;
                            background: ${color};
                            border-radius: 50%;
                            border: 2px solid white;
                        "></div>
                    </div>
                `;

                const icon = L.divIcon({
                    html: iconHtml,
                    className: 'custom-station-icon',
                    iconSize: [36, 36],
                    iconAnchor: [18, 36],
                    popupAnchor: [0, -36]
                });

                const marker = L.marker([s.lat, s.lng], { icon: icon });

                // Popup Content
                const popupContent = `
                    <div style="font-family:sans-serif; min-width:200px;">
                        <h3 style="margin:0 0 10px 0; font-size:16px; color:#333; border-bottom:1px solid #eee; padding-bottom:5px;">${s.snm}</h3>
                        <div style="display:grid; grid-template-columns: 80px 1fr; gap:5px; font-size:13px;">
                            <span style="color:#666;">상태:</span>
                            <span style="font-weight:bold; color:${color}">${s.statName}</span>
                            
                            <span style="color:#666;">운영/ID:</span>
                            <span>${s.sid}</span>
                                                        
                            <span style="color:#666;">출력:</span>
                            <span>${s.power > 0 ? s.power + 'kW' : '정보없음'}</span>
                            
                            <span style="color:#666;">운영시간:</span>
                            <span>${s.utime}</span>
                        </div>
                    </div>
                `;
                marker.bindPopup(popupContent);
                return marker;
            }).filter(m => m !== null);

            // Add to Cluster
            if (markers.length > 0) {
                markerClusterGroup.addLayers(markers);
            }

        } catch (e) {
            console.error(`Error processing ${file}:`, e);
        }
    }
}
