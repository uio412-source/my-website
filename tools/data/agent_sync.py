#!/usr/bin/env python3
"""GPT · Claude · Pickle 공용 작업 현황판 만들기 — docs/agent-sync.md · data/agent-status.json

  python tools/data/agent_sync.py            # gh에서 PR 이력을 읽어 현황판을 다시 만듭니다
  python tools/data/agent_sync.py --no-gh    # gh 없이(기록 파일·대기열만) 만듭니다
  python tools/data/agent_sync.py --limit 60 # 읽을 PR 수(기본 40)

읽는 것
- data/agent-notes/<에이전트>.json  ← 각 에이전트가 **자기 파일에만** 쓰는 기록(한 일·실패·잠금)
- data/collect-queue.json           ← 다음 시작점·남은 건수·최근 수집일
- gh pr list                        ← 최근 PR·열린 PR(실패하면 지난 현황판의 PR 부분을 그대로 씀)

쓰는 것 (손으로 고치지 마세요. 다음 실행 때 덮어씁니다)
- data/agent-status.json  기계가 읽는 현황(에이전트·잠금·열린 PR·최근 PR·대기열·실패 목록)
- docs/agent-sync.md      사람이 읽는 현황판(규칙표·PR 이력·잠금·실패 로그·다음 시작점)

여러 에이전트가 같은 파일을 고쳐 충돌하지 않도록, 입력은 에이전트별 파일로 나누고
합치는 일은 이 스크립트 하나가 합니다. 기록 형식은 docs/agent-sync.md 5장을 보세요.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NOTES_DIR = ROOT / "data" / "agent-notes"
QUEUE = ROOT / "data" / "collect-queue.json"
OUT_JSON = ROOT / "data" / "agent-status.json"
OUT_MD = ROOT / "docs" / "agent-sync.md"
REPO = "uio412-source/my-website"
KST = timezone(timedelta(hours=9))

# 브랜치 `ai/<이 이름>/...` → 현황판에 쓰는 에이전트 이름
AGENT_NAME = {
    "chatgpt": "ChatGPT",
    "claude": "Claude",
    "pickle": "Pickle",
    "dot": "ChatGPT Dot",
    "gemini": "Gemini",
}

# 순서는 현황판 표에 그대로 씁니다.
AGENT_ORDER = ["ChatGPT", "ChatGPT Dot", "Claude", "Pickle"]


def now_kst() -> datetime:
    return datetime.now(KST)


def fmt_kst(iso: str | None) -> str:
    """GitHub의 UTC 시각(2026-11-25T10:13:32Z) → '2026-11-25 19:13' (KST)."""
    if not iso:
        return "-"
    try:
        dt = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
    except ValueError:
        return str(iso)[:16]
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(KST).strftime("%Y-%m-%d %H:%M")


def agent_of(branch: str | None) -> str:
    """브랜치 이름에서 에이전트를 알아냅니다. Pickle의 수집 브랜치는 ai/chatgpt/data-*-pickle*."""
    branch = branch or ""
    parts = branch.split("/")
    if len(parts) >= 2 and parts[0] == "ai":
        name = parts[1].lower()
        agent = AGENT_NAME.get(name, name.capitalize() or "기타")
        if agent == "ChatGPT" and "-pickle" in branch:
            return "Pickle"
        return agent
    return "기타"


def area_of(path: str) -> str:
    """바뀐 파일 경로 → 영역 이름(수집은 종류별, 그 밖은 앞 두 단계까지)."""
    p = path.split("/")
    if p[0] == "data" and len(p) > 2 and p[1] == "inbox":
        return "/".join(p[:3])
    if len(p) > 1:
        return "/".join(p[:2]) if p[0] == "tools" else p[0] + "/"
    return "루트"


def areas_label(files: list[dict] | None) -> str:
    """파일 목록 → '3파일 · docs/ 1 · tools/data 2'."""
    if not files:
        return "-"
    counts: dict[str, int] = {}
    for f in files:
        counts[area_of(f.get("path", ""))] = counts.get(area_of(f.get("path", "")), 0) + 1
    top = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:3]
    body = " · ".join(f"{name} {n}" for name, n in top)
    if len(counts) > 3:
        body += f" 외 {len(counts) - 3}곳"
    return f"{len(files)}파일 · {body}"


def cell(text: str, limit: int = 70) -> str:
    """표 칸에 넣을 글: 줄바꿈·파이프를 없애고 길면 자릅니다."""
    s = " ".join(str(text or "").split()).replace("|", "/")
    return s if len(s) <= limit else s[: limit - 1] + "…"


def load_notes() -> dict[str, dict]:
    notes: dict[str, dict] = {}
    if not NOTES_DIR.is_dir():
        return notes
    for path in sorted(NOTES_DIR.glob("*.json")):
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as e:
            print(f"경고: {path.relative_to(ROOT)} 를 읽지 못했습니다({e}) — 건너뜁니다.", file=sys.stderr)
            continue
        if not isinstance(doc, dict):
            continue
        agent = str(doc.get("agent") or path.stem)
        doc["_file"] = str(path.relative_to(ROOT))
        notes[agent] = doc
    return notes


def load_queue() -> dict:
    try:
        return json.loads(QUEUE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(f"경고: data/collect-queue.json 을 읽지 못했습니다({e}).", file=sys.stderr)
        return {}


def load_previous() -> dict:
    try:
        doc = json.loads(OUT_JSON.read_text(encoding="utf-8"))
        return doc if isinstance(doc, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def fetch_prs(limit: int, use_gh: bool) -> list[dict] | None:
    """gh pr list. 실패하면 None(지난 현황판의 PR 부분을 그대로 씁니다)."""
    if not use_gh:
        return None
    cmd = [
        "gh", "pr", "list", "-R", REPO, "--state", "all", "--limit", str(limit),
        "--json", "number,title,state,headRefName,createdAt,mergedAt,url,isDraft,files,author",
    ]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
    except (OSError, subprocess.TimeoutExpired) as e:
        print(f"경고: gh를 실행하지 못했습니다({e}) — 지난 PR 이력을 그대로 씁니다.", file=sys.stderr)
        return None
    if out.returncode != 0:
        print("경고: gh pr list 실패 — 지난 PR 이력을 그대로 씁니다.\n" + out.stderr.strip()[:400], file=sys.stderr)
        return None
    try:
        data = json.loads(out.stdout)
    except json.JSONDecodeError:
        print("경고: gh 출력을 읽지 못했습니다 — 지난 PR 이력을 그대로 씁니다.", file=sys.stderr)
        return None
    return data if isinstance(data, list) else None


def pr_row(pr: dict) -> dict:
    files = pr.get("files") or []
    return {
        "number": pr.get("number"),
        "title": pr.get("title") or "",
        "state": pr.get("state") or "",
        "agent": agent_of(pr.get("headRefName")),
        "branch": pr.get("headRefName") or "",
        "createdAt": pr.get("createdAt"),
        "mergedAt": pr.get("mergedAt"),
        "createdAtKST": fmt_kst(pr.get("createdAt")),
        "mergedAtKST": fmt_kst(pr.get("mergedAt")),
        "area": areas_label(files),
        "files": len(files),
        "url": pr.get("url") or "",
        "draft": bool(pr.get("isDraft")),
    }


def collect_skips(notes: dict[str, dict]) -> list[dict]:
    rows = []
    for agent, doc in notes.items():
        for s in doc.get("skipped") or []:
            if not isinstance(s, dict):
                continue
            rows.append({
                "date": str(s.get("at") or "")[:10],
                "agent": agent,
                "target": s.get("target") or "",
                "status": s.get("status") or "open",
                "reason": s.get("reason") or "",
                "retry": s.get("retry") or "",
                "ref": s.get("ref") or "",
            })
    # 다시 볼 것(open·workaround) 먼저, 같은 상태면 최근 날짜 먼저
    rank = {"open": 0, "workaround": 1, "resolved": 2}
    rows.sort(key=lambda r: (rank.get(r["status"], 3), -(_date_key(r["date"])), r["agent"], r["target"]))
    return rows


def _date_key(text: str) -> int:
    try:
        return int(str(text).replace("-", "") or 0)
    except ValueError:
        return 0


def _age_hours(iso: str | None) -> float | None:
    """잠금이 얼마나 오래됐는지(시간). 읽을 수 없으면 None."""
    if not iso:
        return None
    try:
        dt = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=KST)
    return round((now_kst() - dt).total_seconds() / 3600, 1)


def build_status(notes: dict, queue: dict, prs: list[dict] | None, previous: dict, limit: int) -> dict:
    if prs is None:  # gh 실패 → 지난 결과의 PR 부분 유지
        recent = previous.get("recentPRs") or []
        open_prs = previous.get("openPRs") or []
        stale = True
    else:
        rows = [pr_row(p) for p in prs]
        open_prs = [r for r in rows if r["state"] == "OPEN"]
        recent = [r for r in rows if r["state"] in ("MERGED", "CLOSED")]
        recent.sort(key=lambda r: r["mergedAt"] or r["createdAt"] or "", reverse=True)
        recent = recent[:limit]
        stale = False

    seen = {r["agent"] for r in recent + open_prs}
    names = [a for a in AGENT_ORDER if a in notes or a in seen]
    names += sorted(a for a in set(notes) | seen if a not in names)
    agents = {}
    for agent in names:
        doc = notes.get(agent) or {}
        last = max((r for r in recent if r["agent"] == agent and r["state"] == "MERGED"),
                   key=lambda r: r["mergedAt"] or "", default=None)
        open_skips = [s for s in collect_skips({agent: doc}) if s["status"] in ("open", "workaround")]
        agents[agent] = {
            "noteFile": doc.get("_file"),
            "role": doc.get("role") or doc.get("note") or "",
            "updatedAt": doc.get("updatedAt"),
            "lock": doc.get("lock"),
            "lastMergedPR": ({"number": last["number"], "title": last["title"], "mergedAt": last["mergedAt"], "mergedAtKST": last["mergedAtKST"]} if last else None),
            "runs": doc.get("runs") or [],
            "openIssues": len(open_skips),
        }

    locks = []
    for agent in names:
        lock = (notes.get(agent) or {}).get("lock")
        if isinstance(lock, dict) and (lock.get("areas") or lock.get("branch")):
            locks.append({
                "agent": agent,
                "areas": lock.get("areas") or [],
                "branch": lock.get("branch") or "",
                "pr": lock.get("pr"),
                "since": fmt_kst(lock.get("since")),
                "sinceRaw": lock.get("since") or "",
                "ageHours": _age_hours(lock.get("since")),
                "note": lock.get("note") or "",
            })

    counts = queue.get("counts") or {}
    return {
        "generatedAt": now_kst().isoformat(timespec="seconds"),
        "repo": REPO,
        "how": "python tools/data/agent_sync.py 로 다시 만듭니다. 손으로 고치지 마세요. 기록은 data/agent-notes/<에이전트>.json.",
        "prFresh": not stale,
        "agents": agents,
        "locks": locks,
        "openPRs": [{k: r[k] for k in ("number", "title", "agent", "branch", "createdAtKST", "area", "url", "draft")} for r in open_prs],
        "recentPRs": [{k: r[k] for k in ("number", "title", "agent", "branch", "state", "mergedAt", "mergedAtKST", "createdAt", "createdAtKST", "area", "files", "url") if k in r} for r in recent],
        "queue": {
            "built": queue.get("built"),
            "nextStart": queue.get("nextStart") or {},
            "counts": counts,
            "lastCollected": queue.get("lastCollected") or {},
        },
        "skipped": collect_skips(notes),
    }


def render_md(status: dict, notes: dict) -> str:
    L: list[str] = []
    add = L.append
    generated = fmt_kst(status["generatedAt"])
    add("# 🤝 GPT · Claude · Pickle 공용 작업 현황판")
    add("")
    add(f"_자동 생성 {generated} KST · `python tools/data/agent_sync.py` · 기계용 JSON은 [`data/agent-status.json`](../data/agent-status.json)_")
    add("")
    add("> **작업 시작 전에 이 파일과 `data/agent-status.json`, `data/collect-queue.json`(`todo`만), `data/inbox/`의 key, 열린 PR을 봅니다.**")
    add("> **끝나면 `data/agent-notes/<내 파일>.json`에 한 일·실패·다음 시작점을 적고 `python tools/data/agent_sync.py`를 돌립니다.**")
    add("> 이 파일과 `data/agent-status.json`은 스크립트가 만드니 손으로 고치지 마세요(다음 실행 때 덮어씁니다).")
    if not status.get("prFresh", True):
        add(">")
        add("> ⚠ gh를 부르지 못해 **PR 부분은 지난 생성 때 값**입니다(대기열·기록 부분은 최신).")
    add("")

    # 1. 이름표
    add("## 1. 에이전트별 이름표 — 브랜치·파일이 겹치지 않게")
    add("")
    add("| 에이전트 | 기록 파일(내 것만 고침) | 브랜치 | 수집 파일 이름 | 수집 PR 자동 머지 |")
    add("|---|---|---|---|---|")
    add("| **ChatGPT** (예약 작업·Dot) | `data/agent-notes/chatgpt.json` | `ai/chatgpt/data-YYYY-MM-DD` | `YYYY-MM-DD-<출처>.json` (접미사 없음) | 됨(마지막 커밋 10분 뒤) |")
    add("| **Claude** | `data/agent-notes/claude.json` | `ai/claude/<작업내용>` | `YYYY-MM-DD-<출처>-claude.json` | 안 됨(사람·에이전트가 확인 후 머지) |")
    add("| **Pickle** | `data/agent-notes/pickle.json` | 수집 `ai/chatgpt/data-YYYY-MM-DD-pickle*` · 코드·문서 `ai/pickle/<작업내용>` | `YYYY-MM-DD-<출처>-pickle.json`, 같은 날 두 번째부터 `-pickle2`·`-pickle3` | 수집 PR만 됨 |")
    add("")
    add("- **`-pickle`은 Pickle만, `-claude`는 Claude만 씁니다.** 접미사 없는 수집 파일은 ChatGPT 것입니다.")
    add("- 접미사는 영문 소문자·숫자·하이픈만. 같은 날 같은 출처를 둘이 모아도 파일 이름이 달라 겹치지 않습니다.")
    add("- Pickle의 수집 브랜치는 `ai/chatgpt/data-`로 시작해야 자동 머지 대상이 됩니다. 커밋을 다 올린 뒤 PR을 엽니다.")
    add("- 새 에이전트가 들어오면 `ai/<이름>/…` 브랜치와 `data/agent-notes/<이름>.json`을 씁니다(표에 줄을 더하세요).")
    add("")
    add("### 영역 (같은 파일을 둘이 동시에 고치지 않기)")
    add("")
    add("| 영역 | 기본 담당 | 규칙 |")
    add("|---|---|---|")
    add("| `data/inbox/**` | ChatGPT · Pickle (수집) | 파일 이름 접미사로 분리(위 표). 다른 에이전트가 같은 종류·출처를 모을 때도 접미사를 다르게 |")
    add("| `docs/roadmap.md` | 그날 작업한 에이전트 | 자기 작업이 끝날 때 한 일만 덧붙임(기존 줄 수정 금지) |")
    add("| `paymorevent/**` · `hotels/**` · `travel/**` · `assets/**` · `*.html` | Claude (코드) | 고치기 전에 잠금 표시. 같은 파일이 열린 PR에 있으면 그 PR이 머지된 뒤에 |")
    add("| `tools/data/**` · `docs/data-update.md` · `README.md` · `AGENTS.md` | 누구나 | 작은 변경만, 잠금 표시하고 한 PR에 한 가지 |")
    add("| `data/collect-queue.json` | `tools/data/queue.py`만 | 손으로 고치지 않음(수집 PR 머지 뒤 자동 갱신) |")
    add("| `data/agent-notes/<에이전트>.json` | 그 에이전트만 | 남의 파일은 읽기만 |")
    add("| `docs/agent-sync.md` · `data/agent-status.json` | `tools/data/agent_sync.py`만 | 손으로 고치지 않음 |")
    add("")

    # 2. 최근 PR
    add("## 2. 최근 PR · 업데이트 이력 (KST)")
    add("")
    add("| PR | 에이전트 | 내용 | 반영 시각 | 영역(파일) | 상태 |")
    add("|---|---|---|---|---|---|")
    recent = status.get("recentPRs") or []
    if not recent:
        add("| - | - | 아직 기록이 없습니다 | - | - | - |")
    for r in recent[:25]:
        state = "머지" if r["state"] == "MERGED" else "닫힘"
        when = r.get("mergedAtKST") if r["state"] == "MERGED" else r.get("createdAtKST")
        add(f"| [#{r['number']}]({r['url']}) | {r['agent']} | {cell(r['title'], 60)} | {when} | {cell(r['area'], 48)} | {state} |")
    if len(recent) > 25:
        add("")
        add(f"_(최근 25건만. 전체는 `data/agent-status.json`의 `recentPRs`.)_")
    add("")

    # 3. 진행·잠금·다음 시작점
    add("## 3. 지금 진행 중 · 잠금 · 다음 시작점")
    add("")
    add("### 잠금 (작업 중인 영역 — 끝나면 `lock`을 `null`로 비웁니다)")
    add("")
    locks = status.get("locks") or []
    if locks:
        add("| 에이전트 | 영역 | 브랜치 | PR | 시작 | 지난 시간 | 메모 |")
        add("|---|---|---|---|---|---|---|")
        for lk in locks:
            areas = ", ".join(f"`{a}`" for a in lk["areas"]) or "-"
            branch = f"`{lk['branch']}`" if lk["branch"] else "-"
            pr = f"#{lk['pr']}" if lk.get("pr") else "-"
            age = lk.get("ageHours")
            if age is None:
                age_txt = "-"
            elif age < 1:
                age_txt = "1시간 안"
            else:
                age_txt = f"{age:.0f}시간" + (" ⚠ 확인 필요" if age >= 6 else "")
            add(f"| {lk['agent']} | {areas} | {branch} | {pr} | {lk['since']} | {age_txt} | {cell(lk['note'], 50)} |")
        add("")
        add("_6시간이 넘은 잠금은 이미 끝난 작업일 수 있습니다. 내 것이면 `lock`을 비우고, 남의 것이면 그 에이전트 기록을 봅니다._")
    else:
        add("_지금 잠근 영역이 없습니다._")
    add("")
    add("### 열린 PR")
    add("")
    open_prs = status.get("openPRs") or []
    if open_prs:
        add("| PR | 에이전트 | 브랜치 | 만든 시각 | 영역(파일) | 내용 |")
        add("|---|---|---|---|---|---|")
        for r in open_prs:
            draft = " (초안)" if r.get("draft") else ""
            add(f"| [#{r['number']}]({r['url']}){draft} | {r['agent']} | `{cell(r['branch'], 34)}` | {r['createdAtKST']} | {cell(r['area'], 40)} | {cell(r['title'], 50)} |")
    else:
        add("_열린 PR이 없습니다._")
    add("")
    q = status.get("queue") or {}
    counts = q.get("counts") or {}
    cards = counts.get("cards") or {}
    brands = counts.get("brandPrograms") or {}
    next_start = q.get("nextStart") or {}
    add(f"### 수집 대기열 (`data/collect-queue.json`, built {q.get('built') or '-'})")
    add("")
    add("대기열은 만든 시점 기준입니다. `data/inbox/`에 key가 있으면 이미 한 항목이니 그 key는 빼고 고릅니다. `built`가 최근 수집 PR보다 이르면 inbox에 이미 있는 key가 `todo`로 남아 있을 수 있습니다 — 그럴 때는 `python tools/data/queue.py`로 갱신해 PR 하나로 올립니다.")
    add("")
    if q:
        add(f"- **다음 시작점** — cards `{next_start.get('cards')}` · brandPrograms `{next_start.get('brandPrograms')}`")
        add(f"- **남은 카드** {cards.get('todo', '-')} / {cards.get('total', '-')}종 · **브랜드 프로그램** todo {brands.get('todo', '-')} · valet-only {brands.get('valetOnly', '-')} / {brands.get('total', '-')}개")
        last = q.get("lastCollected") or {}
        add("- **최근 수집일** — " + " · ".join(f"{k} {v or '없음'}" for k, v in last.items()))
    else:
        add("_대기열 파일을 읽지 못했습니다._")
    add("")
    add("### 에이전트별 마지막 반영")
    add("")
    add("| 에이전트 | 기록 파일 | 마지막 머지 PR | 반영 시각 | 다시 볼 것(open/workaround) |")
    add("|---|---|---|---|---|")
    for agent, info in (status.get("agents") or {}).items():
        last = info.get("lastMergedPR")
        pr = f"#{last['number']} {cell(last['title'], 34)}" if last else "-"
        when = last["mergedAtKST"] if last else "-"
        note_file = f"`{info['noteFile']}`" if info.get("noteFile") else "**없음 — 만들어 주세요**"
        add(f"| {agent} | {note_file} | {pr} | {when} | {info.get('openIssues', 0)}건 |")
    add("")

    # 4. 실패 로그
    add("## 4. 실패 · 보류 · 제외 로그 (같은 삽질 금지)")
    add("")
    add("상태 — `open` 다시 볼 것 · `workaround` 다른 경로로 처리함 · `resolved` 해결됨")
    add("")
    skipped = status.get("skipped") or []
    if skipped:
        labels = {"open": "다시 볼 것 (open)", "workaround": "다른 경로로 처리 (workaround)", "resolved": "해결됨 (resolved)"}
        for key in ("open", "workaround", "resolved"):
            group = [s for s in skipped if s["status"] == key]
            if not group:
                continue
            add(f"### {labels[key]} — {len(group)}건")
            add("")
            for s in group:
                add(f"- **{s['date'] or '-'} · {s['agent']} · {s['target']}**")
                if s.get("reason"):
                    add(f"  - 사유: {s['reason']}")
                if s.get("retry"):
                    label = {"open": "재시도", "workaround": "대신 이렇게", "resolved": "해결 방법"}.get(s["status"], "재시도")
                    add(f"  - {label}: {s['retry']}")
                if s.get("ref"):
                    add(f"  - 참고: {s['ref']}")
            add("")
    else:
        add("_기록된 실패·보류가 없습니다._")
        add("")

    # 5. 기록 형식
    add("## 5. 기록하는 법 — `data/agent-notes/<내 파일>.json`")
    add("")
    add("```json")
    add(json.dumps({
        "agent": "Pickle",
        "role": "데이터 수집 + 코드·문서 (Claude 기반)",
        "updatedAt": "2026-11-25T20:10:00+09:00",
        "lock": {
            "areas": ["docs/", "tools/data/"],
            "branch": "ai/pickle/agent-sync-board",
            "pr": None,
            "since": "2026-11-25T19:40:00+09:00",
            "note": "공용 현황판 구축",
        },
        "runs": [
            {"at": "2026-11-25T11:50:00+09:00", "kind": "card-terms", "pr": 94,
             "summary": "BC 바로카드 4종 · 혜택 22줄", "queueKeys": ["bc-104453", "bc-104063"]}
        ],
        "skipped": [
            {"at": "2026-11-25", "target": "samsung-aap1483 삼성 상품설명서", "status": "open",
             "reason": "카드 상세가 Nuxt 런타임 렌더링이라 PDF 링크가 HTML에 없음. 파일명 추측 4건 404",
             "retry": "상품공시실 목록에서 카드명으로 찾기"}
        ],
    }, ensure_ascii=False, indent=2))
    add("```")
    add("")
    add("- `status`는 `open`·`workaround`·`resolved` 중 하나. 해결되면 지우지 말고 `resolved`로 바꾸고 `ref`에 해결한 PR을 적습니다(다음 에이전트가 이력으로 봅니다).")
    add("- `lock`은 작업을 시작할 때 적고, PR을 머지하면 `null`로 비웁니다. 남의 잠금 영역은 피합니다.")
    add("- 기록을 고친 뒤 `python tools/data/agent_sync.py`를 실행해 이 현황판과 `data/agent-status.json`을 함께 커밋합니다.")
    add("")
    return "\n".join(L)


def main() -> int:
    ap = argparse.ArgumentParser(description="GPT·Claude·Pickle 공용 작업 현황판 만들기")
    ap.add_argument("--no-gh", action="store_true", help="gh를 부르지 않고 기록 파일·대기열만으로 만듭니다")
    ap.add_argument("--limit", type=int, default=40, help="읽을 PR 수(기본 40)")
    args = ap.parse_args()

    notes = load_notes()
    if not notes:
        print("경고: data/agent-notes/*.json 이 없습니다. 기록 파일 없이 만듭니다.", file=sys.stderr)
    prs = fetch_prs(args.limit, not args.no_gh)
    status = build_status(notes, load_queue(), prs, load_previous(), args.limit)

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_MD.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(status, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_MD.write_text(render_md(status, notes), encoding="utf-8")

    open_n = sum(1 for s in status["skipped"] if s["status"] == "open")
    print(
        f"현황판: 에이전트 {len(status['agents'])} · 잠금 {len(status['locks'])} · 열린 PR {len(status['openPRs'])} · "
        f"최근 PR {len(status['recentPRs'])} · 실패/보류 {len(status['skipped'])}(open {open_n})"
        + ("" if status["prFresh"] else " · PR 부분은 지난 값")
    )
    print(f"- {OUT_MD.relative_to(ROOT)}")
    print(f"- {OUT_JSON.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
