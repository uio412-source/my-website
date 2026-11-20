# Mr. Stocks

웅줍 지표 차트와 보유종목·자산 현황을 보여 주는 정적 웹사이트입니다(HTML/CSS/JS). `main` 브랜치에 merge되면 **GitHub Pages로 자동 배포**됩니다.

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
- **차트** (`ungjup.html`): QQQ, SPY, GLD, 코스피200, 비트코인의 웅줍 구간·웅줍LV와 최근 일봉 기준 가격·전일 대비 등락률
- **보유종목** (`holdings.html`): 종목별 평가금액·손익과 웅줍LV 태그
- **자산** (`wealth.html`): 총액·손익, 시장·유형·웅줍LV·상위종목 비중

지수와 웅줍LV 데이터는 GitHub Actions가 매일 자동으로 갱신합니다. 보유 현황은 `data/holdings.json`을 직접 고칩니다.
직접 데이터를 갱신하려면:

```
pip install numpy pandas
python tools/ungjup/build.py
```
