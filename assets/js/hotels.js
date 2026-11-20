(() => {
  const accorLounge = 'https://all.accor.com/loyalty-program/user/hotels-lounge/index.en.shtml';
  const marriottLounge = 'https://www.marriott.com/ko/offers/packages/lounge.mi';
  const hiltonSlh = 'https://www.hilton.com/en/brands/small-luxury-hotels-slh/slh-terms-and-conditions/';
  const programInfo = {
    accor: {
      tiers: ['클래식', '실버', '골드', '플래티넘', '다이아몬드'],
      defaultTier: 3,
      terms: 'https://all.accor.com/a/en/loyalty-program/legal/terms-and-conditions-limitless.html',
      condition: '적격 예약 기준입니다. 업그레이드와 얼리 체크인·레이트 체크아웃은 객실 상황에 따릅니다. 플래티넘 이상 아시아·태평양 조식은 참여 호텔과 요금 조건을 확인하세요.',
      sources: [
        ['Accor 서울 호텔·성급', 'https://all.accor.com/a/ko/destination/city/hotels-seoul-v5556.html'],
        ['라운지·조식 참여 호텔', accorLounge],
        ['ALL Accor 제외 호텔', 'https://all.accor.com/a/en/loyalty-program/hotels-exception.html'],
      ],
    },
    ihg: {
      tiers: ['클럽', '실버', '골드', '플래티넘', '다이아몬드'],
      defaultTier: 4,
      terms: 'https://www.ihg.com/content/kr/ko/customer-care/member-tc/2nd-page',
      condition: '레이트 체크아웃은 요청 시 최대 오후 2시이며 호텔 상황에 따릅니다. 플래티넘·다이아몬드의 얼리 체크인과 업그레이드도 가용 시 적용됩니다. 연간 라운지 멤버십은 별도 마일스톤 리워드입니다.',
      sources: [
        ['IHG 서울 호텔', 'https://www.ihg.com/seoul-korea-republic-of'],
        ['IHG 엘리트 혜택 안내', 'https://www.ihg.com/content/us/en/customer-care/main/account/elite-upgrade-benefits'],
      ],
    },
    hotelux: {
      tiers: [], defaultTier: 0,
      terms: 'https://hotelux.com/sub/CITI.html',
      condition: '목록은 공개된 HoteLux 요금 자료에서 확인한 서울 호텔입니다. 조식과 크레딧은 혜택이 포함된 요금에 적용되며 금액·대상 업장·취소 조건은 예약 화면에서 확인하세요.',
      sources: [
        ['HoteLux 공식 예약', 'https://hotel.hotelux.com/'],
        ['서울 호텔 요금 목록 및 소피텔 혜택 예시', 'https://www.togot.travel/knowledge/booking-channels/hotelux/calendar?month=2026-11'],
      ],
    },
    marriott: {
      tiers: ['멤버', '실버', '골드', '플래티넘', '티타늄', '앰배서더'],
      defaultTier: 3,
      terms: 'https://www.marriott.com/loyalty/terms/default.mi',
      condition: '조식 선택은 해당 브랜드의 웰컴 기프트 기준입니다. 라운지는 참여 호텔에서 동일 객실의 회원과 동반 1인 기준입니다. 객실 업그레이드는 가용 시 적용되며 레이트 체크아웃은 약관의 브랜드·호텔 예외를 따릅니다.',
      sources: [
        ['Marriott 한국 공식 호텔 목록', 'https://www.marriott.com/en-us/hotel-sitemap/south-korea-hotel-sitemap'],
        ['브랜드별 웰컴 기프트 및 라운지 보장', 'https://www.marriott.com/loyalty/member-benefits/guarantee.mi'],
        ['국내 라운지 운영 호텔', marriottLounge],
      ],
    },
    hilton: {
      tiers: ['멤버', '실버', '골드', '다이아몬드', '다이아몬드 리저브'],
      defaultTier: 3,
      terms: 'https://www.hilton.com/en/hilton-honors/member-benefits/',
      condition: '적격 예약 기준입니다. SLH 제휴 호텔은 Hilton 직접 예약 시 SLH 전용 약관을 적용합니다. 조식 형태와 업그레이드는 브랜드 및 호텔 조건을 따릅니다.',
      sources: [
        ['Hilton 서울 호텔', 'https://www.hilton.com/ko/locations/south-korea/seoul/'],
        ['Hilton Honors 약관·MyWay 혜택', 'https://www.hilton.com/en/hilton-honors/terms/'],
        ['SLH 제휴 약관', hiltonSlh],
      ],
    },
  };
  const benefit = {
    accor(tier, profile) {
      if (profile === 'excluded') return 'ALL Accor 멤버십 미참여';
      if (tier === 0) return '회원 요금 · 포인트 적립';
      if (tier === 1) return '레이트 체크아웃(가능 시)';
      if (tier === 2) return '객실 업그레이드 · 얼리 또는 레이트(가능 시)';
      const lounge = profile === 'club' ? ' · 라운지' :
        profile === 'fairmont' ? (tier >= 4 ? ' · 페어몬트 골드 라운지' : ' · 골드 라운지는 다이아몬드부터') : '';
      return '조식(참여 시)' + lounge + ' · 업그레이드 · 얼리·레이트(가능 시)';
    },
    ihg(tier, profile) {
      const perks = [];
      if (profile === 'breakfastIncluded') perks.push('기본 조식 포함');
      else if (tier === 4) perks.push('웰컴 혜택으로 2인 조식 선택');
      if (profile === 'loungeMilestone') perks.push('별도 연간 라운지 멤버십 사용 가능');
      if (tier >= 3) perks.push('업그레이드·얼리(가능 시)');
      perks.push('레이트(가능 시)');
      return perks.join(' · ');
    },
    hotelux(tier, profile) {
      return profile === 'sofitelExample' ? '요금 예시: 매일 조식 · US$100 호텔 크레딧 · 업그레이드(가능 시)' :
        '요금별 조식·크레딧 및 업그레이드·얼리·레이트 조건 확인';
    },
    marriott(tier, profile) {
      if (profile === 'apartments') return '이그제큐티브 아파트먼트 별도 적립·혜택 조건';
      if (tier === 0) return '회원 요금 · 포인트 적립';
      if (tier === 1) return '우선 레이트 체크아웃(가능 시)';
      if (tier === 2) return '객실 업그레이드 · 오후 2시 체크아웃(가능 시)';
      const perks = {
        breakfastChoice: '웰컴 혜택으로 2인 조식 선택',
        foodCredit: '웰컴 혜택으로 식음 크레딧 선택',
        courtyard: '웰컴 혜택으로 식음 크레딧 선택',
        courtyardClub: '라운지 조식 · 미운영 시 레스토랑 조식',
        club: '라운지',
        clubChoice: '라운지 · 웰컴 혜택으로 조식 선택',
        series: '웰컴 혜택으로 조식 선택(레스토랑 운영 조건)',
        welcome: '웰컴 혜택(포인트 또는 지정 어메니티)',
      };
      return perks[profile] + ' · 업그레이드(가능 시) · 오후 4시 체크아웃';
    },
    hilton(tier, profile) {
      if (profile === 'slh') return tier >= 2 ? 'SLH 2인 컨티넨털 조식 · 업그레이드·레이트(가능 시)' : 'SLH 레이트 체크아웃(가능 시)';
      if (tier <= 1) return tier === 1 ? '포인트 20% 추가 적립' : '회원 요금 · 포인트 적립';
      const reserve = tier === 4 ? ' · 오후 4시 체크아웃(참여 호텔)' : '';
      if (profile === 'garden') return 'MyWay 조식 선택' + reserve;
      return '조식 · 업그레이드(가능 시)' +
        (tier >= 3 ? ' · 이그제큐티브 라운지' : ' · 업그레이드로 라운지 대상 객실 배정 시 입장') + reserve;
    },
  };
  const $ = (id) => document.getElementById('hotel-' + id);
  const country = $('country'), city = $('city'), district = $('district'), tier = $('tier'), query = $('query');
  const nav = $('programs');
  let data, program;
  const chainFromHash = () => {
    const id = location.hash.slice(1).toLowerCase();
    return Object.hasOwn(programInfo, id) ? id : 'accor';
  };

  function setOptions(select, values) {
    select.replaceChildren(...values.map((value) => new Option(value)));
  }

  function activeCity() {
    return data.countries[country.selectedIndex].cities[city.selectedIndex];
  }

  function putSources(info) {
    const notes = [
      ...info.sources,
      ['호텔업 등급결정 현황', 'https://www.hotelrating.or.kr/hotel'],
      ['서울시 호텔 위치·성급', 'https://english.seoul.go.kr/service/living/accommodations/'],
    ];
    $('sources').replaceChildren(...notes.map(([title, url]) => {
      const item = document.createElement('li');
      const a = document.createElement('a');
      a.href = url;
      a.textContent = title;
      item.append(a);
      return item;
    }));
    $('checked').textContent = '목록 대조일 ' + data.updated.replaceAll('-', '.') + ' · 성급은 호텔·공개 등급 자료 기준입니다.';
  }

  function selectProgram() {
    program = chainFromHash();
    const info = programInfo[program];
    const selectedCity = activeCity();
    const hotels = selectedCity.programs[program] || [];
    for (const tab of nav.querySelectorAll('a')) {
      if (tab.hash === '#' + program) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
    setOptions(tier, info.tiers);
    tier.selectedIndex = info.tiers.length ? info.defaultTier : -1;
    $('tier-field').hidden = !info.tiers.length;
    setOptions(district, ['전체', ...new Set(hotels.map((hotel) => hotel.district).sort((a, b) => a.localeCompare(b, 'ko')))]);
    $('terms').href = info.terms;
    $('conditions').textContent = info.condition;
    putSources(info);
    render();
  }

  function selectCountry() {
    setOptions(city, data.countries[country.selectedIndex].cities.map((entry) => entry.name));
    selectProgram();
  }

  const normalize = (value) => value.toLocaleLowerCase('ko').replace(/[^\p{L}\p{N}]/gu, '');
  function render() {
    const selectedCity = activeCity();
    const words = query.value.trim().split(/\s+/).map(normalize);
    const hotels = (selectedCity.programs[program] || []).filter((hotel) => {
      const name = normalize(hotel.name + hotel.district);
      return (!district.selectedIndex || hotel.district === district.value) && words.every((word) => name.includes(word));
    }).sort((a, b) => a.district.localeCompare(b.district, 'ko') || a.name.localeCompare(b.name, 'ko'));
    $('count').textContent = selectedCity.name + ' 호텔 ' + hotels.length + '곳';
    $('benefit-heading').textContent = program === 'hotelux' ? '예약 혜택' : tier.value + ' 혜택';
    const list = document.createDocumentFragment();
    for (const hotel of hotels) {
      const row = document.createElement('tr');
      row.insertCell().textContent = hotel.district;
      const a = document.createElement('a');
      a.href = hotel.url;
      a.textContent = hotel.name;
      row.insertCell().append(a);
      const star = row.insertCell();
      star.textContent = hotel.stars ? hotel.stars + '성' : '—';
      if (!hotel.stars) star.setAttribute('aria-label', '성급 미확인');
      row.insertCell().textContent = benefit[program](tier.selectedIndex, hotel.profile);
      list.append(row);
    }
    $('list').replaceChildren(list);
    $('empty').hidden = hotels.length > 0;
  }

  async function init() {
    const response = await fetch('directory.json', {cache: 'no-cache'});
    if (!response.ok) throw new Error('호텔 목록 응답 오류');
    data = await response.json();
    setOptions(country, data.countries.map((entry) => entry.name));
    selectCountry();
    $('directory').hidden = false;
    $('status').hidden = true;
    country.addEventListener('change', selectCountry);
    city.addEventListener('change', selectProgram);
    district.addEventListener('change', render);
    tier.addEventListener('change', render);
    query.addEventListener('input', render);
    window.addEventListener('hashchange', selectProgram);
  }

  init().catch(() => {
    $('status').textContent = '호텔 목록을 불러오지 못했습니다. 새로고침해 주세요.';
  });
})();
