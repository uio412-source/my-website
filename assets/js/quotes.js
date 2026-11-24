// Mr. Stocks 맨 위 '공포에 사라' 명언 배너 — 7초마다 다음 명언으로 넘어감
// 마우스를 올리거나 포커스가 있으면 멈추고, 누르면 다음 명언. 출처가 확인 안 된 말은 그렇다고 표시.
(function () {
  var QUOTES = [
    { q: '남들이 탐욕스러울 때 두려워하고, 남들이 두려워할 때 탐욕스러워져라.', by: '워런 버핏', src: '1986 버크셔 주주서한' },
    { q: '나쁜 소식은 투자자의 가장 좋은 친구다. 미래의 한 조각을 할인된 가격에 살 수 있게 해 주니까.', by: '워런 버핏', src: '2008 뉴욕타임스 기고' },
    { q: '큰 기회는 드물게 온다. 하늘에서 금이 쏟아질 때는 골무 말고 양동이를 내밀어라.', by: '워런 버핏', src: '2009 버크셔 주주서한' },
    { q: '가격은 당신이 내는 것이고, 가치는 당신이 얻는 것이다.', by: '워런 버핏', src: '2008 버크셔 주주서한' },
    { q: '100년에 두세 번 오는 50% 하락을 담담히 견디지 못한다면, 주식을 가질 자격이 없다.', by: '찰리 멍거', src: '2009 BBC 인터뷰' },
    { q: '우량주를 200주 이동평균선에서만 사도, 시간이 지나면 S&P 500을 크게 이긴다.', by: '찰리 멍거의 말로 알려짐', src: '출처 확인 안 됨' },
    { q: '강세장은 비관 속에서 태어나 회의 속에서 자라고, 낙관 속에서 무르익어 행복감 속에서 죽는다.', by: '존 템플턴', src: '템플턴 투자 원칙' },
    { q: '남들이 절망해서 팔 때 사고 열광해서 살 때 팔려면 가장 큰 용기가 필요하지만, 보상도 가장 크다.', by: '존 템플턴', src: '템플턴 투자 원칙' },
    { q: '조정에 대비하거나 조정을 예측하려다 잃은 돈이, 조정 그 자체로 잃은 돈보다 훨씬 많다.', by: '피터 린치', src: '1995 Worth 기고' },
    { q: '주식으로 돈을 버는 비결은 겁에 질려 주식에서 도망치지 않는 것이다.', by: '피터 린치', src: '『월가의 영웅들』' },
    { q: '투자자의 가장 큰 문제, 심지어 최악의 적은 바로 자기 자신일 가능성이 크다.', by: '벤저민 그레이엄', src: '『현명한 투자자』' },
  ];
  var INTERVAL = 7000;
  var box = document.getElementById('qroll');
  if (!box) return;
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var n = QUOTES.length;
  var i = Math.floor(Math.random() * n);
  box.innerHTML = QUOTES.map(function (x, k) {
    return '<figure class="qroll-item" aria-hidden="true" data-k="' + k + '"><blockquote>' + esc(x.q) + '</blockquote>'
      + '<figcaption><b>' + esc(x.by) + '</b> · ' + esc(x.src) + '</figcaption></figure>';
  }).join('') + '<span class="qroll-n" aria-hidden="true"></span>';
  var items = box.querySelectorAll('.qroll-item');
  var count = box.querySelector('.qroll-n');
  function show(k) {
    i = (k + n) % n;
    for (var j = 0; j < n; j++) {
      items[j].classList.toggle('on', j === i);
      items[j].setAttribute('aria-hidden', j === i ? 'false' : 'true');
    }
    count.textContent = (i + 1) + ' / ' + n;
  }
  var timer = null, held = false;
  function stop() { clearInterval(timer); timer = null; }
  function start() { stop(); if (!held && !document.hidden) timer = setInterval(function () { show(i + 1); }, INTERVAL); }
  function hold(v) { held = v; box.classList.toggle('paused', v); v ? stop() : start(); }
  box.addEventListener('mouseenter', function () { hold(true); });
  box.addEventListener('mouseleave', function () { hold(false); });
  box.addEventListener('focusin', function () { if (box.matches(':focus-visible')) hold(true); }); // 키보드 포커스만 멈춤(눌러서 넘길 땐 계속 돌아감)
  box.addEventListener('focusout', function () { hold(false); });
  box.addEventListener('click', function () { show(i + 1); start(); });
  box.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); show(i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); }
  });
  document.addEventListener('visibilitychange', start);
  show(i);
  start();
})();
