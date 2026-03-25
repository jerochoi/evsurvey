importScripts('https://unpkg.com/supercluster@7.1.5/dist/supercluster.min.js');

var m_stations = [];
var superclusterIndex = null;

// Replicate Map class for compatibility if needed, or use native Map/Object
// The original code used a custom Map function. We can use native JS Map or Object.
// We'll stick to simple Arrays/Objects for the worker data storage to keep it fast.

// --- Class Definitions from evMap1.js (Simplified for Worker) ---

var Charger = function (sid, cid, ctp, cst, tst, smt) {
    this.sid = sid; this.cid = cid; this.ctp = ctp; this.cst = cst; this.tst = tst; this.smt = smt;
    // this.updateStat = function (nStat, tStat) { this.cst = nStat; this.tst = tStat; }; // Not needed in worker
};

var Station = function (sid, snm, x, y, hol, park, utime, ctp, chgeMange, skindt, zscode, limit, power, trf, smt) {
    this.smt = (smt == "Y" ? "Y" : "N");
    this.trf = trf;
    this.sid = sid;
    this.snm = snm;
    this.x = parseFloat(x);
    this.y = parseFloat(y);
    // Pre-calculate Web Mercator here to save time on main thread? 
    // Supercluster expects [lon, lat]. OpenLayers Render expects Web Mercator.
    // We will return GeoJSON with Web Mercator coordinates preferably, or LonLat and let OL transform (VectorImage is fast).
    // Let's stick to LonLat for Supercluster.

    this.hol = hol;
    this.stat = "";
    this.park = park;
    this.utime = utime;
    this.skindt = skindt;
    this.ctp = ctp;
    this.chgeMange = (chgeMange == null || chgeMange == '') ? '00' : chgeMange;
    this.limit = limit;
    this.power = Number(power);
    this.mode = (limit == "Y" ? '_l' : '') + (power >= 350 ? '_p2' : '') + (power >= 200 && power < 350 ? '_p1' : '') + (power >= 100 && power < 200 ? '_p0' : '');

    this.chargers = {}; // Object instead of custom Map

    this.setMode = function (limit, power, ctp) {
        this.limit = (this.limit > limit) ? limit : this.limit;
        this.power = (this.power > power) ? this.power : power;
        this.mode = (limit == "Y" ? '_l' : '') + (power >= 350 ? '_p2' : '') + (power >= 200 && power < 350 ? '_p1' : '') + (power >= 100 && power < 200 ? '_p0' : '');
    };

    // Refactored setStat to accept filter arrays directly
    this.setStat = function (filterType, filterMng, filterTrf, filterSmrt) {
        var nStat = "";
        var allStat = "";

        // Check Chargers
        for (var cid in this.chargers) {
            var cChgr = this.chargers[cid];
            allStat = (this.getStatOrder(allStat) >= this.getStatOrder(cChgr.cst)) ? allStat : cChgr.cst;

            if (this.isContainExcept(filterMng, this.chgeMange)) continue;
            if (this.isContainExcept(filterType, cChgr.ctp)) continue;
            if (this.isContainExcept(filterTrf, this.trf)) continue;
            if (this.isContainExcept(filterSmrt, this.smt)) continue;

            nStat = (this.getStatOrder(nStat) >= this.getStatOrder(cChgr.cst)) ? nStat : cChgr.cst;
        }

        if (this.stat == nStat) {
            return false;
        } else {
            this.stat = nStat;
            return true; // Status changed
        }
    };

    this.isContainExcept = function (filterArry, stat) {
        if (typeof filterArry == "undefined" || filterArry == null || !filterArry.length) return false;
        return filterArry.includes(stat);
    };

    this.getStatOrder = function (stat) {
        if (stat == "2") return "8";
        if (stat == "3") return "7";
        if (stat == "5") return "6";
        if (stat == "1") return "5";
        if (stat == "8") return "4";
        if (stat == "9") return "3";
        if (stat == "4") return "2";
        if (stat == "7") return "1";
        return "0";
    };
};

// --- Worker Logic ---

self.onmessage = function (e) {
    var data = e.data;

    switch (data.type) {
        case 'loadData':
            loadData(data.files);
            break;
        case 'updateFilters':
            updateFilters(data.filters, data.bbox, data.zoom);
            break;
        case 'getClusters':
            getClusters(data.bbox, data.zoom);
            break;
    }
};

async function loadData(files) {
    m_stations = [];
    var totalLoaded = 0;

    try {
        const fetchPromises = files.map(async (url) => {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');

            // Handle .gz if browser supports DecompressionStream, else assume automatic handling or plain json
            // Note: In typical browser fetch, .gz is handled transparently if Content-Encoding header is set.
            // If it's a raw .gz file on disk/static server without headers, we need DecompressionStream.

            let jsonData;
            if (url.endsWith('.gz') && 'DecompressionStream' in self) {
                const blob = await response.blob();
                const ds = new DecompressionStream('gzip');
                const stream = blob.stream().pipeThrough(ds);
                jsonData = await new Response(stream).json();
            } else {
                jsonData = await response.json();
            }
            return jsonData;
        });

        const results = await Promise.all(fetchPromises);

        // Process Data
        // Use a temporary map to merge duplicates by SID
        let stationMap = {};

        results.forEach(data => {
            if (data.chargerList) {
                data.chargerList.forEach(item => {
                    let st = stationMap[item.sid];
                    if (!st) {
                        st = new Station(
                            item.sid, item.snm, item.x, item.y,
                            item.hol, 0, item.ut, item.ctp,
                            item.cm || '00', "", item.zs, item.lm, item.po,
                            item.trf, item.smt
                        );
                        stationMap[item.sid] = st;
                    }

                    var chgr = new Charger(item.sid, item.cid, item.ctp, item.cst, item.tst, item.smt);
                    st.chargers[item.cid] = chgr;

                    // Update existing logic
                    if (stationMap[item.sid]) {
                        st.setMode(item.lm, item.po, item.ctp);
                        if (item.cm && item.cm !== '00') {
                            st.chgeMange = item.cm;
                        }
                    }
                });
            }
        });

        // Convert map to array for indexing
        m_stations = Object.values(stationMap);

        self.postMessage({ type: 'dataLoaded', count: m_stations.length });

    } catch (err) {
        console.error("Worker Load Error:", err);
        self.postMessage({ type: 'error', message: err.toString() });
    }
}

// Global Filter State in Worker
var currentFilters = {
    type: [],
    mng: [],
    trf: [],
    smrt: [],
    free: [],
    search: '',
    is24: false
};

function updateFilters(filters, bbox, zoom) {
    currentFilters = filters;
    // Re-index is not always needed for Supercluster if simply filtering points.
    // But Supercluster builds index on creation. So we filter points FIRST, then create index.
    // If filters change, we MUST rebuild the index.
    rebuildIndex();
    getClusters(bbox, zoom);
}

function rebuildIndex() {
    // 1. Filter Points
    var filteredPoints = [];

    for (var i = 0; i < m_stations.length; i++) {
        var st = m_stations[i];

        // Search Filter
        if (currentFilters.search && st.snm.indexOf(currentFilters.search) === -1) continue;
        if (currentFilters.is24 && st.utime != "24시간 이용가능") continue;

        // Status Logic (Mutates st.stat)
        st.setStat(currentFilters.type, currentFilters.mng, currentFilters.trf, currentFilters.smrt);

        if (st.stat != "") {
            // Calculate charger summary for popup
            var available = 0;
            var total = 0;
            for (var cid in st.chargers) {
                total++;
                if (st.chargers[cid].cst == '2') available++;
            }

            // Create GeoJSON Feature for Supercluster
            filteredPoints.push({
                type: 'Feature',
                properties: {
                    sid: st.sid,
                    snm: st.snm,
                    utime: st.utime,
                    chgeMange: st.chgeMange,
                    stat: st.stat,
                    mode: st.mode,
                    available: available,
                    total: total
                },
                geometry: {
                    type: 'Point',
                    coordinates: [st.y, st.x] // Supercluster uses [Lon, Lat]
                }
            });
        }
    }

    // 2. Create Supercluster
    superclusterIndex = new Supercluster({
        radius: 40, // consistent with openlayers cluster distance
        maxZoom: 16
    });

    superclusterIndex.load(filteredPoints);
}

function getClusters(bbox, zoom) {
    if (!superclusterIndex) return;

    // Supercluster expects bbox as [minLng, minLat, maxLng, maxLat]
    // OpenLayers BBox might be in WebMercator. Caller must transform to LonLat.

    var clusters = superclusterIndex.getClusters(bbox, Math.floor(zoom));

    self.postMessage({
        type: 'clustersUpdated',
        clusters: clusters
    });
}
