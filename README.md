# Mr. Stocks

줍줍 지표 차트와 관심종목 시세을 보여 주는 정적 웹사이트입니다(HTML/CSS/JS). `main` 브랜치에 merge되면 **GitHub Pages로 자동 배포**됩니다.

## 처음 한 번만 설정
1. 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 바꿉니다.
2. **Settings → Branches → Add rule**에서 `main` 브랜치에 *Require a pull request before merging*을 켭니다. AI 도구가 `main`에 직접 올리지 못하게 막아 줍니다.
3. (선택) 자기 도메인을 쓰려면 **Settings → Pages → Custom domain**에 도메인을 입력하세요.

배포 주소: `https://<GitHub 아이디>.github.io/<저장소 이름>/`

## 여러 AI로 함께 편집하기
Claude, ChatGPT, Gemini 모두 같은 규칙을 따르도록 [AGENTS.md](AGENTS.md)에 작업 지침을 정리해 두었습니다.

작업 흐름:
1. AI 도구에 이 저장소를 연결합니다.
2. "AGENTS.md를 따라서 ○○를 바꾸고 PR을 만들어 줘"라고 요청합니다.
3. PR에서 변경 내용을 확인한 뒤 **Merge**합니다.
4. 1~2분 안에 사이트에 자동으로 반영됩니다. 진행 상황은 **Actions** 탭에서 볼 수 있습니다.

## 페이지
- **차트** (`ungjup.html`): QQQ, SPY, GLD, 코스피200, 비트코인의 줍줍 구간·줍줍LV와 최근 일봉 기준 가격·전일 대비 등락률
- **관심종목** (`holdings.html`): 종목별 최근 일봉 가격·전일 대비 등락률·줍줍LV·뉴스

시세, 줍줍LV와 뉴스는 GitHub Actions가 한국시간 06:40과 16:40에 갱신합니다. 배포 데이터에 종목을 추가하려면 `data/watchlist.json`을 수정합니다. 화면에서 변경한 관심목록은 해당 브라우저에 저장됩니다.
직접 데이터를 갱신하려면:

```
pip install numpy pandas
python tools/ungjup/build.py
```

## Mr. Hotels

`hotels/`에서 Accor, IHG, HOTELLUX, Marriott, Hilton의 서울 호텔과 등급별 혜택을 비교합니다. 종목 화면과 카드 화면에서는 로고 옆 사이트 전환 메뉴로 이동할 수 있습니다.
