//개발 키
//const _VWORD_KEY = '83A75653-EA63-384B-B284-D56C49332972';
//const _OPENAPI_KEY = '4dl8niFeI61Q3dGJF7IHuG27M6T3bIB3U6Wh18lVq8LJ+5LVp+Y5k5cZHbRIePlA+WBJGtDDT01mWc34o3SFFw=='
//운영 개발키
const _VWORD_KEY = '83A75653-EA63-384B-B284-D56C49332972';

$(function () {
  // 모든 버튼 submit 막기
  $('body').on('click', 'button', function (e) {
    e.preventDefault();
  });
  // 모든 input enter submit 막기
  $('body').on('keypress', 'input', function (e) {
    if (e.keyCode === 13) {
      e.preventDefault();
    }
  })
  // numOnly가 들어간 클래스는 숫자만 남기고 제거
  $('body').on('input', '.numOnly', function () {
    $(this).val($(this).val().replace(/[^.\d]/g, ''));
  });
  $('body').on('blur', '.numOnly', function () {
    let num = parseFloat($(this).val());
    num = isNaN(num) ? '' : num;
    $(this).val(num);
  });
  // 파일 용량 2mb 제한, 파일명 검사
  $('body').on('change', 'input[type="file"]', function () {
    const file = $(this)[0].files[0];

    if (typeof file != 'undefined') {
      const fileSize = file.size / (1024 * 1024);
      const fileName = file.name;

      if (fileSize >= 10) {
        alert('파일 크기는 10MB를 넘을 수 없습니다.');

        $(this).val('');
        $(this).replaceWith($(this).clone(true));

        return false;

      } else if(typeof fileName == 'string' && fnGetUtf8ByteSize(fileName) > 60) {
        alert('파일명이 너무 깁니다.');

        $(this).val('');
        $(this).replaceWith($(this).clone(true));

        return false;
      }
    }
  });
  //파일수정버튼
  $('.fileUpd').on('click', function (e) {
    let file = $(e.target).parent().find('input[type="file"]');

    file.click();
  });
  //파일제거버튼
  $('.fileRemove').on('click', function (e) {
    const obj = $(e.target);
    const file = $(obj.parent().children('input[type="file"]')[0]);
    const id = file.prop('id');
    const gb = id.split('_')[0];
    const index = id.substring(id.length - 1)
    let html = '';
    html += `
            <div id="${gb}_date_${index}" class="font_gray"></div>
            <input id="${gb}_file_${index}" type="file" class="file-width" onchange="fnFileDateAdd(this)"/>
        `;
    obj.parent().html(html);

  });
});

/**
 * 공통 Ajax 함수
 * @param url
 * @param param
 * @param callback
 * @param file multipart로 보낼때 false로 해줘야함
 */
const fnAjax = (url, param, callback, file = true) => {
  let result;

  $.ajax({
    async: false,
    type: 'POST',
    url: url,
    data: param,
    processData: file,
    contentType: file ? 'application/x-www-form-urlencoded; charset=UTF-8' : false,
    beforeSend: function () {
      $('body').prepend(
        '<div class="dot-spinner spinner" title="로딩중">' +
        ' <div class="dot-spinner__dot"></div>' +
        ' <div class="dot-spinner__dot"></div>' +
        ' <div class="dot-spinner__dot"></div>' +
        ' <div class="dot-spinner__dot"></div>' +
        ' <div class="dot-spinner__dot"></div>' +
        ' <div class="dot-spinner__dot"></div>' +
        ' <div class="dot-spinner__dot"></div>' +
        ' <div class="dot-spinner__dot"></div>' +
        '</div>' +
        '<div class="dim spinner"></div>'
      );
    },
    success: function (data) {
      result = data;
      callback(data);
    },
    error: function (xhr, status, error) {
      console.error(error, status);
      alert('오류가 발생했습니다. 관리자에게 문의해주세요.');
    },
    complete: function () {
      $('.spinner').remove();
    }
  });

  return result;
}

/**********************************************************************************************************************
 함 수 명 : fnBuildPaginatedList
 설    명 : pagination
 인    자 : url(string 유알엘), callback(callback function 리스트를 그리는 함수), param=(object 파라메타)
 사 용 법 : 한 번 그리면 페이지 이동할때 호출 하지 않아도 되지만
 , 파라미터를 바꾸는 경우 다시 호출해야합니다.
 작 성 일 : 2023-05-09
 작 성 자 : (애코브레인) 강민수
 수정일      수정자  수정내용
 2023-05-22 김윤성  사용법 변경
 **********************************************************************************************************************/
const fnBuildPaginatedList = (url, callback, param = {},) => {
  const {
    paging: {
      beginPage,
      endPage,
      next,
      page,
      prev,
      totalCount,
      totalPage
    }
  } = fnAjax(url, param, callback);

  let html = '';
  if (prev) {
    html += `<a href="#" data-page="1">`;
    html += `<span class="prev-2"></span></a>`;
    html += `<a href="#" data-page="${beginPage - 1}">`;
    html += `<span class="prev-1"></span></a>`;
  }
  for (let index = beginPage; index <= endPage; index++) {
    if (page === index) html += `<a href="#" class="active">${index}</a>`
    else html += `<a href="#" data-page="${index}">${index}</a>`
  }
  if (next) {
    html += `<a href="#" data-page="${endPage + 1}">`;
    html += `<span class="next-2"></span></a>`;
    html += `<a href="#" data-page="${totalPage}">`;
    html += `<span class="next-1"></span></a>`;
  }

  $("#paging").html(html);

  const fnRecursive = (page) => {
    fnBuildPaginatedList(url, callback, {...param, page});
  }

  $('#paging').off().on('click', 'a', function () {
    const page = $(this).data('page');
    page && fnRecursive(page);
  });
}


/**********************************************************************************************************************
 함 수 명 : fnExcelDownload
 설    명 : 엑셀 다운로드 진행(목록 화면 내 검색을 먼저 진행한 경우, 다운로드될 엑셀 데이터에도 해당 조건 적용되도록함)
 사 용 법 : fnExcelDownload(목록 내 검색 form 태그 id, 엑셀 다운로드 url)
 작 성 일 : 2023-06-29
 작 성 자 : (애코브레인) 김현승
 수정일      수정자  수정내용
 **********************************************************************************************************************/
const fnExcelDownload = (formId, url) => {
  let searchForm;
  let excelForm = $('<form></form>');

  // formId값으로 form 태그를 찾아서 존재하면 복사함
  if (formId != null && formId.trim() !== '') {
    searchForm = $('#' + formId);

    if (searchForm.length != 0) {
      excelForm = searchForm.clone();
    }
  }

  excelForm.attr('id', 'excelForm');
  excelForm.attr('action', url);
  excelForm.attr('method', 'POST')

  $('body').append(excelForm);

  excelForm.submit();
  excelForm.remove();
}


/**********************************************************************************************************************
 함 수 명 : fnAddComma
 설    명 : 천단위 쉼표, 소수점 반올림
 인    자 : any(any 바꿀 숫자/문자열), point=(Number 반올림 소수점 자릿수)
 사 용 법 : fnAddComma(1000) / fnAddComma(1000.12312312, 2)
 작 성 일 : 2023-05-09
 작 성 자 : (애코브레인) 김윤성
 수정일      수정자  수정내용
 **********************************************************************************************************************/
const fnAddComma = (any, point = 0) => {
  const num = parseFloat(any);

  return (!num && num !== 0)
    ? '-'
    : String(num.toFixed(point))
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**********************************************************************************************************************
 함 수 명 : fnOpenPopup
 설    명 : 팝업 열기
 인    자 : url(String 주소), nm(String 팝업 이름), option=(Object 팝업 옵션)
 사 용 법 : fnOpenPopup('/a/b/c.popup') 팝업 이름과 옵션은 디폴트가 아닌 경우 입력
 작 성 일 : 2023-05-09
 작 성 자 : (애코브레인) 김윤성
 수정일      수정자  수정내용
 **********************************************************************************************************************/
const fnOpenPopup = (url, nm, option = {}, data) => {
  const OPTION = {
    width: 1040,
    height: window.innerHeight,
    top: 50,
    left: window.screenLeft + (document.body.clientWidth / 2) - 500,
    scrollbars: 'no',
    location: 'no',
    toolbar: 'no',
    status: 'no',
    ...option
  };

  const target = nm ? nm : url;
  window.open(
    data ? '' : url,
    target,
    Object.entries(OPTION)
      .map(([key, val]) => `${key}=${val}`)
      .join(',')
  );

  if (data) {
    fnCreateFormAndSubmit([{type: 'hidden', name: 'id', value: 1}], url, target);
  }
}


/**********************************************************************************************************************
 함 수 명 : fnPopupInit
 설    명 : 팝업열때 기본 세팅
 인    자 : title(String 제목)
 사 용 법 : fnPopupInit('새로운 팝업') 미입력시 한국환경공단 출력
 작 성 일 : 2023-05-09
 작 성 자 : (애코브레인) 김윤성
 수정일      수정자  수정내용
 **********************************************************************************************************************/
const fnPopupInit = (title) => {
  title && (document.title = title);

  document.body.style.minWidth = '1020px';
  document.body.style.height = 'auto';
}

/**********************************************************************************************************************
 함 수 명 : fnDpActivate
 설    명 : 새로운 데이터 피커 만들었을때 활성화 하는 함수
 작 성 일 : 2023-05-09
 작 성 자 : (애코브레인) 강민수
 수정일      수정자  수정내용
 **********************************************************************************************************************/
const fnDpActivate = () => {
  //데이터피커 있을시 확성화
  if ($(".datepicker").length) {
    //$(".datepicker").datepicker({dateFormat: 'yy-mm-dd'});
    $(".datepicker").datepicker({
      dateFormat: "yy-mm-dd",
      closeText: "닫기",
      prevText: "이전달",
      nextText: "다음달",
      currentText: "오늘",
      monthNames: ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"],
      monthNamesShort: ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"],
      dayNames: ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"],
      dayNamesShort: ["일", "월", "화", "수", "목", "금", "토"],
      dayNamesMin: ["일", "월", "화", "수", "목", "금", "토"],
      weekHeader: "주",
      firstDay: 0,
      isRTL: false,
      showMonthAfterYear: true,
      yearSuffix: "년"
    });
    $(".datepicker.bg-gray").datepicker('disable').removeAttr('disabled');

  }
}

const fnCloseModal = (selecter) => {
  $("#" + selecter).empty();
}
/**********************************************************************************************************************
 함 수 명 : fnCreateModal
 설    명 : 모달 생성
 인    자 : selecter(html id), title, contentHtml (모달 넣을  html)
 사 용 법 : fnOpenPopup('modal','모달제목', '<div>test</div>')  selecter는 <div id="modal"> {id}
 작 성 일 : 2023-05-09
 작 성 자 : (애코브레인) 강민수
 수정일      수정자  수정내용
 **********************************************************************************************************************/
const fnCreateModal = (selecter, title, contentHtml, width, height) => {
  let modalHtml = '';

  modalHtml += `<div id="modal" class="modal-overlay">`;
  modalHtml += `<div class="modal-window">`;
  if (width === undefined || height === undefined) {
    modalHtml += `<div class="pop-up pop-width"">`;
  } else {
    modalHtml += `<div class="pop-up" style="min-width: ${width}px; width: ${width}px; height: ${height}px">`;
  }
  modalHtml += `<h5>${title}<div class="btn-close"><a href="#" onclick="fnCloseModal('${selecter}')"><img src="${_CTX_PATH}/resource/keco/images/btn_close.png" alt="닫기"></a></div></h5>`;
  modalHtml += `<div class="tb-detail-wrap con">`;
  modalHtml += contentHtml ?? '';
  modalHtml += `</div>`;
  modalHtml += `</div>`;
  modalHtml += `</div>`;
  modalHtml += `</div>`;

  $("#" + selecter).html(modalHtml);

  fnDpActivate();
}

/**********************************************************************************************************************
 함 수 명 : fnCreateFormAndSubmit
 설    명 : 포스트로 페이지 이동시 값 넘김 함수
 인    자 : params, url
 사 용 법 : 사업리스트에서 사업순번으로 수정페이지 이동시
 사업순번을 input 에 담아서 post로 보낸다
 작 성 일 : 2023-05-15
 작 성 자 : (애코브레인) 강민수
 수정일      수정자  수정내용
 **********************************************************************************************************************/
const fnCreateFormAndSubmit = (params, url, target) => {
  let form = document.createElement('form'); // 폼객체 생성

  params.map((value) => {
    let objs;
    objs = document.createElement('input');
    objs.setAttribute('type', value.type);
    objs.setAttribute('name', value.name);
    objs.setAttribute('value', value.value);
    form.appendChild(objs);
  });

  form.setAttribute('method', 'post');
  if (target) {
    form.setAttribute('target', target);
  }
  form.setAttribute('action', url);
  document.body.appendChild(form);
  form.submit();
}

/**********************************************************************************************************************
 함 수 명 : fnFileAdd
 설    명 : 테이블형태의 파일첨부 추가 버튼 함수
 인    자 : 요소(this), 구분 ID
 사 용 법 :
 <td>
 <div id="TESTfiles" style="width: 250px">
 <div class="items m-b-10">
 <div id="TESTdate_1" class="font_gray"></div>
 <input id="TESTfile_1" type="file" class="file-width" onchange="fnFileDateAdd(this)"/>
 </div>
 </div>
 </td>
 <td>
 <div id="btns" style="width: 30px">
 <div class="items m-b-10">
 <button class="btn_add" onclick="fnFileAdd(this, 'TEST');"><span>+</span></button>
 </div>
 </div>
 </td>
 형태의 td로 폼을 만들어 사용한다
 작 성 일 : 2023-05-15
 작 성 자 : (애코브레인) 강민수
 수정일      수정자  수정내용
 **********************************************************************************************************************/
const fnFileAdd = (obj, fId) => {

  let lastfileId = $(obj).parents('tr').find('#' + fId + 'files').children().last().children('input').prop('id')
  let id = lastfileId.split('_')[0];
  let index = Number(lastfileId.split('_')[1]) + 1;
  if (index > 3) {
    alert('최대 추가는 3개 까지 입니다.');
    return;
  }
  let html = '';
  html += `<div class="items m-b-10">`;
  html += `<div id="${fId}date_${index}" class="font_gray"></div>`;
  html += `<input id="${id}_${index}" type="file" class="file-width" onchange="fnFileDateAdd(this);"/>`;
  html += `</div>`;

  $(obj).parents('tr').find('#' + fId + 'files').append(html);

  let btnHtml = '';
  btnHtml += `<div class="items m-b-10">`;
  btnHtml += `<button class="btn_remove" onclick="fnFIleRemove(this, '${id}' , '${index}');"><span>-</span></button>`;
  btnHtml += `</div>`;

  $(obj).parents('tr').find('#btns').append(btnHtml);
}

/**********************************************************************************************************************
 함 수 명 : fnFileAdd
 설    명 : td에 추가한 파일 삭제 함수
 인    자 : 요소(this), 구분 ID, 순서
 사 용 법 : onclick="fnFIleRemove(this, 'TEST' , '2')"
 작 성 일 : 2023-05-15
 작 성 자 : (애코브레인) 강민수
 수정일      수정자  수정내용
 **********************************************************************************************************************/
const fnFIleRemove = (obj, id, index) => {
  $('#' + id + '_' + index).parent().remove(); //
  $(obj).parent().remove();//div items 제거
}
/**********************************************************************************************************************
 함 수 명 : fnFileDateAdd
 설    명 : 파일 선택시 선택 날짜를 출력해주는 함수
 인    자 : 요소(this), 구분 ID, 순서
 사 용 법 : input file 이전요소의 text 에 날짜 표출
 <div id="TESTdate_2" class="font_gray"></div>`;
 <input id="TEST_2" type="file" class="file-width" onchange="fnFileDateAdd(this);"/>
 작 성 일 : 2023-05-15
 작 성 자 : (애코브레인) 강민수
 수정일      수정자  수정내용
 **********************************************************************************************************************/
const fnFileDateAdd = (obj) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;

  $(obj).prev().text(formattedDate);
}

/**********************************************************************************************************************
 함 수 명 : fnGetUtf8ByteSize
 설    명 : utf-8 한글이 섞인 문자열 byte 수 계산
 인    자 : str: String
 사 용 법 : 해당 문자열을 넣으면 byte 수를 return
 작 성 일 : 2023-05-18
 작 성 자 : (애코브레인) 김윤성
 수정일      수정자  수정내용
 **********************************************************************************************************************/
const fnGetUtf8ByteSize = (str) => new TextEncoder().encode(str).byteLength;

/**********************************************************************************************************************
 함 수 명 : fnUrlBuilder
 설    명 : 오브젝트 key:value 를 url get 형식 파라미터로 변환
 인    자 : hostURL , Object
 사 용 법 : fnUrlBuilder('http://localhost',{seq:1, name: '강민수'})  => localhost?seq=1&name=강민수
 작 성 일 : 2023-05-15
 작 성 자 : (애코브레인) 강민수
 수정일      수정자  수정내용
 **********************************************************************************************************************/
const fnUrlBuilder = (host, query) => {
  const param = Object.entries(query).map(([key, value]) => value ? `${key}=${encodeURIComponent(value)}` : '').join('&');
  return `${host}?${param}`;
}

/**********************************************************************************************************************
 함 수 명 : fnCalculateArea
 설    명 : feature의 면적을 m2 계산 후 반환
 인    자 : feature
 사 용 법 : fnCalculateArea(ol.feature)
 작 성 일 : 2023-05-15
 작 성 자 : (애코브레인) 강민수
 수정일      수정자  수정내용
 **********************************************************************************************************************/
const fnCalculateArea = (feature) => {
  let geometry = feature.getGeometry();

  // 면적 계산
  let area = 0;
  if (geometry instanceof ol.geom.Polygon) {
    area = geometry.getArea(); // 제곱 미터로 반환
  } else if (geometry instanceof ol.geom.MultiPolygon) {
    area = 0;
    geometry.getPolygons().forEach(function (polygon) {
      area += polygon.getArea(); // 제곱 미터로 반환 후 합산
    });
  }

  // 면적 반환
  return area.toFixed(2);
}

/**********************************************************************************************************************
 함 수 명 : fnFormToObject
 설    명 : form의 input들을 {} 형식으로 만들어주는 함수
 인    자 : selector(string 선택자)
 사 용 법 : 비동기 통신을 할 때 사용
 작 성 일 : 2023-05-22
 작 성 자 : (애코브레인) 김윤성
 수정일      수정자  수정내용
 **********************************************************************************************************************/
/*const fnFormToObject = (selector) => Array.from(new FormData($(selector)[0]).entries())
  .reduce((prev, [key, val]) => (
    !val
      ? prev
      : !prev[key]
        ? {...prev, [key]: val}
        : {...prev, [key]: (prev[key] + ',' + val)}
  ), {});

const isNotNull = (obj) => {
  if (obj === null || obj === undefined || obj === '') return false;
  return true;
}*/

//mjero
const isNotNull = (obj) => {
  if (obj === null || obj === undefined || obj === '') return false;
  return true;
}

/**********************************************************************************************************************
 함 수 명 : fnBuildChart
 설    명 : Render Pie chart
 인    자 : selector(string 선택자), data(Object 데이터), title(string= 제목), unit(string= 단위), nameFm(function= 툴팁포메터)
 사 용 법 : data: [{name :string, value :number}]
 작 성 일 : 2023-06-12
 작 성 자 : (애코브레인) 김윤성
 수정일      수정자  수정내용
 2023.06.14 김윤성  포메터 추가
 **********************************************************************************************************************/
const fnBuildChart = (selector, data, title = '', unit = '', nameFm = str => str) => {
  if (!echarts) {
    console.error('Import echart!');
    return;
  }

  const _div = $(selector);
  _div.css('display', 'flex');
  _div.css('justify-content', 'space-evenly');

  const id = Date.now().toString();
  _div.append(`<div id="${id}" style="width: 350px; height: 350px"></div>`);

  echarts
    .init(document.getElementById(id))
    .setOption({
      title: {
        text: `<${title}>`,
        left: 'center',
        bottom: '0'
      },
      tooltip: {
        trigger: 'item',
        formatter: ({marker, percent, value, name}) => (
          `${marker}${nameFm(name)} : &emsp;${echarts.format.addCommas(value)}<small>${unit}</small> &nbsp; (${percent}<small>%</small>)`
        )
      },
      series: [
        {
          type: 'pie',
          radius: '70%',
          label: {
            formatter: ({percent}) => (percent + '%'),
            position: 'inside'
          },
          data,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        },
      ]
    });
}

/**********************************************************************************************************************
 함 수 명 : fnCodeArrayToObject
 설    명 : jsonArray 형태의 코트 테이블 배열을 object 형태로 변경한다.
 인    자 : jsonArray(json 배열)
 사 용 법 : 서버에서 DB조회를 통해 코드값을 jsonArray 형태로 받아오면
 fnCodeArrayToObject 함수를 호출하여 object로 변경한다.
 코드값이 object의 property명이 된다.
 작 성 일 : 2023-06-21
 작 성 자 : (애코브레인) 김현승
 수정일      수정자  수정내용
 **********************************************************************************************************************/
const fnCodeArrayToObject = (jsonArray) => {
  let object = new Object();

  for (let i = 0; i < jsonArray.length; i++) {
    const temp = jsonArray[i];
    object[temp.cdId] = temp;
  }

  return object;
}

/**********************************************************************************************************************
 함 수 명 : fnGeojsonToWkt
 설    명 : geoJson을 WKT 포멧으로 변경 함수
 사 용 법 : fnGeojsonToWkt(GEOJSON, 변경할 좌표계, 변결될 좌표계)
 작 성 일 : 2023-06-23
 작 성 자 : (애코브레인) 강민수
 수정일      수정자  수정내용
 **********************************************************************************************************************/
function fnConvertCoordinates(coordinates, crs, toCrs) {
  // 좌표 변환 (3857 -> 4326)
  return ol.proj.transform(coordinates, crs, toCrs);
}

function fnGeojsonToWkt(geojson, crs, toCrs) {
  var type = geojson.type;
  var coordinates = geojson.coordinates;

  switch (type) {
    case 'Point':
      coordinates = fnConvertCoordinates(coordinates, crs, toCrs);
      return 'POINT(' + coordinates[0] + ' ' + coordinates[1] + ')';
    case 'LineString':
      coordinates = coordinates.map(coord => fnConvertCoordinates(coord, crs, toCrs));
      return 'LINESTRING(' + coordinates.map(coord => coord[0] + ' ' + coord[1]).join(', ') + ')';
    case 'Polygon':
      coordinates = coordinates.map(ring => ring.map(coord => fnConvertCoordinates(coord, crs, toCrs)));
      return 'POLYGON(' + coordinates.map(ring => '(' + ring.map(coord => coord[0] + ' ' + coord[1]).join(', ') + ')').join(', ') + ')';
    case 'MultiPoint':
      coordinates = coordinates.map(coord => fnConvertCoordinates(coord, crs, toCrs));
      return 'MULTIPOINT(' + coordinates.map(coord => '(' + coord[0] + ' ' + coord[1] + ')').join(', ') + ')';
    case 'MultiLineString':
      coordinates = coordinates.map(line => line.map(coord => fnConvertCoordinates(coord, crs, toCrs)));
      return 'MULTILINESTRING(' + coordinates.map(line => '(' + line.map(coord => coord[0] + ' ' + coord[1]).join(', ') + ')').join(', ') + ')';
    case 'MultiPolygon':
      coordinates = coordinates.map(polygon => polygon.map(ring => ring.map(coord => fnConvertCoordinates(coord, crs, toCrs))));
      return 'MULTIPOLYGON(' + coordinates.map(polygon => '(' + polygon.map(ring => '(' + ring.map(coord => coord[0] + ' ' + coord[1]).join(', ') + ')').join(', ') + ')').join(', ') + ')';
    default:
      throw new Error('Unsupported GeoJSON type: ' + type);
  }
}

/**********************************************************************************************************************
 함 수 명 : fnSavePdf
 설    명 : HTML를 이미지로 변환후 PDF 저장
 사 용 법 : fnSavePdf(저장될 파일명, 저장할 html 요소 id)
 작 성 일 : 2023-06-23
 작 성 자 : (애코브레인) 강민수
 수정일      수정자  수정내용
 **********************************************************************************************************************/
const fnSavePdf = (title, targetId) => {
  html2canvas($('#' + targetId)[0]).then(function (canvas) {
    var imgData = canvas.toDataURL('image/png');
    var imgWidth = 210; // A4 용지 가로 길이 (mm)
    var pageHeight = imgWidth * 1.414; // A4 용지 세로 길이 (mm)
    var imgHeight = canvas.height * imgWidth / canvas.width;
    var pageCount = Math.ceil(imgHeight / pageHeight);
    var doc = new jsPDF('p', 'mm', 'a4');


    for (var i = 0; i < pageCount; i++) {
      var position = -i * pageHeight
      console.log(position)

      doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);

      if (i < pageCount - 1) {
        doc.addPage();
      }

    }


    doc.save(title + '.pdf');
  });
};

/**********************************************************************************************************************
 함 수 명 : fnFormatDt
 설    명 : '12.12 식으로 만들어주는 함수
 사 용 법 : fnFormatDt(string)
 작 성 일 : 2023-06-29
 작 성 자 : (애코브레인) 김윤성
 수정일      수정자  수정내용
 **********************************************************************************************************************/
const fnFormatDt = str => {
  const dt = str === 'today' ? new Date() : new Date(str);
  if (str !== 'today' && (!str || isNaN(dt.getTime()))) return '-';

  return '\'' + (dt.getFullYear().toString().substring(2, 4) + '.' + (dt.getMonth() + 1).toString().padStart(2, '0'));
}

