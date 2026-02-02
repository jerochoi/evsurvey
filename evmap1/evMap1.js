// version 15
function compare(a, b) { if (a.snm < b.snm) return -1; if (a.snm > b.snm) return 1; return 0; };

Map = function () { this.map = new Object(); };

Map.prototype = {
    put: function (key, value) { this.map[key] = value; },
    get: function (key) { return this.map[key]; },
    containsKey: function (key) { return key in this.map; },
    containsValue: function (value) { for (var prop in this.map) { if (this.map[prop] == value) return true; } return false; },
    isEmpty: function (key) { return (this.size() == 0); },
    clear: function () { for (var prop in this.map) { delete this.map[prop]; } },
    remove: function (key) { delete this.map[key]; },
    keys: function () { var keys = new Array(); for (var prop in this.map) { keys.push(prop); } return keys; },
    values: function () { var values = new Array(); for (var prop in this.map) { values.push(this.map[prop]); } return values; },
    size: function () { var count = 0; for (var prop in this.map) { count++; } return count; }
};

Charger = function (sid, cid, ctp, cst, tst, smt) {
    this.sid = sid; this.cid = cid; this.ctp = ctp; this.cst = cst; this.tst = tst; this.smt = smt;
    this.updateStat = function (nStat, tStat) { this.cst = nStat; this.tst = tStat; };
};

Station = function (sid, snm, x, y, hol, park, utime, ctp, chgeMange, skindt, zscode, limit, power, trf, smt) {
    this.smt = (smt == "Y" ? "Y" : "N");
    this.trf = trf;
    this.sid = sid;
    this.snm = snm;
    //this.adr = adr;
    //this.dro = dro; //도로명
    this.x = x;
    this.y = y;
    this.hol = hol; //휴무
    this.stat = ""; //대표상태 : ( 0:알수없음, 1:통신이상, 2:충전대기, 3:충전중, 4:운영중지, 5:점검중 ) 

    this.park = park; //주차비무료여부(0:무료, 1:유료)
    this.utime = utime; //이용시간정보 "24시간" 24시간이용 가능 

    this.skindt = skindt; //충전소 대분류
    this.ctp = ctp; //type

    this.ctpl = (ctp == '02' ? 1 : 0);
    this.ctps = (ctp == '02' ? 0 : 1);

    this.chgeMange = (chgeMange == null || chgeMange == '') ? '00' : chgeMange; // 운영 기관

    this.zcode = (zscode + "").substring(0, 2);
    this.zscode = zscode + "";

    this.limit = limit;
    this.power = Number(power);
    this.mode = (limit == "Y" ? '_l' : '') + (power >= 350 ? '_p2' : '') + (power >= 200 && power < 350 ? '_p1' : '') + (power >= 100 && power < 200 ? '_p0' : '');

    this.marker = null;

    this.chargers = new Map(); //충전기 목록 

    this.setMode = function (limit, power, ctp) {
        this.limit = (this.limit > limit) ? limit : this.limit; // Y/N
        this.power = (this.power > power) ? this.power : power; // 0/1/2
        this.mode = (limit == "Y" ? '_l' : '') + (power >= 350 ? '_p2' : '') + (power >= 200 && power < 350 ? '_p1' : '') + (power >= 100 && power < 200 ? '_p0' : '');

        this.ctpl += (ctp == '02' ? 1 : 0);
        this.ctps += (ctp == '02' ? 0 : 1);
    };

    this.setSmt = function (smt) {
        if (this.smt == "Y") return false;
        smt = (smt == "Y" ? "Y" : "N");
        this.smt = smt;
    };

    this.setStat = function (ArryTypefilter, ArryMngFilter, ArryTrfFilter, ArraySmrtFilter) {
        var nStat = "";
        var allStat = "";
        var tKeys = this.chargers.keys();
        var i = 0;

        for (i = 0; i < tKeys.length; i++) {
            cChgr = this.chargers.get(tKeys[i]);
            allStat = (this.getStatOrder(allStat) >= this.getStatOrder(cChgr.cst)) ? allStat : cChgr.cst;

            if (this.isContainExcept(ArryMngFilter, this.chgeMange)) continue; // 운영기관 필터링
            //if( this.isContainExcept( ArryStatFilter, cChgr.cst ) ) continue; // 시범운영 후순위
            if (this.isContainExcept(ArryTypefilter, cChgr.ctp)) continue;
            if (this.isContainExcept(ArryTrfFilter, this.trf)) continue;  //편의제공(교통약자)
            if (this.isContainExcept(ArraySmrtFilter, this.smt)) continue;  //스마트제어 충전기

            nStat = (this.getStatOrder(nStat) >= this.getStatOrder(cChgr.cst)) ? nStat : cChgr.cst;
        }

        if (this.stat == nStat) {
            return false;
        } else {
            this.stat = nStat;
            return true;
        }
    };

    this.isContainExcept = function (fillterArry, stat) {
        if (typeof fillterArry == "undefined" || fillterArry == null || !fillterArry.length) return false;
        return fillterArry.includes(stat);
    };

    this.getStatOrder = function (stat) {
        if (stat == "2") return "8"; //충전대기 
        if (stat == "3") return "7"; //충전중 
        if (stat == "5") return "6"; //점검중
        if (stat == "1") return "5"; //통신미연결
        if (stat == "8") return "4"; //상태미확인
        if (stat == "9") return "3"; //타기관
        if (stat == "4") return "2"; //운영중지
        if (stat == "7") return "1"; //
        return "0"; //알수없음
    };

    this.getStatOrderAdmin = function (stat) {
        if (stat == "1" || stat == 1) return 6; //통신미연결
        if (stat == "4" || stat == 4) return 5; //운영중지
        if (stat == "5" || stat == 5) return 4; //점검중
        if (stat == "2" || stat == 2) return 3; //충전대기
        if (stat == "3" || stat == 3) return 2; //충전중
        if (stat == "7" || stat == 7) return 1; //시범운영 
        if (stat == "9" || stat == 9) return 1; //타기관
        return 0; //알수없음
    };

    this.getStatName = function (stat) {
        if (stat == "1" || stat == 1) return "통신미연결";
        if (stat == "4" || stat == 4) return "운영중지";
        if (stat == "5" || stat == 5) return "점검중";
        if (stat == "2" || stat == 2) return "사용가능";
        if (stat == "3" || stat == 3) return "충전중";
        if (stat == "6" || stat == 6) return "예약중";
        if (stat == "7" || stat == 7) return "시범운영";
        if (stat == "9" || stat == 9) return "기타(정보미제공)";
        return "알수없음";
    };

    this.iconSizeByZoomLevel = function (zoom) {
        if (zoom < 2) return 1;
        if (zoom < 3) return 2;
        if (zoom < 4) return 3;
        if (zoom < 5) return 4;
        if (zoom < 6) return 5;
        return 6;
    };
};

var g_infoWindow;

var dflStat = new Array();
dflStat['17'] = '3'; dflStat['18'] = '3'; dflStat['27'] = '3'; dflStat['125'] = '3'; dflStat['60'] = '3';

function closeInfoWin() {
    stationListOverlay.setPosition(undefined);
    element_stationList.innerHTML = "";
}

$(document).on('click', 'div.popUp div.photos div', function () {
    tImg = $(this).children('img')[0];
    var ww = $(window).width();
    var wh = $(window).height();

    var iw;
    var ih;

    if (typeof tImg.naturalWidth == "undefined") {
        // IE 6/7/8
        var i = new Image();
        i.src = tImg.src;
        iw = i.width;
        ih = i.height;
    }
    else {
        // HTML5 browsers
        iw = tImg.naturalWidth;
        ih = tImg.naturalHeight;
    }

    if (iw > 500) iw = '500px;';

    if (iw < 200) iw = '200px';

    $("#stationInfoContent").html("<img id='img_1'  src='" + tImg.src + "' style='cursor:pointer;' width='" + iw + "px'/>");

    $("#stationImgWin").css('display', 'flex');

    $("#stationImgWin > #stationImgHead > span").unbind();
    $("#stationImgWin #b3, #img_1").bind("click", function () {
        $("#stationImgWin").hide();
    });

    $("#stationImgWin #b1").unbind(); //이벤트 중복 방지
    $("#stationImgWin #b1").bind("click", function () {
        $("#img_1").width($("#img_1").width() * 1.1);
    });

    $("#stationImgWin #b2").unbind(); //이벤트 중복 방지
    $("#stationImgWin #b2").bind("click", function () {
        if ($("#img_1").width() < 180) { alert("더이상 축소할 수 없습니다."); return; }
        $("#img_1").width($("#img_1").width() * .9);
    })
});

function reDrawStatAndMarker(isZoomUpdate) {
    var hasCircle = (typeof circleLayer !== 'undefined' && circleLayer !== null);

    // 20230523 : "지역명 검색"일 때 circleLayer 내에만 리스트 표시함
    if ($("#F_SEARCH_TYPE1").val() == 'area' && hasCircle && baseGround.getLayers().getArray().includes(circleLayer)) {
        reDrawStatAndMarkerCircle(circleLayer.getSource().getFeatures()[0].getGeometry());
        baseGround.removeLayer(clusterLayer);
        clusterDrawing(clusterFeatures);
        return false;
    }

    // 20230523 : "지역명 검색"아닐 때 circleLayer 지우기
    if ($("#F_SEARCH_TYPE1").val() != 'area' && hasCircle && baseGround.getLayers().getArray().includes(circleLayer))
        baseGround.removeLayer(circleLayer);

    reDrawStatAndMarker_("", 0, 0, isZoomUpdate);
}
var clusterFeatures = new Array();
var removeClusterFeatures = new Array();

function reDrawStatAndMarker_(uid, x, y, isZoomUpdate) {

    // Performance Optimization: If this is just a zoom update and we have features, reuse them.
    if (isZoomUpdate && clusterFeatures.length > 0) {
        clusterDrawing(clusterFeatures);
        return;
    }

    var filterType = getExceptType();
    var filterMng = getExceptMng();
    var filterTrf = getExceptTrf(); // 20230510 : 추가 
    var filterSmrt = getExceptSmrt(); // 스마트제어 충전기
    var f_24hour_mobile = $('#F_24HOUR1').is(':checked') && !$('.mapLeftWrap').is(':visible');
    var searchKeyword = $('#station-search').val(); // Get search input

    var tKeys = m_mapStations.keys();
    var arrayNum = 0;

    clusterFeatures = new Array();;

    for (var i = 0; i < tKeys.length; i++) {
        theStation = m_mapStations.get(tKeys[i]);

        // Search Filter
        if (searchKeyword && theStation.snm.indexOf(searchKeyword) === -1) continue;

        if (f_24hour_mobile && theStation.utime != "24시간 이용가능") continue;

        theStation.setStat(filterType, filterMng, filterTrf, filterSmrt);

        if (theStation.stat != "") {

            stationSpot[arrayNum] = {
                sid: theStation.sid, id: arrayNum, y: parseFloat(theStation.y), x: parseFloat(theStation.x)
                , chgeMange: theStation.chgeMange, stat: theStation.stat, mode: theStation.mode
            }

            clusterFeatures[arrayNum] = new ol.Feature({
                geometry: new ol.geom.Point(ol.proj.transform([parseFloat(theStation.y), parseFloat(theStation.x)], 'EPSG:4326', 'EPSG:3857'))
                , chgeMange: theStation.chgeMange
                , sid: theStation.sid
                , id: arrayNum
                , stat: theStation.stat
                , mode: theStation.mode
            });
            arrayNum++;
        }
    }

    // Update Sidebar Count
    $('#status-count').text(arrayNum);

    baseGround.removeLayer(clusterLayer); // 20230417 : attempt remove +0.01 gimmick
    clusterDrawing(clusterFeatures);
}

var styleCache = {}; // 20230510 : 줌레벨이 declusterZoom이상시 style를 기록한다
function clusterDrawing(clusterFeatures) {

    if (Object.keys(stationLayer).length > 0) {
        baseGround.removeLayer(stationLayer);
        stationLayer = new Object();
        clustersAlone = new Array();
    }

    if (Object.keys(clusterLayer).length > 0) {
        baseGround.removeLayer(clusterLayer);
        clusterLayer = new Object();
    }

    var _newDistance;
    if (baseGround.getView().getZoom() >= declusterZoom) {
        _newDistance = declusterDistance;
    } else {
        _newDistance = clusterDistance + mapView.getResolution() / 2; // 20230524 : test simpler function
    }

    var clusterSource = new ol.source.Cluster({
        distance: _newDistance,
        source: new ol.source.Vector({ features: clusterFeatures })
    });

    clusterLayer = new ol.layer.Vector({
        name: 'clusterLayer', id: 'cluster',
        source: clusterSource,
        style: simplifiedStyle, // originalStyle(feature), // end style
        zIndex: 20
    });

    baseGround.addLayer(clusterLayer);
}

function simplifiedStyle(feature) {
    var size = feature.get('features').length;

    // Direct render for single items when zoomed in
    if (mapView.getZoom() >= declusterZoom && size == 1) {
        var originalFeature = feature.get('features')[0];
        // Ensure properties exist (added in reDrawStatAndMarker_)
        var chgeMange = originalFeature.get('chgeMange');
        var stat = originalFeature.get('stat');
        var mode = originalFeature.get('mode');

        // Use existing getMarkerKey and getMarkerStyle logic
        var markerKey = getMarkerKey(chgeMange, stat, mode);
        return getMarkerStyle(markerKey);
    }

    // considerations: 나눔을 계산시 비싸서, 수동으로 if게이트 처리한다
    var sizeBracket = Math.floor(size / 200);
    let style = styleCache[sizeBracket];

    if (!style) {
        var radius = sizeBracket * 2 + 20;
        style = new ol.style.Style({
            image: new ol.style.Circle({ radius: radius, fill: new ol.style.Fill({ color: 'rgba(0, 76, 161, 0.75)' }) }),
            text: new ol.style.Text({
                fill: new ol.style.Fill({ color: '#FFF' }), font: 'bold 15px Arial', offsetX: 0.5, offsetY: 1, scale: 1, text: size.toString()
            })
        });
        styleCache[sizeBracket] = style;
    } else {
        style.getText().setText(size.toString());
    }

    return style;
}

function markerDrawing() {
    stationLayer = new Object();

    var stationFeature = new Array();
    $.each(clustersAlone, function (i, idkey) {
        $.each(stationSpot, function (key, object) {
            if (idkey == object.id) {

                stationFeature[i] = new ol.Feature({
                    geometry: new ol.geom.Point(ol.proj.transform([object.y, object.x], 'EPSG:4326', 'EPSG:3857')), kind: 'ExistingStation'
                    , sid: object.sid, id: object.id, stationY: object.y, stationX: object.x, chgeMange: object.chgeMange, stat: object.stat, mode: object.mode
                });
            }
        });
    });

    stationLayer = new ol.layer.Vector({ name: 'station', id: 'station', source: new ol.source.Vector({ features: stationFeature }), style: createStyle, zIndex: 20 });
    baseGround.addLayer(stationLayer);
    //	indicatorLayer.setSource(new ol.source.Vector({features: stationFeature}));

}

var iconCache = {};	// 20230531 - cache icon images
function createStyle(feature, resolution) {

    var chageMange = feature.get('chgeMange');
    var stat = feature.get('stat');
    var mode = feature.get('mode');
    var icon_key = getMarkerKey(chageMange, stat, mode);

    return getMarkerStyle(icon_key);
}

function getExceptStat() {
    //	var exceptArr = new Array();
    //	return exceptArr;
    return new Array();
}

function getExceptType() {
    var chtypeArr = [['01', 'B', 0], ['02', 'D', 0], ['03', 'BC', 0],
    ['04', 'A', 0], ['05', 'AB', 0], ['06', 'ABC', 0],
    ['07', 'C', 0], ['08', 'E', 0], ['09', 'F', 0], ['10', 'AF', 0]];
    var exceptArr = new Array();

    $(".filterType").each(function (i) {
        if ($(this).is(':checked')) {
            for (var i = 0; i < chtypeArr.length; i++) {
                if (chtypeArr[i][1].indexOf($(this).val()) > -1) {
                    chtypeArr[i][2] = 1;
                }
            }
        }
    });

    for (var i = 0; i < chtypeArr.length; i++) {
        if (chtypeArr[i][2] == 0) {
            exceptArr.push(chtypeArr[i][0]);
        }
    }

    return exceptArr;
}

function getExceptTypeMobile() {
    var chtypeArr = [['01', 'B', 0], ['02', 'D', 0], ['03', 'BC', 0],
    ['04', 'A', 0], ['05', 'AB', 0], ['06', 'ABC', 0],
    ['07', 'C', 0], ['08', 'E', 0], ['09', 'F', 0], ['10', 'AF', 0]];
    var exceptArr = new Array();
    var cntAll = 0;

    $(".filterType").each(function (i) {
        if ($(this).is(':checked')) {
            for (var i = 0; i < chtypeArr.length; i++) {
                if (chtypeArr[i][1].indexOf($(this).val()) > -1) {
                    chtypeArr[i][2] = 1;
                }
            }
        }
    });

    for (var i = 0; i < chtypeArr.length; i++) {
        if (chtypeArr[i][2] == 0) {
            exceptArr.push(chtypeArr[i][0]);
        } else
            cntAll++;
    }

    if (cntAll == chtypeArr.length) return [''];
    return exceptArr;
}

function getExceptMng() {
    var exceptArr = new Array();

    $(".filterMng").each(function (i) {
        if (!$(this).is(':checked')) exceptArr.push($(this).val());
    });

    if ($("#chrgmng00").length > 0 && $("#chrgmng00").prop("checked") == false) {
        exceptArr.push(null);
    }

    return exceptArr;
}

function getExceptFree() {
    var exceptArr = new Array();

    $(".filterFree").each(function (i) {
        if (!$(this).is(':checked')) exceptArr.push($(this).val());
    });

    return exceptArr;
}

function getExceptTrf() {
    if ($("#chktrf").is(":checked")) return ["N"];
    else return [];
}

function getExceptSmrt() {
    if ($("#F_SMART_CHRGR1").is(":checked")) return ["N"];
    else return [];
}

function getMarkerIcon(chgeMange, stat, mode) {
    var imgUrl;

    if (_marker_kind == "P") {
        imgUrl = $("div#map").data("contextpath") + "/img/monitor/marker/st_point_blue.png";
        return imgUrl;
    }

    imgUrl = getImageInfo(chgeMange, stat, mode);
    return imgUrl;
}

function getImageInfo(busi_id, stat_cd, mode) {
    if (stat_cd == null || stat_cd == "" || stat_cd == "8" || stat_cd == "9") stat_cd = "0"; //상태미확인
    else if (stat_cd == "4" || stat_cd == "5") stat_cd = "1";	//사용불가

    var stat = dflStat[busi_id + ''];
    if (stat != undefined && stat != "") {
        stat_cd = stat;
    }

    imgUrl = $("div#map").data("contextpath") + '/logo_layer/logo_' + busi_id + '.png';
    return imgUrl;
}

function getMarkerKey(busi_id, stat_cd, mode) {

    var markerKey = new Array;

    if (_marker_kind == "P") return "st_point_blue";

    if (stat_cd == null || stat_cd == "" || stat_cd == "8" || stat_cd == "9") stat_cd = "0";
    else if (stat_cd == "4" || stat_cd == "5") stat_cd = "1";

    if (stat_cd == "2" && mode != null && mode.includes("_l")) stat_cd = "4"; // '충전대기 ' && '이용자제한 Y' -> 이용자제한 핀 마크

    var stat = dflStat[busi_id + ''];
    if (stat != undefined && stat != "") stat_cd = stat;

    markerKey.push(busi_id);
    markerKey.push(stat_cd);
    markerKey.push(mode);

    return markerKey;
}

var markerLayerCache = {};
var logoCache = {};
function getMarkerStyle(markerKey) {

    var returnStyle = new Array;
    var busi_id = markerKey[0];
    var stat_cd = markerKey[1];
    var mode = markerKey[2];
    var contextPath = $("div#map").data("contextpath") || "";

    // 1. Station Status Marker (Main Dot)
    let color = '#999';
    if (stat_cd == '2') color = '#28a745'; // Available - Green
    else if (stat_cd == '3') color = '#fd7e14'; // Charging - Orange
    else if (['1', '4', '5'].includes(stat_cd)) color = '#dc3545'; // Error - Red

    let markerLayerStyle = new ol.style.Style({
        image: new ol.style.Circle({
            radius: 13,
            fill: new ol.style.Fill({ color: '#ffffff' }),
            stroke: new ol.style.Stroke({ color: color, width: 5 })
        })
    });
    returnStyle.push(markerLayerStyle);

    // 2. Logo Icon (Overlay)
    // Path: logo_layer/logo_{id}.png - Using relative path from contextpath
    // Default to '00' if error or unknown
    let logoStyle = logoCache[busi_id];
    if (!logoStyle) {
        logoStyle = new ol.style.Style({
            image: new ol.style.Icon({
                src: contextPath + '/logo_layer/logo_' + busi_id + '.png',
                scale: 1.4, // Increased from 0.8 to make it fill the circle more
                displacement: [2, 0] // slightly move right
            }),
        });
        logoCache[busi_id] = logoStyle;
    }
    returnStyle.push(logoStyle);

    // 3. Mode/Type Indicator (Simplified)
    if (mode && mode.includes("_p")) {
        // Add a small inner dot for High Power
        let modeColor = '#007bff';
        if (mode.includes("_p2")) modeColor = '#6610f2';

        let modeStyle = new ol.style.Style({
            image: new ol.style.Circle({
                radius: 4,
                fill: new ol.style.Fill({ color: modeColor }) // Solid dot in center
            })
        });
        returnStyle.push(modeStyle);
    }

    return returnStyle;
}


function getMngIcon(chgeMange) {
    imgUrl = $("div#map").data("contextpath") + '/logo_layer/logo_' + chgeMange + '.png';
    return imgUrl;
}

function getStatSpan(busi_id, stat_cd, limit) {
    if (stat_cd == null || stat_cd == "" || stat_cd == "8" || stat_cd == "9")
        stat_cd = "0";
    else if (stat_cd == "4" || stat_cd == "5")
        stat_cd = "1";

    if (stat_cd == '2') {//충전기대기
        if (limit == "Y")
            return '<span class="state state_trq">이용자제한</span>';
        else
            return '<span class="state">사용가능</span>';
    } else if (stat_cd == '3') {//충전중
        return '<span class="state state_gr">사용중</span>';
    } else if (stat_cd == '1') {//운영중지
        return '<span class="state state_black">사용불가</span>';
    } else if (stat_cd == '0') {//타기관
        return '<span class="state state_org">상태미확인</span>';
    } else return '';
}

//20230426 : zoom level 비교
/** 
 * zoom level은 threshold (declusterZoom)의 
 * 수준 너머갈 때(올라가거나 내려가거나) 인식함
 *   zoom하기전에 OLD값등록
 *   zoom끝에 NOW값이랑 비교
 * */
var oldZoomLevel;
function isThresholdPassed(_zoomLevel) {
    return (oldZoomLevel < declusterZoom) !== (_zoomLevel < declusterZoom);
}

/* 지도 클라스터 리스트 지우기 */
// 20230515 : new_monitor.jsp에서 여기로 이동 
function stationListClose() {
    stationListOverlay.setPosition(undefined);
    element_stationList.innerHTML = "";
    return false;
}

/* 지역명 검색 */
// 20230518 : 영역검색 특별 함수 - reDrawStatAndMarker_ refactored 
// clusterFeatures과 stationSpot을 업데이트 한다
function reDrawStatAndMarkerCircle(olGeometry) {
    // 우쯕 필터 받기 
    var filterType = getExceptType();
    var filterMng = getExceptMng();
    var filterTrf = getExceptTrf();
    var filterSmrt = getExceptSmrt();

    var tKeys = m_mapStations.keys();

    var arrayNum = 0;

    clusterFeatures = new Array();
    stationSpot = new Array();

    for (var i = 0; i < tKeys.length; i++) {
        theStation = m_mapStations.get(tKeys[i]);

        // filter - right side options
        theStation.setStat(filterType, filterMng, filterTrf, filterSmrt);
        if (theStation.stat == undefined || theStation.stat == null || theStation.stat == "") continue;

        // filter - circle area
        var _pointCoordinates = ol.proj.transform([parseFloat(theStation.y), parseFloat(theStation.x)], 'EPSG:4326', 'EPSG:3857');
        if (!olGeometry.intersectsCoordinate(_pointCoordinates)) continue;

        stationSpot[arrayNum] = {
            sid: theStation.sid, id: arrayNum, y: parseFloat(theStation.y), x: parseFloat(theStation.x)
            , chgeMange: theStation.chgeMange, stat: theStation.stat, mode: theStation.mode
        }

        clusterFeatures[arrayNum] = new ol.Feature({
            geometry: new ol.geom.Point(_pointCoordinates)
            , chgeMange: theStation.chgeMange
            , sid: theStation.sid
            , id: arrayNum
        });

        arrayNum++;
    }

    // 20230522 : onClickStatAddr로 이동; 같은 위치과 줌레벨 이동시, 클라서터 재처리하지 않아서 clustersAlone재 생성하지 않게 보인다. 
    //baseGround.removeLayer(clusterLayer); 
    //clusterDrawing(clusterFeatures);
}

function indicateStationPosition(feature) {
    var param = {};

    if ($('.mapLeftWrap').is(':visible'))
        param = { 'r': 5, 'w': 0.5, 'duration': 1000, };
    else
        param = { 'r': 2.75, 'w': 0.05, 'duration': 1000, };

    const start = Date.now();
    const indicatorGeom = feature.getGeometry().clone();
    const listenerKey = baseLayer.on('postrender', animate);

    function animate(event) {
        const frameState = event.frameState;
        const elapsed = frameState.time - start;
        if (elapsed >= param.duration) {
            ol.Observable.unByKey(listenerKey);
            return;
        }

        const vectorContext = ol.render.getVectorContext(event);
        const elapsedRatio = elapsed / param.duration;

        const radius = ol.easing.easeOut(elapsedRatio * param.r + 1);
        const opacity = ol.easing.easeOut(1 - elapsedRatio);

        const indicatorStyle = new ol.style.Style({
            image: new ol.style.Circle({
                radius: radius,
                stroke: new ol.style.Stroke({
                    color: 'rgba(255, 0, 0, ' + opacity + ')',
                    width: 0.5 + opacity,
                }),
            }),
        });

        vectorContext.setStyle(indicatorStyle);
        vectorContext.drawGeometry(indicatorGeom);
        baseGround.render();
    }

}

// 20240503: haversine
function calcDistance(lat1, lon1, lat2, lon2) { // gps
    var theta = lon1 - lon2;
    dist = Math.sin(deg2rad(lat1)) * Math.sin(deg2rad(lat2)) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.cos(deg2rad(theta));
    dist = Math.acos(dist);
    dist = rad2deg(dist);
    dist = dist * 111.18957696; // (60 * 1.1515 * 1.609344)
    return Number(dist).toFixed(1);
}

function calcDistanceSquare(lat, lon, lat_d, lon_d) {
    var min_lat = lat - lat_d;
    var min_lon = lon - lon_d;
    var max_lat = lat + lat_d;
    var max_lon = lon + lon_d;

    return [
        calcDistance(min_lat, min_lon, min_lat, max_lon),
        calcDistance(max_lat, min_lon, max_lat, max_lon),
        calcDistance(min_lat, min_lon, max_lat, min_lon),
        calcDistance(min_lat, max_lon, max_lat, max_lon)
    ]
}

function deg2rad(deg) {
    return (deg * Math.PI / 180);
}
function rad2deg(rad) {
    return (rad * 180 / Math.PI);
}
