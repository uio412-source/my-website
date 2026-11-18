# 회사 웹사이트

HTML/CSS/JS로 만든 정적 웹사이트입니다. `main` 브랜치에 merge되면 **GitHub Pages로 자동 배포**됩니다.

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

## 바꿔야 할 내용
- 모든 페이지의 `회사이름`
- `contact@example.com`, 전화번호, 주소
- 각 페이지의 설명 문구
- 색상: `assets/css/style.css` 맨 위의 `--color-primary`
