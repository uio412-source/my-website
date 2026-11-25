#!/usr/bin/env python3
"""수집 PR 자동 머지 (.github/workflows/data-automerge.yml이 실행).

ChatGPT 예약 작업 같은 수집기가 올린 PR이 아래를 모두 만족하면 main에 머지하고 배포를 돌립니다.
- 브랜치가 `ai/chatgpt/data-`로 시작하는 이 저장소 브랜치, 초안 아님, 받는 쪽이 main
- 바뀐 파일이 전부 `data/inbox/<종류>/YYYY-MM-DD-<출처>.json` **새 파일**(수정·삭제·이름 변경 없음)
- 마지막 커밋 후 MIN_AGE분이 지남(수집기가 아직 커밋을 올리는 중일 수 있어서)
- main의 `tools/data/inbox.py validate` 통과. PR에서는 그 JSON 파일만 가져오고 PR 쪽 코드는 실행하지 않습니다.
통과 못 한 PR은 그대로 두고 이유를 PR 댓글로 남깁니다(같은 커밋에는 한 번만).

  python tools/data/automerge.py              # 열린 수집 PR 전부
  python tools/data/automerge.py --pr 66      # 한 PR만
  python tools/data/automerge.py --dry-run    # 머지·댓글·배포 없이 판정만 출력
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REPO = os.environ.get("GITHUB_REPOSITORY", "uio412-source/my-website")
BRANCH_PREFIXES = ("ai/chatgpt/data-",)
MIN_AGE = 10  # 분
KINDS = ("card-events", "hotel-events", "travel-events", "brand-services", "card-terms", "card-products")
FILE_RX = re.compile(r"^data/inbox/(%s)/\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.json$" % "|".join(KINDS))
MAX_BYTES = 2_000_000
MARK = "<!-- data-automerge:{sha} -->"


def sh(*cmd: str, check: bool = True) -> subprocess.CompletedProcess:
    r = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True)
    if check and r.returncode:
        raise RuntimeError(f"{' '.join(cmd[:4])} … 실패: {(r.stderr or r.stdout).strip()[:500]}")
    return r


def api(path: str, *args: str, paginate: bool = False):
    cmd = ["gh", "api", *(["--paginate", "--slurp"] if paginate else []), path, *args]
    out = sh(*cmd).stdout
    data = json.loads(out) if out.strip() else None
    if paginate:  # --slurp: 페이지 배열의 배열
        return [x for page in data for x in page]
    return data


def file_problems(files: list[dict]) -> list[str]:
    """PR이 바꾼 파일 목록 검사. 문제 없으면 []"""
    if not files:
        return ["바뀐 파일이 없습니다"]
    bad = []
    for f in files:
        name, status = f.get("filename", ""), f.get("status")
        if not FILE_RX.match(name):
            bad.append(f"`{name}`: data/inbox/<종류>/YYYY-MM-DD-<출처>.json 밖의 파일")
        elif status != "added":
            bad.append(f"`{name}`: 새 파일만 자동 머지합니다(지금: {status})")
    return bad


def age_minutes(sha: str) -> float:
    c = api(f"repos/{REPO}/commits/{sha}")
    at = datetime.fromisoformat(c["commit"]["committer"]["date"].replace("Z", "+00:00"))
    return (datetime.now(timezone.utc) - at).total_seconds() / 60


def validate(n: int, sha: str, names: list[str]) -> tuple[str, str]:
    """main 체크아웃에 PR의 inbox 파일만 얹고 main의 inbox.py validate 실행 → ('ok'|'fail'|'moved', 기록)"""
    ref = f"refs/automerge/{n}"
    sh("git", "fetch", "--quiet", "--no-tags", "--depth=1", "origin", f"+refs/pull/{n}/head:{ref}")
    try:
        if sh("git", "rev-parse", ref).stdout.strip() != sha:
            return "moved", "검사하는 사이 PR에 새 커밋이 올라옴"
        for name in names:  # 이름은 FILE_RX로 이미 확인함
            size = int(sh("git", "cat-file", "-s", f"{ref}:{name}").stdout)
            if size > MAX_BYTES:
                return "fail", f"`{name}`가 {size:,}바이트로 너무 큽니다(최대 {MAX_BYTES:,})"
        sh("git", "checkout", ref, "--", *names)
        r = sh(sys.executable, "-I", "tools/data/inbox.py", "validate", check=False)
        return ("ok" if r.returncode == 0 else "fail"), (r.stdout + r.stderr).strip()
    finally:  # data/inbox만 main 상태로 되돌림
        sh("git", "reset", "--quiet", "HEAD", "--", "data/inbox", check=False)
        sh("git", "checkout", "HEAD", "--", "data/inbox", check=False)
        sh("git", "clean", "-fdq", "--", "data/inbox", check=False)
        sh("git", "update-ref", "-d", ref, check=False)


def comment_once(n: int, sha: str, text: str, dry: bool):
    mark = MARK.format(sha=sha)
    if any(mark in (c.get("body") or "") for c in api(f"repos/{REPO}/issues/{n}/comments", paginate=True)):
        return
    body = f"{mark}\n**자동 머지 안 함** (`{sha[:7]}`)\n\n{text}\n\n고쳐서 새 커밋을 올리면 다시 검사합니다. 내용이 맞으면 직접 머지해도 됩니다."
    if dry:
        print(f"  [dry-run] 댓글: {text[:200]}")
        return
    sh("gh", "api", f"repos/{REPO}/issues/{n}/comments", "-f", f"body={body}")


def handle(pr: dict, dry: bool, min_age: float) -> str:
    """'merged' · 'wait' · 'skip' · 'blocked'"""
    n, sha, head = pr["number"], pr["head"]["sha"], pr["head"]
    if pr.get("state") != "open":
        return "skip"
    if not head["ref"].startswith(BRANCH_PREFIXES) or (head.get("repo") or {}).get("full_name") != REPO:
        return "skip"
    if pr.get("draft") or pr["base"]["ref"] != "main":
        print(f"#{n}: 초안이거나 main이 아닌 곳으로 가는 PR, 건너뜀")
        return "skip"
    age = age_minutes(sha)
    if age < min_age:
        print(f"#{n}: 마지막 커밋 {age:.0f}분 전, {min_age:.0f}분 지나면 다시 봄")
        return "wait"
    files = api(f"repos/{REPO}/pulls/{n}/files", paginate=True)
    bad = file_problems(files)
    if bad:
        print(f"#{n}: 파일 조건 불통과 {bad}")
        comment_once(n, sha, "\n".join(f"- {b}" for b in bad), dry)
        return "blocked"
    status, log = validate(n, sha, [f["filename"] for f in files])
    if status == "moved":
        print(f"#{n}: {log}, 다음 실행 때 다시 봄")
        return "wait"
    if status == "fail":
        print(f"#{n}: 양식 검사 불통과\n{log}")
        comment_once(n, sha, f"양식 검사(`tools/data/inbox.py validate`) 실패\n\n```\n{log[-3000:]}\n```", dry)
        return "blocked"
    if dry:
        print(f"#{n}: 통과 → [dry-run] 머지 안 함 ({len(files)}개 파일)")
        return "merged"
    r = sh("gh", "api", "-X", "PUT", f"repos/{REPO}/pulls/{n}/merge",
           "-f", "merge_method=merge", "-f", f"sha={sha}", check=False)
    if r.returncode:
        msg = (r.stdout + r.stderr).strip()
        print(f"#{n}: 머지 실패 {msg[:300]}")
        now = api(f"repos/{REPO}/pulls/{n}")
        if now.get("merged"):  # 다른 실행이 먼저 머지함
            return "skip"
        if now["head"]["sha"] != sha:  # 그사이 새 커밋 → 다음 실행
            return "wait"
        comment_once(n, sha, f"검사는 통과했지만 머지가 안 됐습니다(충돌 등)\n\n```\n{msg[:1500]}\n```", dry)
        return "blocked"
    print(f"#{n}: 머지함 ({len(files)}개 파일) {pr['title']}")
    return "merged"


def refresh_queue(dry: bool) -> None:
    """머지 뒤 수집 대기열(data/collect-queue.json)을 다시 만들어 커밋합니다.

    대기열이 낡으면 다음 에이전트(ChatGPT·Pickle·Claude)가 이미 모은 항목을 또 고릅니다
    (docs/data-update.md 9장). main은 PR로만 바뀌므로(ruleset 'main 보호') 대기열 변경분만 담은
    PR을 만들어 곧바로 머지합니다. 이 단계가 실패해도 머지·배포에는 영향을 주지 않습니다.
    """
    if dry:
        print("  [dry-run] 대기열 갱신 안 함")
        return
    branch = "ai/queue-refresh/main"
    try:
        sh("git", "fetch", "--quiet", "--no-tags", "origin", "main")
        sh("git", "checkout", "--quiet", "--force", "-B", "queue-refresh", "origin/main")
        sh(sys.executable, "-I", "tools/data/queue.py")
        if not sh("git", "status", "--porcelain", "--", "data/collect-queue.json").stdout.strip():
            print("대기열: 바뀐 것 없음")
            return
        sh("git", "add", "data/collect-queue.json")
        sh("git", "-c", "user.name=github-actions[bot]", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com",
           "commit", "--quiet", "-m", "data: 수집 대기열 자동 갱신")
        sh("git", "push", "--quiet", "--force", "origin", f"HEAD:refs/heads/{branch}")
        body = ("수집 PR을 머지한 뒤 `python tools/data/queue.py`로 대기열을 다시 만든 결과입니다.\n"
                "바뀐 파일은 `data/collect-queue.json` 하나이고 자동 머지(`tools/data/automerge.py`)가 만듭니다.\n"
                "다른 에이전트가 이미 모은 항목을 또 모으지 않게 `done`·`nextStart`를 반영합니다(docs/data-update.md 9장).")
        try:
            n = json.loads(sh("gh", "api", "-X", "POST", f"repos/{REPO}/pulls", "-f", "title=data: 수집 대기열 자동 갱신",
                              "-f", f"head={branch}", "-f", "base=main", "-f", f"body={body}").stdout)["number"]
        except Exception:  # 같은 브랜치의 열린 PR이 있으면 그것을 씀
            found = api(f"repos/{REPO}/pulls?state=open&head={REPO.split('/')[0]}:{branch}")
            if not found:
                raise
            n = found[0]["number"]
        r = sh("gh", "api", "-X", "PUT", f"repos/{REPO}/pulls/{n}/merge", "-f", "merge_method=squash", check=False)
        if r.returncode:
            print(f"대기열: PR #{n} 머지 실패({(r.stdout + r.stderr).strip()[:200]}) — 다음 실행에서 다시 시도")
        else:
            print(f"대기열: 다시 만들어 PR #{n}으로 머지함")
    except Exception as err:  # 대기열 갱신 실패가 머지 결과를 가리지 않게
        print(f"대기열: 갱신 실패(머지·배포에는 영향 없음) {err}")
    sh("git", "push", "--quiet", "origin", "--delete", branch, check=False)


def main() -> int:
    args = sys.argv[1:]
    dry = "--dry-run" in args
    min_age = MIN_AGE
    if "--min-age" in args:
        min_age = float(args[args.index("--min-age") + 1])
    if "--pr" in args:
        prs = [api(f"repos/{REPO}/pulls/{int(args[args.index('--pr') + 1])}")]
    else:
        prs = sorted(api(f"repos/{REPO}/pulls?state=open&per_page=100", paginate=True), key=lambda p: p["number"])
    result = {"merged": [], "wait": [], "blocked": []}
    for pr in prs:
        try:
            k = handle(pr, dry, min_age)
        except Exception as err:  # 한 PR이 이상해도 나머지는 계속
            print(f"#{pr['number']}: 오류 {err}")
            k = "blocked"
        if k in result:
            result[k].append(f"#{pr['number']} {pr['title']}")
    # 머지된 수집분이 대기열에 done으로 남도록 대기열을 다시 만듭니다(다른 에이전트가 또 모으지 않게)
    refresh_queue(dry)
    if result["merged"] and not dry:
        # GITHUB_TOKEN으로 한 머지는 push 이벤트를 만들지 않으므로 배포를 직접 실행
        sh("gh", "api", "-X", "POST", f"repos/{REPO}/actions/workflows/deploy.yml/dispatches", "-f", "ref=main")
        print("배포(Deploy to GitHub Pages) 실행 요청")
    lines = [f"- {k}: {v}" for k, items in result.items() for v in items] or ["- 처리할 수집 PR 없음"]
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        Path(summary).write_text("## 수집 PR 자동 머지\n" + "\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main())
