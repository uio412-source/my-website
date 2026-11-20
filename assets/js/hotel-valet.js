import {valetStatus, valetDate, valetQuota} from './valet-rules.js';

const byId = id => document.getElementById(id);
const controls = Object.fromEntries(
  ['query', 'issuer', 'card', 'district', 'my-only', 'reset', 'clear-district', 'map', 'results', 'count', 'cards', 'data-note']
    .map(key => [key, byId('valet-' + key)])
);
const saveKey = 'mrhotels.valet.cards';
const scoreLabel = {
  available: '조건 충족 시 무료',
  unlisted: '공식 안내 미등재',
  closed: '휴업으로 이용 불가',
  expired: '최신 조건 확인 중',
};
const collator = new Intl.Collator('ko');
const normalized = value => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const cardText = card => [card.name, card.program.issuer, card.program.brand, card.program.tier].join(' ');
const cardLabel = card => `${card.name} · ${card.program.brand}`;
const mrCards = '../paymorevent/';
const mrCardPath = id => `${mrCards}cards/${encodeURIComponent(id)}/`;
const day = valetDate();

function node(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) element.setAttribute(name, value);
  element.append(...children);
  return element;
}

function svg(tag, attrs) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
  return element;
}

function readSaved() {
  try {
    const values = JSON.parse(localStorage.getItem(saveKey) ?? '[]');
    return new Set(Array.isArray(values) ? values : []);
  } catch {
    return new Set();
  }
}

let saved = readSaved();
let data;
let geometry;
let cards = [];
let selectedHotel = new URLSearchParams(location.search).get('hotel');
const params = new URLSearchParams(location.search);

function setOptions(select, label, options) {
  select.replaceChildren(new Option(label, ''), ...options.map(([value, name]) => new Option(name, value)));
}

function setCardOptions(selected) {
  const relevant = controls.issuer.value ? cards.filter(card => card.program.issuer === controls.issuer.value) : cards;
  setOptions(controls.card, '전체 카드', relevant.map(card => [card.id, cardLabel(card)]));
  controls.card.value = relevant.some(card => card.id === selected) ? selected : '';
}

function hotelRows() {
  const query = controls.query.value;
  const terms = query.split(/\s+/).map(normalized).filter(Boolean);
  const matches = value => terms.every(term => normalized(value).includes(term));
  const selected = controls.card.value;
  const issuer = controls.issuer.value;
  const relevant = cards.filter(card =>
    (!selected || card.id === selected) && (!issuer || card.program.issuer === issuer) &&
    (!controls['my-only'].checked || saved.has(card.id)));
  const includeUnlisted = Boolean(selected || terms.length) && relevant.length > 0;
  return data.hotels.map(hotel => {
    const hotelText = [hotel.name, hotel.district, ...(hotel.aliases ?? [])].join(' ');
    const rows = relevant.flatMap(card => {
      if (terms.length && !matches(`${hotelText} ${cardText(card)}`)) return [];
      const status = valetStatus(card.program, hotel, day);
      if (status === 'unlisted' && !(includeUnlisted && relevant.length === 1)) return [];
      return [{card, status}];
    });
    return {hotel, rows, available: rows.filter(row => row.status === 'available').length};
  }).filter(result => result.rows.length);
}

function updateSaveButton(button, card) {
  const isSaved = saved.has(card.id);
  button.setAttribute('aria-pressed', String(isSaved));
  button.setAttribute('aria-label', cardLabel(card) + (isSaved ? ' 저장 해제' : ' 저장'));
  button.textContent = isSaved ? '저장됨' : '내 카드에 저장';
}

function saveButton(card) {
  const button = node('button', {type: 'button', class: 'hv-button', 'data-save-card': card.id});
  updateSaveButton(button, card);
  button.addEventListener('click', () => {
    saved.has(card.id) ? saved.delete(card.id) : saved.add(card.id);
    try { localStorage.setItem(saveKey, JSON.stringify([...saved])); } catch { /* 현재 화면에서 유지 */ }
    for (const other of document.querySelectorAll('[data-save-card]')) {
      if (other.dataset.saveCard === card.id) updateSaveButton(other, card);
    }
    updateSummary();
    if (controls['my-only'].checked) render();
  });
  return button;
}

function cardRow({card, status}, hotel) {
  const program = card.program;
  const detail = node('div', {class: 'hv-card-row'},
    node('div', {class: 'hv-card-title'},
      node('div', {}, node('strong', {}, card.name), node('small', {}, `${program.brand} ${program.tier}`)),
      node('span', {class: 'hv-status', 'data-state': status}, scoreLabel[status])));
  if (status === 'available' || status === 'expired') {
    const terms = [
      ['전월실적', `${(program.minimumSpend / 10000).toLocaleString('ko-KR')}만원 이상`],
      ['발레파킹 한도', valetQuota(program, hotel)],
      ['주차', program.parking],
    ];
    detail.append(node('dl', {class: 'hv-terms'}, ...terms.map(([label, value]) =>
      node('div', {}, node('dt', {}, label), node('dd', {}, value)))));
    const conditions = node('details', {class: 'hv-conditions'},
      node('summary', {}, '이용 조건'),
      node('ul', {}, ...[
        program.visit, program.proof, `실적 기준 ${program.spendScope}`,
        `실적 제외 ${program.spendExclusions}`, program.grace,
        ...(program.familyQuota ? ['본인·가족카드 이용 횟수 합산'] : []),
        ...(program.validThrough ? [`안내장 적용 기간 ${program.validThrough}까지`] : []),
        ...(program.hotelOverrides?.[hotel.id]?.note ? [program.hotelOverrides[hotel.id].note] : []),
        ...program.notes,
      ].map(condition => node('li', {}, condition))));
    detail.append(conditions);
  }
  const links = node('div', {class: 'hv-links'},
    node('a', {href: program.source}, '공식 안내장'),
    ...(card.catalogId ? [node('a', {href: mrCardPath(card.catalogId)}, '카드 상세')] : []),
    saveButton(card));
  detail.append(links);
  return detail;
}

function renderHotel({hotel, rows, available}) {
  const article = node('details', {class: 'hv-hotel'});
  if (selectedHotel === hotel.id) article.open = true;
  const status = available
    ? `${available}개 카드·브랜드`
    : scoreLabel[rows.some(row => row.status === 'closed') ? 'closed' :
      rows.some(row => row.status === 'expired') ? 'expired' : 'unlisted'];
  article.append(node('summary', {},
    node('span', {}, node('small', {}, hotel.district), node('strong', {}, hotel.name)),
    node('span', {class: 'hv-status', 'data-state': available ? 'available' : 'none'}, status)));
  let rendered = false;
  const drawDetail = () => {
    if (!article.open || rendered) return;
    rendered = true;
    if (hotel.closure && hotel.closure.from <= day) {
      article.append(node('div', {class: 'hv-closure'}, hotel.closure.note, ' ',
        node('a', {href: hotel.closure.source}, '호텔 공지')));
    }
    if (hotel.note) article.append(node('p', {class: 'hv-note'}, hotel.note));
    article.append(node('div', {class: 'hv-hotel-links'},
      node('a', {href: 'https://map.naver.com/p/search/' + encodeURIComponent('서울 ' + hotel.name)}, '네이버 지도'),
      ...(available ? [node('a', {href: `${mrCards}?valet=${hotel.id}#cards`}, 'Mr. Cards 카드 목록')] : [])),
    ...rows.map(row => cardRow(row, hotel)));
  };
  drawDetail();
  article.addEventListener('toggle', () => {
    if (article.open) {
      selectedHotel = hotel.id;
      drawDetail();
    } else if (selectedHotel === hotel.id) selectedHotel = null;
  });
  return article;
}

function renderMap(results) {
  const available = new Map();
  for (const result of results) {
    if (result.available) available.set(result.hotel.district, (available.get(result.hotel.district) ?? 0) + 1);
  }
  controls.map.setAttribute('viewBox', geometry.viewBox);
  controls.map.replaceChildren(...geometry.districts.map(district => {
    const count = available.get(district.name) ?? 0;
    const selected = controls.district.value === district.name;
    const group = svg('g', {
      class: 'hv-district', 'data-count': count, 'data-selected': selected,
      ...(count || selected ? {role: 'button', tabindex: 0, 'aria-label': `${district.name} 호텔 ${count}곳`, 'aria-pressed': String(selected)} : {}),
    });
    const outline = svg('path', {d: district.d, 'fill-rule': 'evenodd'});
    group.append(outline);
    if (count) {
      const [x, y] = district.point;
      const dot = svg('circle', {cx: x, cy: y, r: 9});
      const label = svg('text', {x, y, 'aria-hidden': 'true'});
      label.textContent = count;
      const tooltip = svg('title', {});
      tooltip.textContent = `${district.name} · 호텔 ${count}곳`;
      group.append(dot, label, tooltip);
    }
    const pick = restoreFocus => {
      if (!count && !selected) return;
      controls.district.value = selected ? '' : district.name;
      render(restoreFocus ? district.name : '');
    };
    group.addEventListener('click', () => pick(false));
    group.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        pick(true);
      }
    });
    if (group.getAttribute('tabindex') === '0') group.setAttribute('data-district', district.name);
    return group;
  }));
}

function updateSummary() {
  byId('valet-cards').closest('details').querySelector('summary').textContent =
    `카드 전체 목록 ${cards.length}종 · 내 카드 ${saved.size}종`;
}

function render(focusedDistrict) {
  if (!data || !geometry) return;
  const results = hotelRows();
  const district = controls.district.value;
  const openResults = results.filter(row => !district || row.hotel.district === district);
  openResults.sort((a, b) => Number(Boolean(b.available)) - Number(Boolean(a.available)) ||
    collator.compare(a.hotel.name, b.hotel.name));
  const available = openResults.filter(row => row.available).length;
  controls.count.textContent = `${district || '서울'} · 무료 발레 ${available}곳`;
  controls['clear-district'].hidden = !district;
  controls.results.replaceChildren(...(openResults.length ? openResults.map(renderHotel) : [
    node('p', {class: 'hv-empty'},
      controls['my-only'].checked && !saved.size ? '카드 전체 목록에서 내 카드를 먼저 저장해 주세요.' :
        '조건에 맞는 호텔이 없습니다. 검색어나 지역을 바꿔 보세요.'),
  ]));
  renderMap(results);
  if (focusedDistrict) {
    const marker = [...controls.map.querySelectorAll('[data-district]')].find(element => element.dataset.district === focusedDistrict);
    (marker ?? controls.district).focus();
  }
}

function renderCards() {
  const list = cards.map(card => {
    const program = card.program;
    const count = data.hotels.filter(hotel => valetStatus(program, hotel, day) === 'available').length;
    const select = node('button', {type: 'button', class: 'hv-button'}, '호텔 보기');
    select.addEventListener('click', () => {
      controls.query.value = '';
      controls.issuer.value = program.issuer;
      setCardOptions(card.id);
      controls.district.value = '';
      controls['my-only'].checked = false;
      render();
      controls.card.focus();
      controls.card.scrollIntoView({block: 'center'});
    });
    return node('li', {}, node('div', {}, node('strong', {}, cardLabel(card)),
      node('small', {}, `서울 ${count}곳 · ${valetQuota(program)}`)), select, saveButton(card));
  });
  const pending = data.pending.map(card => node('li', {},
    node('div', {}, node('strong', {}, `${card.name} · ${card.brand}`), node('small', {}, card.note)),
    node('a', {href: card.source}, '공식 안내')));
  controls.cards.replaceChildren(
    node('ul', {class: 'hv-all-cards'}, ...list),
    ...(pending.length ? [node('h3', {}, '호텔 명단 확인 중'), node('ul', {class: 'hv-all-cards'}, ...pending)] : []));
}

async function load() {
  const preserveFilters = Boolean(data);
  const previous = {district: controls.district.value, issuer: controls.issuer.value, card: controls.card.value};
  [data, geometry] = await Promise.all([MS.getJSON('valet.json'), MS.getJSON('valet-districts.json')]);
  cards = data.programs.flatMap(program =>
    program.cards.map(card => ({...card, program, id: `${program.id}:${card.key}`}))
  ).sort((a, b) => collator.compare(cardLabel(a), cardLabel(b)));
  saved = new Set([...saved].filter(id => cards.some(card => card.id === id)));
  const districts = geometry.districts.map(district => district.name).sort(collator.compare);
  const issuers = [...new Set(cards.map(card => card.program.issuer))].sort(collator.compare);
  setOptions(controls.district, '서울 전체', districts.map(district => [district, district]));
  setOptions(controls.issuer, '전체 카드사', issuers.map(issuer => [issuer, issuer]));
  const requestedCard = params.get('card');
  if (preserveFilters) {
    controls.issuer.value = issuers.includes(previous.issuer) ? previous.issuer : '';
    controls.district.value = districts.includes(previous.district) ? previous.district : '';
    setCardOptions(previous.card);
  } else {
    const preselected = requestedCard && cards.find(card => card.id === requestedCard || card.catalogId === requestedCard);
    setCardOptions(preselected?.id ?? '');
    if (params.get('q')) controls.query.value = params.get('q');
  }
  byId('valet-map-source').href = geometry.source;
  controls['data-note'].textContent =
    `공식 안내 확인 ${data.updatedAt} · ‘공식 안내 미등재’는 해당 카드·브랜드의 확인한 자료 기준입니다. 만차나 행사 시 현장 이용이 제한될 수 있습니다.`;
  render();
  renderCards();
  updateSummary();
}

byId('valet-filters').addEventListener('submit', event => event.preventDefault());
controls.query.addEventListener('input', () => render());
for (const key of ['card', 'district', 'my-only']) controls[key].addEventListener('change', () => render());
controls.issuer.addEventListener('change', () => {
  setCardOptions(controls.card.value);
  render();
});
controls.reset.addEventListener('click', () => {
  for (const key of ['query', 'issuer', 'district']) controls[key].value = '';
  controls['my-only'].checked = false;
  setCardOptions('');
  selectedHotel = null;
  render();
});
controls['clear-district'].addEventListener('click', () => {
  controls.district.value = '';
  render();
});
const onError = () => {
  controls.count.textContent = '목록을 불러오지 못했습니다.';
  const retry = node('button', {type: 'button', class: 'hv-button'}, '다시 불러오기');
  retry.addEventListener('click', () => load().catch(onError));
  controls.results.replaceChildren(retry);
};
window.addEventListener('datarefresh', event => event.detail.tasks.push(load()));
load().catch(onError);
